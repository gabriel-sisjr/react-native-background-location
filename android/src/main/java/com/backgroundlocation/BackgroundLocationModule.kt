package com.backgroundlocation

import android.Manifest
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.core.content.ContextCompat
import androidx.localbroadcastmanager.content.LocalBroadcastManager
import com.facebook.react.bridge.*
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.modules.core.DeviceEventManagerModule
import kotlinx.coroutines.*
import java.util.UUID

/**
 * TurboModule for background location tracking
 * Manages location collection sessions by tripId
 */
@ReactModule(name = BackgroundLocationModule.NAME)
class BackgroundLocationModule(reactContext: ReactApplicationContext) :
  NativeBackgroundLocationSpec(reactContext), LifecycleEventListener {

  private val storage: LocationStorage = LocationStorage(reactContext)
  private var broadcastReceiver: BroadcastReceiver? = null

  // Coroutine scope for async operations
  private val moduleScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

  init {
    reactContext.addLifecycleEventListener(this)
  }

  override fun initialize() {
    super.initialize()
    registerBroadcastReceiver()
  }

  override fun invalidate() {
    super.invalidate()
    unregisterBroadcastReceiver()
    storage.cleanup()
    moduleScope.cancel()
    reactApplicationContext.removeLifecycleEventListener(this)
  }

  // LifecycleEventListener implementation
  override fun onHostResume() {
    registerBroadcastReceiver()

    // Only schedule recovery if tracking is actually active
    // This prevents RecoveryWorker from starting SystemForegroundService when no tracking is active
    moduleScope.launch {
      try {
        // Check stop token first - if user explicitly stopped tracking, don't recover
        if (LocationService.isStopTokenSet(reactApplicationContext)) {
          android.util.Log.d("BackgroundLocationModule", "Stop token is set, skipping recovery")
          return@launch
        }

        val trackingState = storage.getTrackingStateAsync()
        if (!trackingState.isActive || trackingState.tripId == null) {
          android.util.Log.d("BackgroundLocationModule", "No active tracking session, skipping recovery")
          return@launch
        }

        // Double-check stop token after reading state (handles race condition)
        if (LocationService.isStopTokenSet(reactApplicationContext)) {
          android.util.Log.d("BackgroundLocationModule", "Stop token set during state check, skipping recovery")
          return@launch
        }

        // Schedule recovery via WorkManager on Android 12+ (safer for background restrictions)
        // On older versions, recover directly
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
          RecoveryWorker.scheduleRecovery(reactApplicationContext)
        } else {
          // Safe to recover directly on older Android versions
          recoverTrackingSession()
        }
      } catch (e: Exception) {
        android.util.Log.e("BackgroundLocationModule", "Failed to check tracking state for recovery", e)
      }
    }
  }

  override fun onHostPause() {
    // Keep receiver registered to not miss events
  }

  override fun onHostDestroy() {
    unregisterBroadcastReceiver()
  }

  private fun registerBroadcastReceiver() {
    if (broadcastReceiver != null) return

    broadcastReceiver = object : BroadcastReceiver() {
      override fun onReceive(context: Context?, intent: Intent?) {
        intent ?: return

        when (intent.action) {
          LocationEventBroadcaster.ACTION_LOCATION_UPDATE -> {
            handleLocationUpdate(intent)
          }
          LocationEventBroadcaster.ACTION_LOCATION_ERROR -> {
            handleLocationError(intent)
          }
          LocationEventBroadcaster.ACTION_LOCATION_WARNING -> {
            handleLocationWarning(intent)
          }
          LocationEventBroadcaster.ACTION_NOTIFICATION_ACTION -> {
            handleNotificationAction(intent)
          }
        }
      }
    }

    LocalBroadcastManager.getInstance(reactApplicationContext)
      .registerReceiver(broadcastReceiver!!, LocationEventBroadcaster.createIntentFilter())
  }

  private fun unregisterBroadcastReceiver() {
    broadcastReceiver?.let {
      LocalBroadcastManager.getInstance(reactApplicationContext).unregisterReceiver(it)
      broadcastReceiver = null
    }
  }

  private fun handleLocationUpdate(intent: Intent) {
    val tripId = intent.getStringExtra(LocationEventBroadcaster.EXTRA_TRIP_ID) ?: return
    val locationBundle = intent.getBundleExtra(LocationEventBroadcaster.EXTRA_LOCATION_DATA) ?: return

    if (!reactApplicationContext.hasActiveReactInstance()) return

    try {
      val eventData = LocationEventBroadcaster.bundleToWritableMap(tripId, locationBundle)
      reactApplicationContext
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit("onLocationUpdate", eventData)
    } catch (e: Exception) {
      android.util.Log.e("BackgroundLocationModule", "Failed to emit location update", e)
    }
  }

  private fun handleLocationError(intent: Intent) {
    val tripId = intent.getStringExtra(LocationEventBroadcaster.EXTRA_TRIP_ID)
    val errorType = intent.getStringExtra(LocationEventBroadcaster.EXTRA_ERROR_TYPE) ?: return
    val message = intent.getStringExtra(LocationEventBroadcaster.EXTRA_ERROR_MESSAGE) ?: return

    if (!reactApplicationContext.hasActiveReactInstance()) return

    try {
      val eventData = Arguments.createMap().apply {
        tripId?.let { putString("tripId", it) }
        putString("type", errorType)
        putString("message", message)
      }
      reactApplicationContext
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit("onLocationError", eventData)
    } catch (e: Exception) {
      android.util.Log.e("BackgroundLocationModule", "Failed to emit location error", e)
    }
  }

  private fun handleLocationWarning(intent: Intent) {
    val tripId = intent.getStringExtra(LocationEventBroadcaster.EXTRA_TRIP_ID)
    val warningType = intent.getStringExtra(LocationEventBroadcaster.EXTRA_ERROR_TYPE) ?: return
    val message = intent.getStringExtra(LocationEventBroadcaster.EXTRA_ERROR_MESSAGE) ?: return

    if (!reactApplicationContext.hasActiveReactInstance()) return

    try {
      val eventData = Arguments.createMap().apply {
        tripId?.let { putString("tripId", it) }
        putString("type", warningType)
        putString("message", message)
      }
      reactApplicationContext
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit("onLocationWarning", eventData)
    } catch (e: Exception) {
      android.util.Log.e("BackgroundLocationModule", "Failed to emit location warning", e)
    }
  }

  private fun handleNotificationAction(intent: Intent) {
    val tripId = intent.getStringExtra(LocationEventBroadcaster.EXTRA_TRIP_ID) ?: return
    val actionId = intent.getStringExtra(LocationEventBroadcaster.EXTRA_ACTION_ID) ?: return

    if (!reactApplicationContext.hasActiveReactInstance()) return

    try {
      val eventData = Arguments.createMap().apply {
        putString("tripId", tripId)
        putString("actionId", actionId)
      }
      reactApplicationContext
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit("onNotificationAction", eventData)
    } catch (e: Exception) {
      android.util.Log.e("BackgroundLocationModule", "Failed to emit notification action", e)
    }
  }

  override fun getName(): String = NAME

  /**
   * Starts location tracking for a specific trip
   * If tripId is null or empty, generates a new UUID
   * Returns the effective tripId being used
   */
  override fun startTracking(tripId: String?, options: ReadableMap?, promise: Promise) {
    try {
      // Parse options first to check foregroundOnly mode
      val trackingOptions = parseTrackingOptions(options)
      val foregroundOnly = trackingOptions.getForegroundOnlyOrDefault()

      // Check location permissions based on mode
      if (!hasLocationPermissions(foregroundOnly)) {
        val permissionMessage = if (foregroundOnly) {
          "Location permissions are required. Please grant ACCESS_FINE_LOCATION and ACCESS_COARSE_LOCATION permissions."
        } else {
          "Location permissions are required. Please grant ACCESS_FINE_LOCATION, ACCESS_COARSE_LOCATION, and ACCESS_BACKGROUND_LOCATION permissions."
        }
        promise.reject("PERMISSION_DENIED", permissionMessage)
        return
      }

      // Check notification permission for Android 13+
      if (!hasNotificationPermission()) {
        promise.reject(
          "NOTIFICATION_PERMISSION_DENIED",
          "Notification permission is required for background location tracking on Android 13+. Please grant POST_NOTIFICATIONS permission."
        )
        return
      }

      // Check if already tracking (async)
      moduleScope.launch {
        try {
          val trackingState = storage.getTrackingStateAsync()
          if (trackingState.isActive && trackingState.tripId != null) {
            // Already tracking - return current tripId (idempotent)
            promise.resolve(trackingState.tripId)
            return@launch
          }

          // Continue with tracking start logic
          startTrackingInternal(tripId, trackingOptions, promise)
        } catch (e: Exception) {
          promise.reject("START_TRACKING_ERROR", "Failed to start tracking: ${e.message}", e)
        }
      }
    } catch (e: Exception) {
      promise.reject("START_TRACKING_ERROR", "Failed to start tracking: ${e.message}", e)
    }
  }

  private suspend fun startTrackingInternal(
    tripId: String?,
    trackingOptions: TrackingOptions,
    promise: Promise
  ) {
    // Generate tripId if not provided
    val effectiveTripId = if (tripId.isNullOrBlank()) {
      UUID.randomUUID().toString()
    } else {
      tripId
    }

    // Save tracking state with options for recovery
    storage.saveTrackingState(effectiveTripId, true, trackingOptions)

    // Start the foreground service with options
    withContext(Dispatchers.Main) {
      val context = reactApplicationContext
      LocationService.startService(context, effectiveTripId, trackingOptions)
      promise.resolve(effectiveTripId)
    }
  }

  /**
   * Parses TrackingOptions from ReadableMap
   */
  private fun parseTrackingOptions(options: ReadableMap?): TrackingOptions {
    if (options == null) {
      return TrackingOptions()
    }

    val accuracyString = if (options.hasKey("accuracy")) options.getString("accuracy") else null
    return TrackingOptions(
      updateInterval = if (options.hasKey("updateInterval")) options.getDouble("updateInterval").toLong() else null,
      fastestInterval = if (options.hasKey("fastestInterval")) options.getDouble("fastestInterval").toLong() else null,
      maxWaitTime = if (options.hasKey("maxWaitTime")) options.getDouble("maxWaitTime").toLong() else null,
      accuracy = LocationAccuracy.fromString(accuracyString),
      waitForAccurateLocation = if (options.hasKey("waitForAccurateLocation")) options.getBoolean("waitForAccurateLocation") else null,
      notificationTitle = if (options.hasKey("notificationTitle")) options.getString("notificationTitle") else null,
      notificationText = if (options.hasKey("notificationText")) options.getString("notificationText") else null,
      notificationChannelName = if (options.hasKey("notificationChannelName")) options.getString("notificationChannelName") else null,
      notificationPriority = if (options.hasKey("notificationPriority")) options.getString("notificationPriority") else null,
      foregroundOnly = if (options.hasKey("foregroundOnly")) options.getBoolean("foregroundOnly") else null,
      distanceFilter = if (options.hasKey("distanceFilter")) options.getDouble("distanceFilter").toFloat() else null,
      notificationSmallIcon = if (options.hasKey("notificationSmallIcon")) options.getString("notificationSmallIcon") else null,
      notificationColor = if (options.hasKey("notificationColor")) options.getString("notificationColor") else null,
      notificationShowTimestamp = if (options.hasKey("notificationShowTimestamp")) options.getBoolean("notificationShowTimestamp") else null,
      notificationActions = if (options.hasKey("notificationActions")) options.getString("notificationActions") else null,
      notificationLargeIcon = if (options.hasKey("notificationLargeIcon")) options.getString("notificationLargeIcon") else null,
      notificationSubtext = if (options.hasKey("notificationSubtext")) options.getString("notificationSubtext") else null,
      notificationChannelId = if (options.hasKey("notificationChannelId")) options.getString("notificationChannelId") else null
    )
  }

  /**
   * Stops all location tracking and terminates the service
   * Uses a multi-step approach to ensure immediate cessation of location tracking:
   * 1. Set stop token (prevents RecoveryWorker from restarting)
   * 2. Cancel pending recovery work
   * 3. Immediately stop location updates on active instance
   * 4. Save tracking state synchronously (prevents race condition)
   * 5. Stop the service
   */
  override fun stopTracking(promise: Promise) {
    val context = reactApplicationContext

    // Use coroutine for async database operation
    moduleScope.launch {
      try {
        android.util.Log.d("BackgroundLocationModule", "stopTracking: Starting stop sequence")

        // Step 1: Set stop token FIRST (synchronous via SharedPreferences.commit())
        // This prevents RecoveryWorker from restarting tracking
        LocationService.setStopToken(context)

        // Step 2: Cancel any pending recovery work
        RecoveryWorker.cancelRecovery(context)

        // Step 3: Immediately stop location updates on active service instance
        // This is CRITICAL - stops broadcasts immediately without waiting for service destruction
        LocationService.stopLocationUpdatesImmediately(context)

        // Step 4: Save tracking state SYNCHRONOUSLY
        // This ensures the database is updated before RecoveryWorker can read stale state
        storage.saveTrackingStateSync(null, false)

        // Step 5: Now safe to stop the service
        withContext(Dispatchers.Main) {
          LocationService.stopService(context)
        }

        android.util.Log.d("BackgroundLocationModule", "stopTracking: Stop sequence completed successfully")
        promise.resolve(null)
      } catch (e: Exception) {
        android.util.Log.e("BackgroundLocationModule", "stopTracking: Failed", e)
        promise.reject("STOP_TRACKING_ERROR", "Failed to stop tracking: ${e.message}", e)
      }
    }
  }

  /**
   * Returns the current tracking state
   */
  override fun isTracking(promise: Promise) {
    moduleScope.launch {
      try {
        val trackingState = storage.getTrackingStateAsync()
        val result = Arguments.createMap().apply {
          putBoolean("active", trackingState.isActive)
          if (trackingState.tripId != null) {
            putString("tripId", trackingState.tripId)
          }
        }
        promise.resolve(result)
      } catch (e: Exception) {
        promise.reject("IS_TRACKING_ERROR", "Failed to get tracking state: ${e.message}", e)
      }
    }
  }

  /**
   * Retrieves all stored locations for a specific trip
   */
  override fun getLocations(tripId: String, promise: Promise) {
    if (tripId.isBlank()) {
      promise.reject("INVALID_TRIP_ID", "Trip ID cannot be empty")
      return
    }

    moduleScope.launch {
      try {
        val entities = storage.getLocationsAsync(tripId)
        val locations = storage.entitiesToWritableArray(entities)
        promise.resolve(locations)
      } catch (e: Exception) {
        promise.reject("GET_LOCATIONS_ERROR", "Failed to get locations: ${e.message}", e)
      }
    }
  }

  /**
   * Clears all stored location data for a specific trip
   */
  override fun clearTrip(tripId: String, promise: Promise) {
    try {
      if (tripId.isBlank()) {
        promise.reject("INVALID_TRIP_ID", "Trip ID cannot be empty")
        return
      }

      storage.clearTrip(tripId)
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("CLEAR_TRIP_ERROR", "Failed to clear trip: ${e.message}", e)
    }
  }

  /**
   * Updates the notification content while tracking is active
   * Dynamic updates are transient and do not persist to database
   */
  override fun updateNotification(title: String, text: String, promise: Promise) {
    if (title.isBlank() || text.isBlank()) {
      promise.reject("INVALID_ARGUMENTS", "Title and text cannot be empty")
      return
    }

    val success = LocationService.updateNotification(title, text)
    if (success) {
      promise.resolve(null)
    } else {
      promise.reject("NO_ACTIVE_SERVICE", "No active location service instance. Is tracking running?")
    }
  }

  /**
   * Checks the current location permission status
   * Returns granted only if background location permission is available
   */
  override fun checkLocationPermission(promise: Promise) {
    try {
      val hasBackground = hasLocationPermissions(false)
      val hasForeground = hasLocationPermissions(true)

      val status = when {
        hasBackground -> "granted"
        hasForeground -> "denied" // Has foreground only, insufficient for background
        else -> "denied"
      }

      val result = Arguments.createMap().apply {
        putString("status", status)
        putBoolean("canRequestAgain", true) // Android always allows re-requesting via PermissionsAndroid
      }
      promise.resolve(result)
    } catch (e: Exception) {
      promise.reject("CHECK_PERMISSION_ERROR", "Failed to check location permission: ${e.message}", e)
    }
  }

  /**
   * Returns the current permission status for location
   * On Android, actual permission requests are handled by PermissionsAndroid in JS
   */
  override fun requestLocationPermission(foregroundOnly: Boolean, promise: Promise) {
    // On Android, permission requests are handled by PermissionsAndroid in JS
    // This method returns the current permission status
    try {
      val hasPermission = hasLocationPermissions(foregroundOnly)

      val result = Arguments.createMap().apply {
        putString("status", if (hasPermission) "granted" else "denied")
        putBoolean("canRequestAgain", true)
      }
      promise.resolve(result)
    } catch (e: Exception) {
      promise.reject("REQUEST_PERMISSION_ERROR", "Failed to check location permission: ${e.message}", e)
    }
  }

  /**
   * Recovers tracking session after app restart/crash
   * Restarts the LocationService if tracking was active
   */
  private fun recoverTrackingSession() {
    moduleScope.launch {
      try {
        // Check stop token first - if user explicitly stopped, don't recover
        if (LocationService.isStopTokenSet(reactApplicationContext)) {
          android.util.Log.d("BackgroundLocationModule", "recoverTrackingSession: Stop token set, aborting recovery")
          return@launch
        }

        val trackingState = storage.getTrackingStateAsync()

        // If tracking was active and we have both tripId and options
        if (trackingState.isActive && trackingState.tripId != null) {
          // Double-check stop token after reading state
          if (LocationService.isStopTokenSet(reactApplicationContext)) {
            android.util.Log.d("BackgroundLocationModule", "recoverTrackingSession: Stop token set during state check, aborting")
            return@launch
          }

          // Check if we still have location permissions
          if (!hasLocationPermissions()) {
            // Clear tracking state if permissions were revoked
            storage.saveTrackingState(null, false)
            return@launch
          }

          // Restart the service with saved options
          val options = trackingState.options ?: TrackingOptions()
          withContext(Dispatchers.Main) {
            val context = reactApplicationContext
            LocationService.startService(context, trackingState.tripId, options)
          }
        }
      } catch (e: Exception) {
        // Log error but don't crash - recovery is best-effort
        e.printStackTrace()

        // Clear tracking state if recovery fails
        try {
          storage.saveTrackingState(null, false)
        } catch (clearError: Exception) {
          clearError.printStackTrace()
        }
      }
    }
  }

  /**
   * Checks if the app has the necessary location permissions
   * @param foregroundOnly If true, only checks for foreground location permissions (no background)
   */
  private fun hasLocationPermissions(foregroundOnly: Boolean = false): Boolean {
    val context = reactApplicationContext
    val fineLocation = ContextCompat.checkSelfPermission(
      context,
      Manifest.permission.ACCESS_FINE_LOCATION
    ) == PackageManager.PERMISSION_GRANTED

    val coarseLocation = ContextCompat.checkSelfPermission(
      context,
      Manifest.permission.ACCESS_COARSE_LOCATION
    ) == PackageManager.PERMISSION_GRANTED

    // Skip background location check if foregroundOnly mode
    if (foregroundOnly) {
      return fineLocation && coarseLocation
    }

    // Check background location permission for Android 10+
    val backgroundLocation = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      ContextCompat.checkSelfPermission(
        context,
        Manifest.permission.ACCESS_BACKGROUND_LOCATION
      ) == PackageManager.PERMISSION_GRANTED
    } else {
      true // Not required for Android 9 and below
    }

    return fineLocation && coarseLocation && backgroundLocation
  }

  /**
   * Checks if the app has notification permission (Android 13+)
   * Required for foreground services to show notifications
   */
  private fun hasNotificationPermission(): Boolean {
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      ContextCompat.checkSelfPermission(
        reactApplicationContext,
        Manifest.permission.POST_NOTIFICATIONS
      ) == PackageManager.PERMISSION_GRANTED
    } else {
      true // Not required before Android 13
    }
  }

  companion object {
    const val NAME = "BackgroundLocation"
  }
}

