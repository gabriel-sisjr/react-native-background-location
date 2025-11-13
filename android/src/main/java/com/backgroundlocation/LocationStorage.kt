package com.backgroundlocation

import android.content.Context
import android.content.SharedPreferences
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import org.json.JSONArray
import org.json.JSONObject

/**
 * Handles persistent storage of location data per trip
 * Uses SharedPreferences for simplicity and reliability
 */
class LocationStorage(context: Context) {
  
  private val prefs: SharedPreferences = context.getSharedPreferences(
    PREFS_NAME,
    Context.MODE_PRIVATE
  )

  /**
   * Saves a location point for a specific trip with extended location data
   */
  fun saveLocation(
    tripId: String,
    latitude: Double,
    longitude: Double,
    timestamp: Long,
    accuracy: Float? = null,
    altitude: Double? = null,
    speed: Float? = null,
    bearing: Float? = null,
    verticalAccuracyMeters: Float? = null,
    speedAccuracyMetersPerSecond: Float? = null,
    bearingAccuracyDegrees: Float? = null,
    elapsedRealtimeNanos: Long? = null,
    provider: String? = null,
    isFromMockProvider: Boolean? = null
  ) {
    val key = getTripKey(tripId)
    val existingData = prefs.getString(key, "[]") ?: "[]"
    
    try {
      val jsonArray = JSONArray(existingData)
      val locationObj = JSONObject().apply {
        put("latitude", latitude.toString())
        put("longitude", longitude.toString())
        put("timestamp", timestamp)
        
        // Add optional fields if available
        accuracy?.let { put("accuracy", it.toDouble()) }
        altitude?.let { put("altitude", it) }
        speed?.let { put("speed", it.toDouble()) }
        bearing?.let { put("bearing", it.toDouble()) }
        verticalAccuracyMeters?.let { put("verticalAccuracyMeters", it.toDouble()) }
        speedAccuracyMetersPerSecond?.let { put("speedAccuracyMetersPerSecond", it.toDouble()) }
        bearingAccuracyDegrees?.let { put("bearingAccuracyDegrees", it.toDouble()) }
        elapsedRealtimeNanos?.let { put("elapsedRealtimeNanos", it) }
        provider?.let { put("provider", it) }
        isFromMockProvider?.let { put("isFromMockProvider", it) }
      }
      jsonArray.put(locationObj)
      
      prefs.edit().putString(key, jsonArray.toString()).apply()
    } catch (e: Exception) {
      e.printStackTrace()
    }
  }

  /**
   * Retrieves all locations for a specific trip with extended location data
   */
  fun getLocations(tripId: String): WritableArray {
    val key = getTripKey(tripId)
    val data = prefs.getString(key, "[]") ?: "[]"
    val result = Arguments.createArray()
    
    try {
      val jsonArray = JSONArray(data)
      for (i in 0 until jsonArray.length()) {
        val locationObj = jsonArray.getJSONObject(i)
        val location = Arguments.createMap().apply {
          putString("latitude", locationObj.getString("latitude"))
          putString("longitude", locationObj.getString("longitude"))
          putDouble("timestamp", locationObj.getDouble("timestamp"))
          
          // Add optional fields if present
          if (locationObj.has("accuracy")) {
            putDouble("accuracy", locationObj.getDouble("accuracy"))
          }
          if (locationObj.has("altitude")) {
            putDouble("altitude", locationObj.getDouble("altitude"))
          }
          if (locationObj.has("speed")) {
            putDouble("speed", locationObj.getDouble("speed"))
          }
          if (locationObj.has("bearing")) {
            putDouble("bearing", locationObj.getDouble("bearing"))
          }
          if (locationObj.has("verticalAccuracyMeters")) {
            putDouble("verticalAccuracyMeters", locationObj.getDouble("verticalAccuracyMeters"))
          }
          if (locationObj.has("speedAccuracyMetersPerSecond")) {
            putDouble("speedAccuracyMetersPerSecond", locationObj.getDouble("speedAccuracyMetersPerSecond"))
          }
          if (locationObj.has("bearingAccuracyDegrees")) {
            putDouble("bearingAccuracyDegrees", locationObj.getDouble("bearingAccuracyDegrees"))
          }
          if (locationObj.has("elapsedRealtimeNanos")) {
            putDouble("elapsedRealtimeNanos", locationObj.getDouble("elapsedRealtimeNanos"))
          }
          if (locationObj.has("provider")) {
            putString("provider", locationObj.getString("provider"))
          }
          if (locationObj.has("isFromMockProvider")) {
            putBoolean("isFromMockProvider", locationObj.getBoolean("isFromMockProvider"))
          }
        }
        result.pushMap(location)
      }
    } catch (e: Exception) {
      e.printStackTrace()
    }
    
    return result
  }

  /**
   * Clears all location data for a specific trip
   */
  fun clearTrip(tripId: String) {
    val key = getTripKey(tripId)
    prefs.edit().remove(key).apply()
  }

  /**
   * Saves the current tracking state
   */
  fun saveTrackingState(tripId: String?, isActive: Boolean) {
    prefs.edit().apply {
      putBoolean(KEY_IS_TRACKING, isActive)
      putString(KEY_CURRENT_TRIP_ID, tripId)
      apply()
    }
  }

  /**
   * Gets the current tracking state
   */
  fun getTrackingState(): TrackingState {
    val isActive = prefs.getBoolean(KEY_IS_TRACKING, false)
    val tripId = prefs.getString(KEY_CURRENT_TRIP_ID, null)
    return TrackingState(isActive, tripId)
  }

  private fun getTripKey(tripId: String): String = "trip_$tripId"

  companion object {
    private const val PREFS_NAME = "BackgroundLocationPrefs"
    private const val KEY_IS_TRACKING = "is_tracking"
    private const val KEY_CURRENT_TRIP_ID = "current_trip_id"
  }

  data class TrackingState(val isActive: Boolean, val tripId: String?)
}

