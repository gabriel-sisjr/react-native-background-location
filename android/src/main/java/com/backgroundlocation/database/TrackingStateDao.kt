package com.backgroundlocation.database

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

/**
 * Data Access Object for tracking state operations
 */
@Dao
interface TrackingStateDao {
  
  /**
   * Insert or update tracking state (single row table)
   */
  @Insert(onConflict = OnConflictStrategy.REPLACE)
  suspend fun upsert(state: TrackingStateEntity)
  
  /**
   * Get current tracking state
   */
  @Query("SELECT * FROM tracking_state WHERE id = 1 LIMIT 1")
  suspend fun getTrackingState(): TrackingStateEntity?
  
  /**
   * Clear tracking state
   */
  @Query("DELETE FROM tracking_state WHERE id = 1")
  suspend fun clearTrackingState()
}

