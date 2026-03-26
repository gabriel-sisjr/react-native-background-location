package com.backgroundlocation.database

import android.content.Context
import android.util.Log
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

/**
 * Room database for location storage and tracking state
 * Singleton pattern to ensure single instance
 *
 * SCHEMA VERSION HISTORY:
 * - Version 1: Initial schema (locations, tracking_state tables)
 * - Version 2: Added notification customization columns to tracking_state
 *              (notificationSmallIcon, notificationColor, notificationShowTimestamp)
 * - Version 3: Added notificationActions column to tracking_state
 * - Version 4: Added notificationLargeIcon, notificationSubtext, notificationChannelId
 * - Version 5: Added geofences and geofence_transitions tables for geofencing support
 * - Version 6: Added notificationConfig column to geofences table for per-geofence notification overrides
 *
 * IMPORTANT: When changing schema:
 * 1. Increment the version number
 * 2. Add a migration in Migrations.kt
 * 3. Document the change in this header
 * 4. Test migration from all previous versions
 */
@Database(
  entities = [
    LocationEntity::class,
    TrackingStateEntity::class,
    GeofenceEntity::class,
    GeofenceTransitionEntity::class
  ],
  version = 6,
  exportSchema = true  // Changed to true for migration validation
)
abstract class LocationDatabase : RoomDatabase() {

  abstract fun locationDao(): LocationDao
  abstract fun trackingStateDao(): TrackingStateDao
  abstract fun geofenceDao(): GeofenceDao

  companion object {
    @Volatile
    private var INSTANCE: LocationDatabase? = null

    private const val DATABASE_NAME = "background_location_db"
    private const val TAG = "LocationDatabase"

    /**
     * Get database instance (singleton)
     * Uses proper migration strategy - no destructive fallback
     */
    fun getInstance(context: Context): LocationDatabase {
      return INSTANCE ?: synchronized(this) {
        val instance = buildDatabase(context)
        INSTANCE = instance
        instance
      }
    }

    private fun buildDatabase(context: Context): LocationDatabase {
      val builder = Room.databaseBuilder(
        context.applicationContext,
        LocationDatabase::class.java,
        DATABASE_NAME
      )

      // Add all migrations
      val migrations = Migrations.getAllMigrations()
      if (migrations.isNotEmpty()) {
        builder.addMigrations(*migrations)
        Log.d(TAG, "Registered ${migrations.size} database migration(s)")
      }

      // REMOVED: .fallbackToDestructiveMigration()
      // Instead, we fail fast if migration is missing
      // This prevents silent data loss in production

      // For development/debug builds only, you can add:
      // if (BuildConfig.DEBUG) {
      //     builder.fallbackToDestructiveMigration()
      // }

      return builder.build()
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

