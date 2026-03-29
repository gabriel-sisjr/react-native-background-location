package com.backgroundlocation.database

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

/**
 * Data Access Object for geofence and transition operations
 */
@Dao
interface GeofenceDao {

    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insertGeofence(geofence: GeofenceEntity)

    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insertGeofences(geofences: List<GeofenceEntity>)

    @Insert
    suspend fun insertTransition(transition: GeofenceTransitionEntity): Long

    @Query("SELECT * FROM geofences")
    suspend fun getAllGeofences(): List<GeofenceEntity>

    @Query("SELECT * FROM geofences WHERE identifier = :identifier")
    suspend fun getGeofenceByIdentifier(identifier: String): GeofenceEntity?

    @Query("DELETE FROM geofences WHERE identifier = :identifier")
    suspend fun deleteGeofence(identifier: String): Int

    @Query("DELETE FROM geofences WHERE identifier IN (:identifiers)")
    suspend fun deleteGeofences(identifiers: List<String>): Int

    @Query("DELETE FROM geofences")
    suspend fun deleteAllGeofences(): Int

    @Query("SELECT COUNT(*) FROM geofences")
    suspend fun getGeofenceCount(): Int

    @Query("SELECT * FROM geofence_transitions WHERE geofenceId = :geofenceId ORDER BY timestamp DESC")
    suspend fun getTransitionsByGeofenceId(geofenceId: String): List<GeofenceTransitionEntity>

    @Query("SELECT * FROM geofence_transitions ORDER BY timestamp DESC")
    suspend fun getAllTransitions(): List<GeofenceTransitionEntity>

    @Query("DELETE FROM geofence_transitions WHERE geofenceId = :geofenceId")
    suspend fun deleteTransitionsByGeofenceId(geofenceId: String): Int

    @Query("DELETE FROM geofence_transitions")
    suspend fun deleteAllTransitions(): Int
}
