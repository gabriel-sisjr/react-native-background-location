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
     * Schema v1 -> v2: additive, nullable `tracking_state` columns, so every stored location,
     * tracking state, geofence and geofence transition survives the upgrade.
     */
    internal val MIGRATION_1_2 = object : Migration(1, 2) {
      override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL("ALTER TABLE `tracking_state` ADD COLUMN `distanceFilter` REAL")
        db.execSQL("ALTER TABLE `tracking_state` ADD COLUMN `motionOptionsJson` TEXT")
      }
    }

    /**
     * Get database instance (singleton)
     */
    fun getInstance(context: Context): LocationDatabase {
      return INSTANCE ?: synchronized(this) {
        val instance = buildDatabase(context)
        INSTANCE = instance
        instance
      }
    }

    /**
     * Migration policy shared by [getInstance] and the migration test.
     *
     * Registered migrations always win, so upgrades keep the data. The destructive fallback
     * only fires when no migration path exists (a downgrade or an unknown version). A
     * migration that leaves a mismatched schema still fails when the database opens; the
     * fallback does not cover that case.
     */
    internal fun applyMigrationPolicy(
      builder: RoomDatabase.Builder<LocationDatabase>
    ): RoomDatabase.Builder<LocationDatabase> =
      builder
        .addMigrations(MIGRATION_1_2)
        .fallbackToDestructiveMigration()

    private fun buildDatabase(context: Context): LocationDatabase {
      return applyMigrationPolicy(
        Room.databaseBuilder(
          context.applicationContext,
          LocationDatabase::class.java,
          DATABASE_NAME
        )
      ).build()
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
