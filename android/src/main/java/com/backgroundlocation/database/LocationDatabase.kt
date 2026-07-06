package com.backgroundlocation.database

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

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
  version = 2,
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
     * Migration from v1 to v2: add activity-tracking columns to tracking_state.
     * All columns are nullable so existing rows are preserved.
     */
    private val MIGRATION_1_2 = Migration(1, 2) { database ->
      database.execSQL("ALTER TABLE tracking_state ADD COLUMN activityTrackingEnabled INTEGER")
      database.execSQL("ALTER TABLE tracking_state ADD COLUMN pauseLocationWhenStill INTEGER")
      database.execSQL("ALTER TABLE tracking_state ADD COLUMN activityUpdateInterval INTEGER")
    }

    /**
     * Get database instance (singleton)
     * Uses destructive migration only as last-resort safety net.
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
        .addMigrations(MIGRATION_1_2)
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
