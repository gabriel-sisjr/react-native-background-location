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
  entities = [
    LocationEntity::class,
    TrackingStateEntity::class,
    GeofenceEntity::class,
    GeofenceTransitionEntity::class
  ],
  version = 1,
  exportSchema = true
)
abstract class LocationDatabase : RoomDatabase() {

  abstract fun locationDao(): LocationDao
  abstract fun trackingStateDao(): TrackingStateDao
  abstract fun geofenceDao(): GeofenceDao

  companion object {
    @Volatile
    private var INSTANCE: LocationDatabase? = null

    private const val DATABASE_NAME = "background_location_db"

    /**
     * Get database instance (singleton)
     * Uses destructive migration since DB data is transient and rebuilt at runtime
     */
    fun getInstance(context: Context): LocationDatabase {
      return INSTANCE ?: synchronized(this) {
        val instance = buildDatabase(context)
        INSTANCE = instance
        instance
      }
    }

    private fun buildDatabase(context: Context): LocationDatabase {
      return Room.databaseBuilder(
        context.applicationContext,
        LocationDatabase::class.java,
        DATABASE_NAME
      )
        .fallbackToDestructiveMigration()
        .build()
    }

    /**
     * For testing: Allows creating in-memory database
     */
    fun getInMemoryInstance(context: Context): LocationDatabase {
      return Room.inMemoryDatabaseBuilder(
        context.applicationContext,
        LocationDatabase::class.java
      ).build()
    }

    /**
     * For testing: Clear the singleton instance
     */
    fun clearInstance() {
      INSTANCE?.close()
      INSTANCE = null
    }
  }
}
