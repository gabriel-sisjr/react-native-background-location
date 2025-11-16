package com.backgroundlocation.database

import androidx.room.Entity
import androidx.room.PrimaryKey
import androidx.room.Index

/**
 * Room entity for storing location data
 * Indexed by tripId for efficient queries
 */
@Entity(
  tableName = "locations",
  indices = [Index(value = ["tripId"])]
)
data class LocationEntity(
  @PrimaryKey(autoGenerate = true)
  val id: Long = 0,
  
  val tripId: String,
  val latitude: Double,
  val longitude: Double,
  val timestamp: Long,
  
  // Optional fields
  val accuracy: Float? = null,
  val altitude: Double? = null,
  val speed: Float? = null,
  val bearing: Float? = null,
  val verticalAccuracyMeters: Float? = null,
  val speedAccuracyMetersPerSecond: Float? = null,
  val bearingAccuracyDegrees: Float? = null,
  val elapsedRealtimeNanos: Long? = null,
  val provider: String? = null,
  val isFromMockProvider: Boolean? = null
)

