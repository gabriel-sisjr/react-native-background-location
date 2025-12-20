package com.backgroundlocation

import android.content.Context
import com.backgroundlocation.database.LocationDatabase
import com.backgroundlocation.database.LocationEntity
import com.backgroundlocation.database.TrackingStateEntity
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableArray
import kotlinx.coroutines.*
import java.util.concurrent.ConcurrentLinkedQueue

/**
 * Handles persistent storage of location data and tracking state using Room Database
 * Thread-safe implementation with coroutines and batched writes
 */
class LocationStorage(context: Context) {

  private val database = LocationDatabase.getInstance(context)
  private val locationDao = database.locationDao()
  private val trackingStateDao = database.trackingStateDao()

  // Coroutine scope for database operations
  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

  // Batching configuration
  private val locationBuffer = ConcurrentLinkedQueue<LocationEntity>()
  private val BATCH_SIZE = 10
  private val BATCH_TIMEOUT_MS = 5000L
  private var batchJob: Job? = null

  init {
    startBatchTimer()
  }

  /**
   * Starts periodic batch flush timer
   */
  private fun startBatchTimer() {
    batchJob = scope.launch {
      while (isActive) {
        delay(BATCH_TIMEOUT_MS)
        flushBuffer()
      }
    }
  }
  
  /**
   * Saves a location point - buffered for batch writing
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

    locationBuffer.add(entity)

    // Flush if buffer is full
    if (locationBuffer.size >= BATCH_SIZE) {
      scope.launch { flushBuffer() }
    }
  }

  /**
   * Flushes the location buffer to database
   */
  private suspend fun flushBuffer() {
    if (locationBuffer.isEmpty()) return

    val batch = mutableListOf<LocationEntity>()
    while (batch.size < BATCH_SIZE * 2) { // Don't flush too many at once
      val entity = locationBuffer.poll() ?: break
      batch.add(entity)
    }

    if (batch.isNotEmpty()) {
      try {
        locationDao.insertAll(batch)
        android.util.Log.d("LocationStorage", "Flushed ${batch.size} locations to database")
      } catch (e: Exception) {
        android.util.Log.e("LocationStorage", "Failed to flush locations", e)
        // Re-add to buffer on failure
        batch.forEach { locationBuffer.add(it) }
      }
    }
  }

  /**
   * Forces immediate flush of all buffered locations
   */
  suspend fun forceFlush() {
    while (locationBuffer.isNotEmpty()) {
      flushBuffer()
    }
  }
  
  /**
   * Retrieves all locations for a specific trip - ASYNC version
   * Returns via suspend function to avoid blocking
   */
  suspend fun getLocationsAsync(tripId: String): List<LocationEntity> {
    // Ensure buffer is flushed first
    forceFlush()
    return locationDao.getLocationsByTripId(tripId)
  }

  /**
   * Converts location entities to WritableArray
   */
  fun entitiesToWritableArray(entities: List<LocationEntity>): WritableArray {
    val result = Arguments.createArray()
    entities.forEach { entity ->
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
    return result
  }

  /**
   * Gets locations synchronously - DEPRECATED, use getLocationsAsync
   * Kept for backwards compatibility
   */
  @Deprecated("Use getLocationsAsync instead", ReplaceWith("getLocationsAsync(tripId)"))
  fun getLocations(tripId: String): WritableArray {
    return runBlocking {
      val entities = getLocationsAsync(tripId)
      entitiesToWritableArray(entities)
    }
  }
  
  /**
   * Clears all location data for a specific trip
   */
  fun clearTrip(tripId: String) {
    scope.launch {
      try {
        // Remove from buffer first
        locationBuffer.removeAll { it.tripId == tripId }
        // Then from database
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
   * Gets the current tracking state - ASYNC version
   */
  suspend fun getTrackingStateAsync(): TrackingState {
    return try {
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
    } catch (e: Exception) {
      e.printStackTrace()
      TrackingState(false, null, null)
    }
  }

  /**
   * Gets tracking state synchronously - DEPRECATED, use getTrackingStateAsync
   * Kept for backwards compatibility
   */
  @Deprecated("Use getTrackingStateAsync instead", ReplaceWith("getTrackingStateAsync()"))
  fun getTrackingState(): TrackingState {
    return runBlocking {
      getTrackingStateAsync()
    }
  }

  /**
   * Cleans up resources and flushes pending writes
   * Should be called when storage is no longer needed
   */
  fun cleanup() {
    runBlocking {
      try {
        // Cancel batch timer
        batchJob?.cancel()
        // Flush all pending locations
        forceFlush()
        // Cancel coroutine scope
        scope.cancel()
      } catch (e: Exception) {
        android.util.Log.e("LocationStorage", "Error during cleanup", e)
      }
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
