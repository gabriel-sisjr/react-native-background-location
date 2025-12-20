package com.backgroundlocation

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.*
import com.facebook.react.module.annotations.ReactModule
import java.util.UUID

/**
 * TurboModule for background location tracking
 * Manages location collection sessions by tripId
 */
@ReactModule(name = BackgroundLocationModule.NAME)
class BackgroundLocationModule(reactContext: ReactApplicationContext) :
  NativeBackgroundLocationSpec(reactContext) {

  private val storage: LocationStorage = LocationStorage(reactContext)

  init {
    // Set the React Context in LocationService for event emission
    LocationService.setReactContext(reactContext)
    
    // Attempt to recover tracking session if app crashed/restarted
    recoverTrackingSession()
  }
  
  override fun initialize() {
    super.initialize()
    // Re-set the React Context when module is initialized
    LocationService.setReactContext(reactApplicationContext)
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

      // Check if already tracking
      val trackingState = storage.getTrackingState()
      if (trackingState.isActive && trackingState.tripId != null) {
        // Already tracking - return current tripId (idempotent)
        promise.resolve(trackingState.tripId)
        return
      }

      // Generate tripId if not provided
      val effectiveTripId = if (tripId.isNullOrBlank()) {
        UUID.randomUUID().toString()
      } else {
        tripId
      }

      // Save tracking state with options for recovery
      storage.saveTrackingState(effectiveTripId, true, trackingOptions)

      // Ensure React Context is set before starting service
      LocationService.setReactContext(reactApplicationContext)
      
      // Start the foreground service with options
      val context = reactApplicationContext
      LocationService.startService(context, effectiveTripId, trackingOptions)

      promise.resolve(effectiveTripId)
    } catch (e: Exception) {
      promise.reject("START_TRACKING_ERROR", "Failed to start tracking: ${e.message}", e)
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
      foregroundOnly = if (options.hasKey("foregroundOnly")) options.getBoolean("foregroundOnly") else null
    )
  }

  /**
   * Stops all location tracking and terminates the service
   */
  override fun stopTracking(promise: Promise) {
    try {
      // Stop the service
      val context = reactApplicationContext
      LocationService.stopService(context)

      // Update tracking state
      storage.saveTrackingState(null, false)

      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("STOP_TRACKING_ERROR", "Failed to stop tracking: ${e.message}", e)
    }
  }

  /**
   * Returns the current tracking state
   */
  override fun isTracking(promise: Promise) {
    try {
      val trackingState = storage.getTrackingState()
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

  /**
   * Retrieves all stored locations for a specific trip
   */
  override fun getLocations(tripId: String, promise: Promise) {
    try {
      if (tripId.isBlank()) {
        promise.reject("INVALID_TRIP_ID", "Trip ID cannot be empty")
        return
      }

      val locations = storage.getLocations(tripId)
      promise.resolve(locations)
    } catch (e: Exception) {
      promise.reject("GET_LOCATIONS_ERROR", "Failed to get locations: ${e.message}", e)
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
   * Recovers tracking session after app restart/crash
   * Restarts the LocationService if tracking was active
   */
  private fun recoverTrackingSession() {
    try {
      val trackingState = storage.getTrackingState()
      
      // If tracking was active and we have both tripId and options
      if (trackingState.isActive && trackingState.tripId != null) {
        // Check if we still have location permissions
        if (!hasLocationPermissions()) {
          // Clear tracking state if permissions were revoked
          storage.saveTrackingState(null, false)
          return
        }
        
        // Ensure React Context is set before restarting service
        LocationService.setReactContext(reactApplicationContext)
        
        // Restart the service with saved options
        val options = trackingState.options ?: TrackingOptions()
        val context = reactApplicationContext
        LocationService.startService(context, trackingState.tripId, options)
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

