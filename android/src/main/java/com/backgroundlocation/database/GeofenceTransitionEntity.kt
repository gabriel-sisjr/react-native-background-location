package com.backgroundlocation.database

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

/**
 * Room entity for storing geofence transition events
 * Indexed by geofenceId for efficient queries
 */
@Entity(
    tableName = "geofence_transitions",
    indices = [Index(value = ["geofenceId"])]
)
data class GeofenceTransitionEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val geofenceId: String,
    val transitionType: String,     // "ENTER", "EXIT", "DWELL"
    val latitude: Double,
    val longitude: Double,
    val distanceFromCenter: Double, // Distance from geofence center in meters
    val timestamp: Long,
    val metadata: String?           // JSON nullable
)
