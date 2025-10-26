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

  override fun getName(): String = NAME

  /**
   * Starts location tracking for a specific trip
   * If tripId is null or empty, generates a new UUID
   * Returns the effective tripId being used
   */
  override fun startTracking(tripId: String?, promise: Promise) {
    try {
      // Check location permissions
      if (!hasLocationPermissions()) {
        promise.reject(
          "PERMISSION_DENIED",
          "Location permissions are required. Please request ACCESS_FINE_LOCATION and ACCESS_COARSE_LOCATION permissions."
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

      // Save tracking state
      storage.saveTrackingState(effectiveTripId, true)

      // Start the foreground service
      val context = reactApplicationContext
      LocationService.startService(context, effectiveTripId)

      promise.resolve(effectiveTripId)
    } catch (e: Exception) {
      promise.reject("START_TRACKING_ERROR", "Failed to start tracking: ${e.message}", e)
    }
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
   * Checks if the app has the necessary location permissions
   */
  private fun hasLocationPermissions(): Boolean {
    val context = reactApplicationContext
    val fineLocation = ContextCompat.checkSelfPermission(
      context,
      Manifest.permission.ACCESS_FINE_LOCATION
    ) == PackageManager.PERMISSION_GRANTED

    val coarseLocation = ContextCompat.checkSelfPermission(
      context,
      Manifest.permission.ACCESS_COARSE_LOCATION
    ) == PackageManager.PERMISSION_GRANTED

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

  companion object {
    const val NAME = "BackgroundLocation"
  }
}

