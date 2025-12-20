package com.backgroundlocation

import android.Manifest
import android.annotation.SuppressLint
import android.app.*
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.location.Location
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.annotation.RequiresApi
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.google.android.gms.location.*

/**
 * Foreground service that handles background location tracking
 * Continues to collect location updates even when app is in background
 */
class LocationService : Service() {

  private lateinit var fusedLocationClient: FusedLocationProviderClient
  private lateinit var locationCallback: LocationCallback
  private lateinit var storage: LocationStorage
  private var currentTripId: String? = null
  private var trackingOptions: TrackingOptions = TrackingOptions()

  override fun onCreate() {
    super.onCreate()
    fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
    storage = LocationStorage(this)

    setupLocationCallback()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    android.util.Log.d("LocationService", "onStartCommand called")

    // Check for restart loops
    if (isRestartLoopDetected()) {
      android.util.Log.e("LocationService", "Restart loop detected, stopping service")
      storage.saveTrackingState(null, false)
      stopSelf()
      return START_NOT_STICKY
    }

    // Record this start
    recordServiceStart()

    // Try to get tripId from intent
    var tripId = intent?.getStringExtra(EXTRA_TRIP_ID)
    
    // Parse tracking options from Bundle
    val optionsBundle = intent?.getBundleExtra(EXTRA_TRACKING_OPTIONS)
    trackingOptions = if (optionsBundle != null) {
      parseTrackingOptionsFromBundle(optionsBundle)
    } else {
      // If intent is null (service restarted by system), try to recover from storage
      if (intent == null) {
        val trackingState = storage.getTrackingState()
        if (trackingState.isActive && trackingState.tripId != null) {
          tripId = trackingState.tripId
          trackingState.options?.let { trackingOptions = it }
        }
      }
      trackingOptions
    }
    
    if (tripId == null) {
      // No valid tripId - stop the service
      stopSelf()
      return START_NOT_STICKY
    }
    
    currentTripId = tripId
    android.util.Log.d("LocationService", "Starting location tracking for tripId: $tripId")

    // Create notification channel with options
    createNotificationChannel()

    // Start as foreground service with notification
    val notification = createNotification()
    startForegroundWithType(notification)

    // Check last known location to verify GPS is working
    checkLastKnownLocation()
    
    // Start location updates
    startLocationUpdates()

    // Use START_REDELIVER_INTENT for more predictable restart behavior
    // If killed, system will redeliver the original intent
    return START_REDELIVER_INTENT
  }

  /**
   * Parses TrackingOptions from Bundle
   */
  private fun parseTrackingOptionsFromBundle(bundle: android.os.Bundle): TrackingOptions {
    val accuracyString = bundle.getString("accuracy")
    return TrackingOptions(
      updateInterval = if (bundle.containsKey("updateInterval")) bundle.getLong("updateInterval") else null,
      fastestInterval = if (bundle.containsKey("fastestInterval")) bundle.getLong("fastestInterval") else null,
      maxWaitTime = if (bundle.containsKey("maxWaitTime")) bundle.getLong("maxWaitTime") else null,
      accuracy = LocationAccuracy.fromString(accuracyString),
      waitForAccurateLocation = if (bundle.containsKey("waitForAccurateLocation")) bundle.getBoolean("waitForAccurateLocation") else null,
      notificationTitle = bundle.getString("notificationTitle"),
      notificationText = bundle.getString("notificationText"),
      notificationChannelName = bundle.getString("notificationChannelName"),
      notificationPriority = bundle.getString("notificationPriority"),
      foregroundOnly = if (bundle.containsKey("foregroundOnly")) bundle.getBoolean("foregroundOnly") else null
    )
  }

  /**
   * Starts the foreground service with proper service type for Android 14+
   * Android 14 (API 34) requires declaring foregroundServiceType at runtime
   */
  private fun startForegroundWithType(notification: Notification) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      // Android 14+ requires specifying the foreground service type at runtime
      startForeground(
        NOTIFICATION_ID,
        notification,
        ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
      )
      android.util.Log.d("LocationService", "Started foreground service with FOREGROUND_SERVICE_TYPE_LOCATION (Android 14+)")
    } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      // Android 10-13: foregroundServiceType from manifest is sufficient
      startForeground(NOTIFICATION_ID, notification)
      android.util.Log.d("LocationService", "Started foreground service (Android 10-13)")
    } else {
      // Android 9 and below
      startForeground(NOTIFICATION_ID, notification)
      android.util.Log.d("LocationService", "Started foreground service (Android 9 and below)")
    }
  }

  /**
   * Called when the foreground service reaches its timeout limit (Android 15+)
   * Location services have a ~6 hour timeout on Android 15
   *
   * Strategy: Emit warning event and restart the service to reset the timeout
   */
  override fun onTimeout(startId: Int, fgsType: Int) {
    super.onTimeout(startId, fgsType)
    android.util.Log.w("LocationService", "Foreground service timeout reached for type: $fgsType, startId: $startId")

    currentTripId?.let { tripId ->
      // Emit warning event to React Native
      emitServiceWarning(tripId, "SERVICE_TIMEOUT", "Location service reached Android timeout limit. Restarting automatically...")

      // Save current state before restart
      val savedTripId = tripId
      val savedOptions = trackingOptions

      // Stop location updates before restart
      fusedLocationClient.removeLocationUpdates(locationCallback)

      // Schedule restart via Handler to avoid blocking the timeout callback
      Handler(Looper.getMainLooper()).postDelayed({
        android.util.Log.d("LocationService", "Restarting service after timeout for tripId: $savedTripId")
        startService(applicationContext, savedTripId, savedOptions)
      }, 1000)

      // Stop this instance - the new one will take over
      stopSelf(startId)
    } ?: run {
      // No tripId - just stop
      android.util.Log.w("LocationService", "No tripId during timeout - stopping service")
      stopSelf(startId)
    }
  }

  /**
   * Called when the user swipes the app from recents
   * Service continues running because android:stopWithTask="false" in manifest
   */
  override fun onTaskRemoved(rootIntent: Intent?) {
    super.onTaskRemoved(rootIntent)
    android.util.Log.d("LocationService", "Task removed - service continuing in background")

    currentTripId?.let { tripId ->
      emitServiceWarning(tripId, "TASK_REMOVED", "App was removed from recents. Location tracking continues in background.")
    }

    // Service continues because android:stopWithTask="false"
    // Location updates will continue
  }

  /**
   * Emits a warning event using broadcaster
   */
  private fun emitServiceWarning(tripId: String, warningType: String, message: String) {
    LocationEventBroadcaster.broadcastWarning(
      this,
      tripId,
      warningType,
      message
    )
    android.util.Log.d("LocationService", "Warning event broadcast sent: $warningType")
  }

  @SuppressLint("MissingPermission")
  private fun checkLastKnownLocation() {
    try {
      android.util.Log.d("LocationService", "Checking last known location...")
      fusedLocationClient.lastLocation.addOnSuccessListener { location ->
        if (location != null) {
          android.util.Log.d("LocationService", "Last known location: lat=${location.latitude}, lng=${location.longitude}")
        } else {
          android.util.Log.w("LocationService", "Last known location is NULL - GPS may not have a fix yet")
        }
      }.addOnFailureListener { e ->
        android.util.Log.e("LocationService", "Failed to get last known location", e)
      }
    } catch (e: Exception) {
      android.util.Log.e("LocationService", "Exception checking last known location", e)
    }
  }
  
  @SuppressLint("MissingPermission")
  private fun startLocationUpdates() {
    val priority = when (trackingOptions.getAccuracyOrDefault()) {
      LocationAccuracy.HIGH_ACCURACY -> Priority.PRIORITY_HIGH_ACCURACY
      LocationAccuracy.BALANCED_POWER_ACCURACY -> Priority.PRIORITY_BALANCED_POWER_ACCURACY
      LocationAccuracy.LOW_POWER -> Priority.PRIORITY_LOW_POWER
      LocationAccuracy.NO_POWER -> Priority.PRIORITY_LOW_POWER // NO_POWER is deprecated, use LOW_POWER instead
      LocationAccuracy.PASSIVE -> Priority.PRIORITY_PASSIVE
    }

    val updateInterval = trackingOptions.getUpdateIntervalOrDefault()
    val fastestInterval = trackingOptions.getFastestIntervalOrDefault()
    val maxWaitTime = trackingOptions.getMaxWaitTimeOrDefault()
    
    android.util.Log.d("LocationService", "Starting location updates with:")
    android.util.Log.d("LocationService", "  Priority: $priority")
    android.util.Log.d("LocationService", "  Update Interval: ${updateInterval}ms")
    android.util.Log.d("LocationService", "  Fastest Interval: ${fastestInterval}ms")
    android.util.Log.d("LocationService", "  Max Wait Time: ${maxWaitTime}ms")

    val locationRequest = LocationRequest.Builder(
      priority,
      updateInterval
    ).apply {
      setMinUpdateIntervalMillis(fastestInterval)
      setMaxUpdateDelayMillis(maxWaitTime)
      setWaitForAccurateLocation(trackingOptions.getWaitForAccurateLocationOrDefault())
    }.build()

    try {
      android.util.Log.d("LocationService", "Requesting location updates...")
      fusedLocationClient.requestLocationUpdates(
        locationRequest,
        locationCallback,
        Looper.getMainLooper()
      ).addOnSuccessListener {
        android.util.Log.d("LocationService", "Location updates request SUCCESS")
      }.addOnFailureListener { e ->
        android.util.Log.e("LocationService", "Location updates request FAILED", e)
        stopSelf()
      }
    } catch (e: SecurityException) {
      android.util.Log.e("LocationService", "SecurityException when requesting location updates", e)
      e.printStackTrace()
      stopSelf()
    } catch (e: Exception) {
      android.util.Log.e("LocationService", "Exception when requesting location updates", e)
      e.printStackTrace()
    }
  }

  private fun setupLocationCallback() {
    locationCallback = object : LocationCallback() {
      override fun onLocationResult(locationResult: LocationResult) {
        // Validate permissions are still granted before processing locations
        if (!validatePermissions()) {
          android.util.Log.e("LocationService", "Location permissions revoked during tracking")
          emitPermissionRevokedError()
          stopSelf()
          return
        }

        android.util.Log.d("LocationService", "Received ${locationResult.locations.size} location(s)")
        locationResult.locations.forEach { location ->
          handleLocation(location)
        }
      }

      override fun onLocationAvailability(availability: LocationAvailability) {
        if (!availability.isLocationAvailable) {
          android.util.Log.w("LocationService", "Location not available")
          emitLocationUnavailableWarning()
        }
      }
    }
  }

  /**
   * Validates that location permissions are still granted
   */
  private fun validatePermissions(): Boolean {
    val fineLocation = ContextCompat.checkSelfPermission(
      this,
      Manifest.permission.ACCESS_FINE_LOCATION
    ) == PackageManager.PERMISSION_GRANTED

    return fineLocation
  }

  /**
   * Emits error event when permissions are revoked during tracking
   */
  private fun emitPermissionRevokedError() {
    LocationEventBroadcaster.broadcastError(
      this,
      currentTripId,
      "PERMISSION_REVOKED",
      "Location permission was revoked. Tracking stopped."
    )
    android.util.Log.d("LocationService", "Permission revoked error broadcast sent")
  }

  /**
   * Emits warning when location becomes unavailable
   */
  private fun emitLocationUnavailableWarning() {
    emitServiceWarning(
      currentTripId ?: return,
      "LOCATION_UNAVAILABLE",
      "GPS signal lost or location services disabled."
    )
  }

  private fun handleLocation(location: Location) {
    android.util.Log.d("LocationService", "Handling location: lat=${location.latitude}, lng=${location.longitude}, tripId=$currentTripId")
    currentTripId?.let { tripId ->
      // Extract all available location data
      val accuracy = if (location.hasAccuracy()) location.accuracy else null
      val altitude = if (location.hasAltitude()) location.altitude else null
      val speed = if (location.hasSpeed()) location.speed else null
      val bearing = if (location.hasBearing()) location.bearing else null
      
      // API 26+ fields - check if values are valid (not NaN)
      val verticalAccuracyMeters = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        val value = location.verticalAccuracyMeters
        if (!value.isNaN()) value else null
      } else null
      
      val speedAccuracyMetersPerSecond = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        val value = location.speedAccuracyMetersPerSecond
        if (!value.isNaN()) value else null
      } else null
      
      val bearingAccuracyDegrees = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        val value = location.bearingAccuracyDegrees
        if (!value.isNaN()) value else null
      } else null
      
      val elapsedRealtimeNanos = location.elapsedRealtimeNanos
      val provider = location.provider
      
      // API 18+ field
      val isFromMockProvider = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN_MR2) {
        location.isFromMockProvider
      } else null
      
      storage.saveLocation(
        tripId = tripId,
        latitude = location.latitude,
        longitude = location.longitude,
        timestamp = location.time,
        accuracy = accuracy,
        altitude = altitude,
        speed = speed,
        bearing = bearing,
        verticalAccuracyMeters = verticalAccuracyMeters,
        speedAccuracyMetersPerSecond = speedAccuracyMetersPerSecond,
        bearingAccuracyDegrees = bearingAccuracyDegrees,
        elapsedRealtimeNanos = elapsedRealtimeNanos,
        provider = provider,
        isFromMockProvider = isFromMockProvider
      )
      
      // Emit location update event to React Native
      sendLocationUpdateEvent(tripId, location)
    }
  }
  
  /**
   * Sends a location update event using broadcaster
   */
  private fun sendLocationUpdateEvent(tripId: String, location: Location) {
    val locationBundle = LocationEventBroadcaster.locationToBundle(location)
    LocationEventBroadcaster.broadcastLocationUpdate(this, tripId, locationBundle)
    android.util.Log.d("LocationService", "Location broadcast sent for tripId: $tripId")
  }
  

  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val importance = when (trackingOptions.getNotificationPriorityOrDefault()) {
        "LOW" -> NotificationManager.IMPORTANCE_LOW
        "DEFAULT" -> NotificationManager.IMPORTANCE_DEFAULT
        "HIGH" -> NotificationManager.IMPORTANCE_HIGH
        "MAX" -> NotificationManager.IMPORTANCE_HIGH
        else -> NotificationManager.IMPORTANCE_LOW
      }

      val channel = NotificationChannel(
        CHANNEL_ID,
        trackingOptions.getNotificationChannelNameOrDefault(),
        importance
      ).apply {
        description = "Background location tracking"
        setShowBadge(false)
      }

      val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      notificationManager.createNotificationChannel(channel)
    }
  }

  private fun createNotification(): Notification {
    val notificationIntent = packageManager.getLaunchIntentForPackage(packageName)
    val pendingIntent = PendingIntent.getActivity(
      this,
      0,
      notificationIntent,
      PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
    )

    val priority = when (trackingOptions.getNotificationPriorityOrDefault()) {
      "LOW" -> NotificationCompat.PRIORITY_LOW
      "DEFAULT" -> NotificationCompat.PRIORITY_DEFAULT
      "HIGH" -> NotificationCompat.PRIORITY_HIGH
      "MAX" -> NotificationCompat.PRIORITY_MAX
      else -> NotificationCompat.PRIORITY_LOW
    }

    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle(trackingOptions.getNotificationTitleOrDefault())
      .setContentText(trackingOptions.getNotificationTextOrDefault())
      .setSmallIcon(android.R.drawable.ic_menu_mylocation)
      .setContentIntent(pendingIntent)
      .setOngoing(true)
      .setPriority(priority)
      .build()
  }

  override fun onDestroy() {
    super.onDestroy()

    // Clear restart counter on clean shutdown
    getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .edit()
      .putInt(KEY_RESTART_COUNT, 0)
      .apply()

    fusedLocationClient.removeLocationUpdates(locationCallback)
  }

  /**
   * Detects if service is restarting too frequently (potential crash loop)
   */
  private fun isRestartLoopDetected(): Boolean {
    val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val restartCount = prefs.getInt(KEY_RESTART_COUNT, 0)
    val lastRestartTime = prefs.getLong(KEY_LAST_RESTART_TIME, 0)
    val now = System.currentTimeMillis()

    // Reset counter if outside window
    if (now - lastRestartTime > RESTART_WINDOW_MS) {
      return false
    }

    return restartCount >= MAX_RESTARTS_PER_HOUR
  }

  /**
   * Records this service start for restart loop detection
   */
  private fun recordServiceStart() {
    val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val lastRestartTime = prefs.getLong(KEY_LAST_RESTART_TIME, 0)
    val now = System.currentTimeMillis()

    val newCount = if (now - lastRestartTime > RESTART_WINDOW_MS) {
      1 // Reset counter
    } else {
      prefs.getInt(KEY_RESTART_COUNT, 0) + 1
    }

    prefs.edit()
      .putInt(KEY_RESTART_COUNT, newCount)
      .putLong(KEY_LAST_RESTART_TIME, now)
      .apply()

    android.util.Log.d("LocationService", "Service start recorded: count=$newCount")
  }

  override fun onBind(intent: Intent?): IBinder? = null

  companion object {
    const val EXTRA_TRIP_ID = "trip_id"
    const val EXTRA_TRACKING_OPTIONS = "tracking_options"
    private const val NOTIFICATION_ID = 1
    private const val CHANNEL_ID = "background_location_channel"

    // Restart loop detection constants
    private const val PREFS_NAME = "location_service_prefs"
    private const val KEY_RESTART_COUNT = "restart_count"
    private const val KEY_LAST_RESTART_TIME = "last_restart_time"
    private const val MAX_RESTARTS_PER_HOUR = 5
    private const val RESTART_WINDOW_MS = 3600000L // 1 hour

    /**
     * Starts the location service for a specific trip with options
     */
    fun startService(context: Context, tripId: String, options: TrackingOptions = TrackingOptions()) {
      val optionsBundle = android.os.Bundle().apply {
        if (options.updateInterval != null) putLong("updateInterval", options.updateInterval)
        if (options.fastestInterval != null) putLong("fastestInterval", options.fastestInterval)
        if (options.maxWaitTime != null) putLong("maxWaitTime", options.maxWaitTime)
        if (options.accuracy != null) putString("accuracy", options.accuracy.value)
        if (options.waitForAccurateLocation != null) putBoolean("waitForAccurateLocation", options.waitForAccurateLocation)
        if (options.notificationTitle != null) putString("notificationTitle", options.notificationTitle)
        if (options.notificationText != null) putString("notificationText", options.notificationText)
        if (options.notificationChannelName != null) putString("notificationChannelName", options.notificationChannelName)
        if (options.notificationPriority != null) putString("notificationPriority", options.notificationPriority)
        if (options.foregroundOnly != null) putBoolean("foregroundOnly", options.foregroundOnly)
      }

      val intent = Intent(context, LocationService::class.java).apply {
        putExtra(EXTRA_TRIP_ID, tripId)
        putExtra(EXTRA_TRACKING_OPTIONS, optionsBundle)
      }
      
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
    }

    /**
     * Stops the location service
     */
    fun stopService(context: Context) {
      val intent = Intent(context, LocationService::class.java)
      context.stopService(intent)
    }
  }
}

