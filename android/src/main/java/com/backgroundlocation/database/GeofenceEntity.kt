package com.backgroundlocation.database

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * Room entity for storing registered geofence regions
 */
@Entity(tableName = "geofences")
data class GeofenceEntity(
    @PrimaryKey val identifier: String,
    val latitude: Double,
    val longitude: Double,
    val radius: Float,
    val transitionTypes: Int,       // Bitmask: ENTER=1, EXIT=2, DWELL=4
    val loiteringDelay: Int,        // Milliseconds
    val expirationDuration: Long?,  // Milliseconds, null = indefinite
    val metadata: String?,          // JSON nullable
    val createdAt: Long             // Timestamp
)
