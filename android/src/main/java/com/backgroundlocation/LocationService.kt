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
import com.backgroundlocation.provider.LocationProvider
import com.backgroundlocation.provider.LocationProviderFactory
import com.backgroundlocation.provider.LocationUpdateCallback
import com.backgroundlocation.processor.LocationProcessor
import com.backgroundlocation.processor.DefaultLocationProcessor

/**
 * Foreground service that handles background location tracking
 * Continues to collect location updates even when app is in background
 */
class LocationService : Service() {

  private lateinit var locationProvider: LocationProvider
  private var locationProcessor: LocationProcessor = DefaultLocationProcessor()
  private lateinit var storage: LocationStorage
  private var currentTripId: String? = null
  private var trackingOptions: TrackingOptions = TrackingOptions()

  // Flag to prevent location events after stop is requested
  @Volatile
  private var isStopRequested: Boolean = false

  override fun onCreate() {
    super.onCreate()
    storage = LocationStorage(this)

    // Mark service as running
    isRunning = true

    // Register this instance for immediate stop access
    synchronized(instanceLock) {
      activeInstance = this
    }

    // Use factory to get best available provider
    locationProvider = LocationProviderFactory.create(this)
    android.util.Log.d("LocationService", "Location provider initialized")
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    android.util.Log.d("LocationService", "onStartCommand called")

    // CRITICAL: Call startForeground() IMMEDIATELY to avoid ForegroundServiceDidNotStartInTimeException
    // This must happen within 5-10 seconds on Android 12+ (API 31+)
    // We create a minimal notification first, then update it with proper options
    try {
      val minimalNotification = createMinimalNotification()
      startForegroundWithType(minimalNotification)
      android.util.Log.d("LocationService", "Started foreground service immediately with minimal notification")
    } catch (e: Exception) {
      android.util.Log.e("LocationService", "CRITICAL: Failed to call startForeground()", e)
      stopSelf()
      return START_NOT_STICKY
    }

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

    // Now that we have options, create proper notification channel and update notification
    try {
      createNotificationChannel()
      val properNotification = createNotification()
      startForegroundWithType(properNotification)
      android.util.Log.d("LocationService", "Updated foreground notification with proper options")
    } catch (e: Exception) {
      android.util.Log.e("LocationService", "Failed to update notification, continuing with minimal", e)
    }

    // Check last known location to verify GPS is working
    checkLastKnownLocation()

    // Start location updates
    startLocationUpdates()

    // Use START_REDELIVER_INTENT for more predictable restart behavior
    // If killed, system will redeliver the original intent
    return START_REDELIVER_INTENT
  }

  /**
   * Parses TrackingOptions from Bundle.
   * Notification settings are stored as a single JSON string under `notificationOptions`.
   */
  private fun parseTrackingOptionsFromBundle(bundle: android.os.Bundle): TrackingOptions {
    val accuracyString = bundle.getString("accuracy")

    val notificationOptions = bundle.getString("notificationOptions")?.let { jsonString ->
      try {
        NotificationOptions.fromJsonString(jsonString)
      } catch (e: Exception) {
        android.util.Log.w("LocationService", "Failed to parse notificationOptions from Bundle", e)
        null
      }
    }

    return TrackingOptions(
      updateInterval = if (bundle.containsKey("updateInterval")) bundle.getLong("updateInterval") else null,
      fastestInterval = if (bundle.containsKey("fastestInterval")) bundle.getLong("fastestInterval") else null,
      maxWaitTime = if (bundle.containsKey("maxWaitTime")) bundle.getLong("maxWaitTime") else null,
      accuracy = LocationAccuracy.fromString(accuracyString),
      waitForAccurateLocation = if (bundle.containsKey("waitForAccurateLocation")) bundle.getBoolean("waitForAccurateLocation") else null,
      foregroundOnly = if (bundle.containsKey("foregroundOnly")) bundle.getBoolean("foregroundOnly") else null,
      distanceFilter = if (bundle.containsKey("distanceFilter")) bundle.getFloat("distanceFilter") else null,
      notificationOptions = notificationOptions
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
      locationProvider.removeLocationUpdates()

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
   * Emits a warning event via SharedFlow
   */
  private fun emitServiceWarning(tripId: String, warningType: String, message: String) {
    LocationEventBroadcaster.broadcastWarning(
      tripId,
      warningType,
      message
    )
    android.util.Log.d("LocationService", "Warning event emitted: $warningType")
  }

  @SuppressLint("MissingPermission")
  private fun checkLastKnownLocation() {
    try {
      android.util.Log.d("LocationService", "Checking last known location...")
      locationProvider.getLastLocation { location ->
        if (location != null) {
          android.util.Log.d("LocationService", "Last known location: lat=${location.latitude}, lng=${location.longitude}")
        } else {
          android.util.Log.w("LocationService", "Last known location is NULL - GPS may not have a fix yet")
        }
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
    val distanceFilter = trackingOptions.getDistanceFilterOrDefault()

    android.util.Log.d("LocationService", "Starting location updates with:")
    android.util.Log.d("LocationService", "  Priority: $priority")
    android.util.Log.d("LocationService", "  Update Interval: ${updateInterval}ms")
    android.util.Log.d("LocationService", "  Fastest Interval: ${fastestInterval}ms")
    android.util.Log.d("LocationService", "  Distance Filter: ${distanceFilter}m")

    try {
      android.util.Log.d("LocationService", "Requesting location updates...")
      locationProvider.requestLocationUpdates(
        updateInterval,
        fastestInterval,
        priority,
        distanceFilter,
        object : LocationUpdateCallback {
          override fun onLocationUpdate(location: Location) {
            handleSingleLocation(location)
          }

          override fun onLocationBatch(locations: List<Location>) {
            android.util.Log.d("LocationService", "Received batch of ${locations.size} locations")
            locationProcessor.onLocationBatch(locations)
            locations.forEach { handleSingleLocation(it) }
          }

          override fun onLocationAvailabilityChanged(available: Boolean) {
            if (!available) {
              android.util.Log.w("LocationService", "Location not available")
              emitLocationUnavailableWarning()
            }
          }

          override fun onError(error: Exception) {
            android.util.Log.e("LocationService", "Location provider error", error)
            LocationEventBroadcaster.broadcastError(
              currentTripId,
              "PROVIDER_ERROR",
              error.message ?: "Unknown location provider error"
            )
            stopSelf()
          }
        }
      )
      android.util.Log.d("LocationService", "Location updates request submitted")
    } catch (e: SecurityException) {
      android.util.Log.e("LocationService", "SecurityException when requesting location updates", e)
      e.printStackTrace()
      stopSelf()
    } catch (e: Exception) {
      android.util.Log.e("LocationService", "Exception when requesting location updates", e)
      e.printStackTrace()
    }
  }

  /**
   * Handles a single location update with processor filtering
   */
  private fun handleSingleLocation(location: Location) {
    // Validate permissions are still granted before processing locations
    if (!validatePermissions()) {
      android.util.Log.e("LocationService", "Location permissions revoked during tracking")
      emitPermissionRevokedError()
      stopSelf()
      return
    }

    // Apply processor filtering
    if (!locationProcessor.shouldStore(location)) {
      android.util.Log.d("LocationService", "Location filtered by processor")
      return
    }

    // Apply processor transformation
    val processedLocation = locationProcessor.process(location)

    // Handle the processed location
    handleLocation(processedLocation)
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
      currentTripId,
      "PERMISSION_REVOKED",
      "Location permission was revoked. Tracking stopped."
    )
    android.util.Log.d("LocationService", "Permission revoked error emitted")
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
    // CRITICAL: Check if stop was requested - prevent location events after stopTracking()
    if (isStopRequested) {
      android.util.Log.d("LocationService", "Stop requested - ignoring location update")
      return
    }

    // Also check the global stop token for extra safety
    if (isStopTokenSet(this)) {
      android.util.Log.d("LocationService", "Stop token set - ignoring location update")
      isStopRequested = true // Cache locally to avoid repeated SharedPreferences reads
      return
    }

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
   * Sends a location update event via SharedFlow
   */
  private fun sendLocationUpdateEvent(tripId: String, location: Location) {
    val locationBundle = LocationEventBroadcaster.locationToBundle(location)
    LocationEventBroadcaster.broadcastLocationUpdate(tripId, locationBundle)
    android.util.Log.d("LocationService", "Location event emitted for tripId: $tripId")
  }
  

  /**
   * Creates a minimal notification for immediate startForeground() call
   * This ensures we meet the 5-10 second deadline on Android 12+
   */
  private fun createMinimalNotification(): Notification {
    // Create minimal notification channel if needed
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      if (notificationManager.getNotificationChannel(CHANNEL_ID) == null) {
        val channel = NotificationChannel(
          CHANNEL_ID,
          "Background Location",
          NotificationManager.IMPORTANCE_LOW
        ).apply {
          description = "Background location tracking"
          setShowBadge(false)
        }
        notificationManager.createNotificationChannel(channel)
      }
    }

    val smallIcon = NotificationDefaults.getSmallIcon(this)

    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle("Location Tracking")
      .setContentText("Starting location tracking...")
      .setSmallIcon(smallIcon)
      .setOngoing(true)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .build()
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

      val effectiveChannelId = trackingOptions.notificationChannelId ?: CHANNEL_ID

      val channel = NotificationChannel(
        effectiveChannelId,
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

    // Resolve small icon: runtime override -> manifest meta-data -> convention -> system default
    val smallIconResId = NotificationDefaults.getSmallIcon(this, trackingOptions.notificationSmallIcon)

    val effectiveChannelId = trackingOptions.notificationChannelId ?: CHANNEL_ID

    val builder = NotificationCompat.Builder(this, effectiveChannelId)
      .setContentTitle(trackingOptions.getNotificationTitleOrDefault())
      .setContentText(trackingOptions.getNotificationTextOrDefault())
      .setSmallIcon(smallIconResId)
      .setContentIntent(pendingIntent)
      .setOngoing(true)
      .setPriority(priority)
      .setShowWhen(trackingOptions.getNotificationShowTimestampOrDefault())

    // Apply notification color: runtime override -> manifest meta-data -> none
    NotificationDefaults.getColor(this, trackingOptions.notificationColor)?.let { color ->
      builder.setColor(color)
    }

    // Apply large icon: runtime override -> manifest meta-data -> convention -> none
    NotificationDefaults.getLargeIcon(this, trackingOptions.notificationLargeIcon)?.let { bitmap ->
      builder.setLargeIcon(bitmap)
    }

    // Apply subtext if provided
    trackingOptions.notificationSubtext?.let { subtext ->
      builder.setSubText(subtext)
    }

    // Add notification action buttons (max 3)
    trackingOptions.notificationActions?.let { actionsJson ->
      try {
        val actions = org.json.JSONArray(actionsJson)
        val count = minOf(actions.length(), 3)
        for (i in 0 until count) {
          val action = actions.getJSONObject(i)
          val actionId = action.getString("id")
          val actionLabel = action.getString("label")

          val actionIntent = Intent(this, NotificationActionReceiver::class.java).apply {
            this.action = NotificationActionReceiver.ACTION_NOTIFICATION_BUTTON
            putExtra(NotificationActionReceiver.EXTRA_TRIP_ID, currentTripId)
            putExtra(NotificationActionReceiver.EXTRA_ACTION_ID, actionId)
          }
          val actionPendingIntent = PendingIntent.getBroadcast(
            this,
            actionId.hashCode(),
            actionIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
          )
          builder.addAction(0, actionLabel, actionPendingIntent)
        }
        android.util.Log.d("LocationService", "Added $count notification action(s)")
      } catch (e: Exception) {
        android.util.Log.w("LocationService", "Failed to parse notification actions JSON", e)
      }
    }

    return builder.build()
  }

  override fun onDestroy() {
    super.onDestroy()

    // Mark service as no longer running
    isRunning = false

    // Clear active instance reference
    synchronized(instanceLock) {
      if (activeInstance === this) {
        activeInstance = null
      }
    }

    // Clear restart counter on clean shutdown
    getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .edit()
      .putInt(KEY_RESTART_COUNT, 0)
      .apply()

    // Cleanup location provider
    locationProvider.cleanup()
    android.util.Log.d("LocationService", "Location provider cleaned up")
  }

  /**
   * Updates the notification content while tracking is active
   * Merges new title/text into trackingOptions, rebuilds and re-posts the notification
   * Does NOT recreate the notification channel
   * Does NOT persist to database - dynamic updates are transient
   */
  internal fun updateNotificationContent(title: String, text: String) {
    trackingOptions = trackingOptions.copy(
      notificationOptions = (trackingOptions.notificationOptions ?: NotificationOptions()).copy(
        title = title,
        text = text
      )
    )

    try {
      val updatedNotification = createNotification()
      val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      notificationManager.notify(NOTIFICATION_ID, updatedNotification)
      android.util.Log.d("LocationService", "Notification updated: title='$title', text='$text'")
    } catch (e: Exception) {
      android.util.Log.e("LocationService", "Failed to update notification", e)
    }
  }

  /**
   * Immediately stops location updates without waiting for service destruction
   * Called from static method when stopTracking is invoked
   */
  internal fun stopLocationUpdatesImmediately() {
    android.util.Log.d("LocationService", "Stopping location updates immediately")
    isStopRequested = true
    locationProvider.removeLocationUpdates()
    android.util.Log.d("LocationService", "Location updates stopped immediately")
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

    /** Indicates whether the foreground location service is currently running */
    @Volatile
    var isRunning: Boolean = false
      private set

    // Restart loop detection constants
    private const val PREFS_NAME = "location_service_prefs"
    private const val KEY_RESTART_COUNT = "restart_count"
    private const val KEY_LAST_RESTART_TIME = "last_restart_time"
    private const val MAX_RESTARTS_PER_HOUR = 5
    private const val RESTART_WINDOW_MS = 3600000L // 1 hour

    // Stop token - prevents RecoveryWorker from restarting after explicit stop
    private const val KEY_STOP_TOKEN = "stop_token"
    private const val KEY_STOP_TOKEN_TIMESTAMP = "stop_token_timestamp"
    private const val STOP_TOKEN_VALIDITY_MS = 60000L // Token valid for 60 seconds

    // Reference to active service instance for immediate stop
    private val instanceLock = Any()
    @Volatile
    private var activeInstance: LocationService? = null

    /**
     * Sets a stop token to prevent RecoveryWorker from restarting tracking
     * Uses SharedPreferences for synchronous, cross-process communication
     */
    fun setStopToken(context: Context) {
      context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        .edit()
        .putBoolean(KEY_STOP_TOKEN, true)
        .putLong(KEY_STOP_TOKEN_TIMESTAMP, System.currentTimeMillis())
        .commit() // Use commit() for synchronous write
      android.util.Log.d("LocationService", "Stop token set")
    }

    /**
     * Clears the stop token (called when starting new tracking session)
     */
    fun clearStopToken(context: Context) {
      context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        .edit()
        .putBoolean(KEY_STOP_TOKEN, false)
        .remove(KEY_STOP_TOKEN_TIMESTAMP)
        .commit()
      android.util.Log.d("LocationService", "Stop token cleared")
    }

    /**
     * Checks if stop token is set and still valid
     */
    fun isStopTokenSet(context: Context): Boolean {
      val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      val isSet = prefs.getBoolean(KEY_STOP_TOKEN, false)
      if (!isSet) return false

      // Check if token has expired
      val timestamp = prefs.getLong(KEY_STOP_TOKEN_TIMESTAMP, 0)
      val elapsed = System.currentTimeMillis() - timestamp
      return elapsed < STOP_TOKEN_VALIDITY_MS
    }

    /**
     * Updates the notification on the active service instance
     * Returns true if an active instance was found and updated, false otherwise
     */
    fun updateNotification(title: String, text: String): Boolean {
      synchronized(instanceLock) {
        return activeInstance?.let { service ->
          service.updateNotificationContent(title, text)
          android.util.Log.d("LocationService", "Called updateNotification on active instance")
          true
        } ?: run {
          android.util.Log.d("LocationService", "No active instance to update notification")
          false
        }
      }
    }

    /**
     * Immediately stops location updates on the active service instance
     * This is called BEFORE stopService() to ensure immediate cessation of location tracking
     */
    fun stopLocationUpdatesImmediately(context: Context) {
      synchronized(instanceLock) {
        activeInstance?.let { service ->
          service.stopLocationUpdatesImmediately()
          android.util.Log.d("LocationService", "Called immediate stop on active instance")
        } ?: run {
          android.util.Log.d("LocationService", "No active instance to stop")
        }
      }
    }

    /**
     * Starts the location service for a specific trip with options
     */
    fun startService(context: Context, tripId: String, options: TrackingOptions = TrackingOptions()) {
      // Clear stop token when starting new tracking
      clearStopToken(context)

      val optionsBundle = android.os.Bundle().apply {
        if (options.updateInterval != null) putLong("updateInterval", options.updateInterval)
        if (options.fastestInterval != null) putLong("fastestInterval", options.fastestInterval)
        if (options.maxWaitTime != null) putLong("maxWaitTime", options.maxWaitTime)
        if (options.accuracy != null) putString("accuracy", options.accuracy.value)
        if (options.waitForAccurateLocation != null) putBoolean("waitForAccurateLocation", options.waitForAccurateLocation)
        if (options.foregroundOnly != null) putBoolean("foregroundOnly", options.foregroundOnly)
        if (options.distanceFilter != null) putFloat("distanceFilter", options.distanceFilter)
        options.notificationOptions?.let { putString("notificationOptions", it.toJsonString()) }
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

