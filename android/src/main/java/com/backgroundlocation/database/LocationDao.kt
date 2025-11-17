package com.backgroundlocation.database

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

/**
 * Data Access Object for location operations
 */
@Dao
interface LocationDao {
  
  /**
   * Insert a new location
   */
  @Insert
  suspend fun insert(location: LocationEntity): Long
  
  /**
   * Get all locations for a specific trip
   */
  @Query("SELECT * FROM locations WHERE tripId = :tripId ORDER BY timestamp ASC")
  suspend fun getLocationsByTripId(tripId: String): List<LocationEntity>
  
  /**
   * Get all locations for a specific trip as Flow (reactive)
   */
  @Query("SELECT * FROM locations WHERE tripId = :tripId ORDER BY timestamp ASC")
  fun getLocationsByTripIdFlow(tripId: String): Flow<List<LocationEntity>>
  
  /**
   * Get count of locations for a trip
   */
  @Query("SELECT COUNT(*) FROM locations WHERE tripId = :tripId")
  suspend fun getLocationCount(tripId: String): Int
  
  /**
   * Delete all locations for a specific trip
   */
  @Query("DELETE FROM locations WHERE tripId = :tripId")
  suspend fun deleteLocationsByTripId(tripId: String): Int
  
  /**
   * Delete all locations
   */
  @Query("DELETE FROM locations")
  suspend fun deleteAllLocations(): Int
  
  /**
   * Get all unique trip IDs
   */
  @Query("SELECT DISTINCT tripId FROM locations")
  suspend fun getAllTripIds(): List<String>
}

