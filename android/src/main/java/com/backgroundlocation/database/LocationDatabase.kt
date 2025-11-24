package com.backgroundlocation.database

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

/**
 * Room database for location storage and tracking state
 * Singleton pattern to ensure single instance
 */
@Database(
  entities = [LocationEntity::class, TrackingStateEntity::class],
  version = 1,
  exportSchema = false
)
abstract class LocationDatabase : RoomDatabase() {
  
  abstract fun locationDao(): LocationDao
  abstract fun trackingStateDao(): TrackingStateDao
  
  companion object {
    @Volatile
    private var INSTANCE: LocationDatabase? = null
    
    private const val DATABASE_NAME = "background_location_db"
    
    /**
     * Get database instance (singleton)
     */
    fun getInstance(context: Context): LocationDatabase {
      return INSTANCE ?: synchronized(this) {
        val instance = Room.databaseBuilder(
          context.applicationContext,
          LocationDatabase::class.java,
          DATABASE_NAME
        )
          .fallbackToDestructiveMigration() // For now, simple migration strategy
          .build()
        
        INSTANCE = instance
        instance
      }
    }
  }
}

