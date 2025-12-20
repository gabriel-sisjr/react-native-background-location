package com.backgroundlocation

import android.content.Context
import com.backgroundlocation.database.LocationDatabase
import com.backgroundlocation.database.LocationEntity
import com.backgroundlocation.database.TrackingStateEntity
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableArray
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking

/**
 * Handles persistent storage of location data and tracking state using Room Database
 * Thread-safe implementation with coroutines
 */
class LocationStorage(context: Context) {
  
  private val database = LocationDatabase.getInstance(context)
  private val locationDao = database.locationDao()
  private val trackingStateDao = database.trackingStateDao()
  
  // Coroutine scope for database operations
  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
  
  /**
   * Saves a location point for a specific trip with extended location data
   * Runs asynchronously on IO thread
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
    scope.launch {
      try {
        val entity = LocationEntity(
          tripId = tripId,
          latitude = latitude,
          longitude = longitude,
          timestamp = timestamp,
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
        locationDao.insert(entity)
      } catch (e: Exception) {
        e.printStackTrace()
      }
    }
  }
  
  /**
   * Retrieves all locations for a specific trip with extended location data
   * Blocking call - returns immediately with data from database
   */
  fun getLocations(tripId: String): WritableArray {
    val result = Arguments.createArray()
    
    return try {
      // Run blocking to return synchronously (required for React Native bridge)
      val locations = runBlocking {
        locationDao.getLocationsByTripId(tripId)
      }
      
      locations.forEach { entity ->
        val location = Arguments.createMap().apply {
          putString("latitude", entity.latitude.toString())
          putString("longitude", entity.longitude.toString())
          putDouble("timestamp", entity.timestamp.toDouble())
          
          // Add optional fields if present
          entity.accuracy?.let { putDouble("accuracy", it.toDouble()) }
          entity.altitude?.let { putDouble("altitude", it) }
          entity.speed?.let { putDouble("speed", it.toDouble()) }
          entity.bearing?.let { putDouble("bearing", it.toDouble()) }
          entity.verticalAccuracyMeters?.let { putDouble("verticalAccuracyMeters", it.toDouble()) }
          entity.speedAccuracyMetersPerSecond?.let { putDouble("speedAccuracyMetersPerSecond", it.toDouble()) }
          entity.bearingAccuracyDegrees?.let { putDouble("bearingAccuracyDegrees", it.toDouble()) }
          entity.elapsedRealtimeNanos?.let { putDouble("elapsedRealtimeNanos", it.toDouble()) }
          entity.provider?.let { putString("provider", it) }
          entity.isFromMockProvider?.let { putBoolean("isFromMockProvider", it) }
        }
        result.pushMap(location)
      }
      
      result
    } catch (e: Exception) {
      e.printStackTrace()
      result
    }
  }
  
  /**
   * Clears all location data for a specific trip
   */
  fun clearTrip(tripId: String) {
    scope.launch {
      try {
        locationDao.deleteLocationsByTripId(tripId)
      } catch (e: Exception) {
        e.printStackTrace()
      }
    }
  }
  
  /**
   * Saves the current tracking state along with tracking options
   * Uses Room Database for persistence
   */
  fun saveTrackingState(tripId: String?, isActive: Boolean, options: TrackingOptions? = null) {
    scope.launch {
      try {
        val entity = TrackingStateEntity(
          id = 1,
          isActive = isActive,
          tripId = tripId,
          updateInterval = options?.updateInterval,
          fastestInterval = options?.fastestInterval,
          maxWaitTime = options?.maxWaitTime,
          accuracy = options?.accuracy?.value,
          waitForAccurateLocation = options?.waitForAccurateLocation,
          notificationTitle = options?.notificationTitle,
          notificationText = options?.notificationText,
          notificationChannelName = options?.notificationChannelName,
          notificationPriority = options?.notificationPriority,
          foregroundOnly = options?.foregroundOnly
        )
        trackingStateDao.upsert(entity)
      } catch (e: Exception) {
        e.printStackTrace()
      }
    }
  }
  
  /**
   * Gets the current tracking state
   * Blocking call - returns immediately with data from Room Database
   */
  fun getTrackingState(): TrackingState {
    return try {
      runBlocking {
        val entity = trackingStateDao.getTrackingState()
        
        if (entity == null) {
          TrackingState(false, null, null)
        } else {
          val options = if (entity.updateInterval != null || entity.accuracy != null) {
            TrackingOptions(
              updateInterval = entity.updateInterval,
              fastestInterval = entity.fastestInterval,
              maxWaitTime = entity.maxWaitTime,
              accuracy = entity.accuracy?.let { LocationAccuracy.fromString(it) },
              waitForAccurateLocation = entity.waitForAccurateLocation,
              notificationTitle = entity.notificationTitle,
              notificationText = entity.notificationText,
              notificationChannelName = entity.notificationChannelName,
              notificationPriority = entity.notificationPriority,
              foregroundOnly = entity.foregroundOnly
            )
          } else null
          
          TrackingState(entity.isActive, entity.tripId, options)
        }
      }
    } catch (e: Exception) {
      e.printStackTrace()
      TrackingState(false, null, null)
    }
  }
  
  /**
   * Data class for tracking state
   */
  data class TrackingState(
    val isActive: Boolean,
    val tripId: String?,
    val options: TrackingOptions? = null
  )
}
