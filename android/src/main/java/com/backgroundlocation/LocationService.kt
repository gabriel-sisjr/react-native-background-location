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
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
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
  private var reactContext: ReactContext? = null
  private var trackingOptions: TrackingOptions = TrackingOptions()

  override fun onCreate() {
    super.onCreate()
    serviceInstance = this
    fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
    storage = LocationStorage(this)
    
    setupLocationCallback()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    android.util.Log.d("LocationService", "onStartCommand called")
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

    // Return START_STICKY so the service is restarted if killed by system
    return START_STICKY
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
   * Emits a warning event to React Native
   */
  private fun emitServiceWarning(tripId: String, warningType: String, message: String) {
    val context = reactContext ?: return

    if (!context.hasActiveReactInstance()) {
      android.util.Log.w("LocationService", "React instance not active - cannot emit warning event")
      return
    }

    try {
      val eventData = Arguments.createMap().apply {
        putString("tripId", tripId)
        putString("type", warningType)
        putString("message", message)
        putDouble("timestamp", System.currentTimeMillis().toDouble())
      }

      context
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit("onLocationWarning", eventData)

      android.util.Log.d("LocationService", "Warning event emitted: $warningType")
    } catch (e: Exception) {
      android.util.Log.e("LocationService", "Failed to emit warning event", e)
    }
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
    val context = reactContext ?: return

    if (!context.hasActiveReactInstance()) {
      android.util.Log.w("LocationService", "React instance not active - cannot emit permission error")
      return
    }

    try {
      val eventData = Arguments.createMap().apply {
        putString("tripId", currentTripId)
        putString("type", "PERMISSION_REVOKED")
        putString("message", "Location permission was revoked. Tracking stopped.")
        putDouble("timestamp", System.currentTimeMillis().toDouble())
      }

      context
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit("onLocationError", eventData)

      android.util.Log.d("LocationService", "Permission revoked error emitted")
    } catch (e: Exception) {
      android.util.Log.e("LocationService", "Failed to emit permission error", e)
    }
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
   * Sends a location update event to React Native with extended location data
   */
  private fun sendLocationUpdateEvent(tripId: String, location: Location) {
    val context = reactContext
    if (context == null) {
      android.util.Log.w("LocationService", "React context not available - cannot emit location update event")
      return
    }
    
    try {
      // Check if the catalyst instance is active
      if (!context.hasActiveReactInstance()) {
        android.util.Log.w("LocationService", "React instance not active - skipping location update event")
        return
      }
      
      val eventData = createLocationMap(tripId, location)
      
      context
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit("onLocationUpdate", eventData)
        
      android.util.Log.d("LocationService", "Location update event emitted for tripId: $tripId")
    } catch (e: Exception) {
      // React Native context may not be available yet or JS thread might be busy
      android.util.Log.e("LocationService", "Failed to emit location update event", e)
    }
  }
  
  /**
   * Creates a WritableMap with all available location data
   */
  private fun createLocationMap(tripId: String, location: Location): WritableMap {
    val map = Arguments.createMap().apply {
      putString("tripId", tripId)
      putString("latitude", location.latitude.toString())
      putString("longitude", location.longitude.toString())
      putDouble("timestamp", location.time.toDouble())
      
      // Add optional fields if available
      if (location.hasAccuracy()) {
        putDouble("accuracy", location.accuracy.toDouble())
      }
      if (location.hasAltitude()) {
        putDouble("altitude", location.altitude)
      }
      if (location.hasSpeed()) {
        putDouble("speed", location.speed.toDouble())
      }
      if (location.hasBearing()) {
        putDouble("bearing", location.bearing.toDouble())
      }
      
      // API 26+ fields - check if values are valid (not NaN)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        val verticalAccuracy = location.verticalAccuracyMeters
        if (!verticalAccuracy.isNaN()) {
          putDouble("verticalAccuracyMeters", verticalAccuracy.toDouble())
        }
        
        val speedAccuracy = location.speedAccuracyMetersPerSecond
        if (!speedAccuracy.isNaN()) {
          putDouble("speedAccuracyMetersPerSecond", speedAccuracy.toDouble())
        }
        
        val bearingAccuracy = location.bearingAccuracyDegrees
        if (!bearingAccuracy.isNaN()) {
          putDouble("bearingAccuracyDegrees", bearingAccuracy.toDouble())
        }
      }
      
      // Always available fields
      putDouble("elapsedRealtimeNanos", location.elapsedRealtimeNanos.toDouble())
      location.provider?.let { putString("provider", it) }
      
      // API 18+ field
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN_MR2) {
        putBoolean("isFromMockProvider", location.isFromMockProvider)
      }
    }
    return map
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
    fusedLocationClient.removeLocationUpdates(locationCallback)
    if (serviceInstance == this) {
      serviceInstance = null
    }
  }

  override fun onBind(intent: Intent?): IBinder? = null

  companion object {
    const val EXTRA_TRIP_ID = "trip_id"
    const val EXTRA_TRACKING_OPTIONS = "tracking_options"
    private const val NOTIFICATION_ID = 1
    private const val CHANNEL_ID = "background_location_channel"

    // Store the service instance to allow setting ReactContext
    private var serviceInstance: LocationService? = null

    /**
     * Sets the React Context for event emission
     */
    fun setReactContext(context: ReactContext?) {
      android.util.Log.d("LocationService", "Setting React context: ${context != null}")
      serviceInstance?.reactContext = context
    }

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

