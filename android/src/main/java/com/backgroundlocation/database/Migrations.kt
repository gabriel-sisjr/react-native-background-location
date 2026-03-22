package com.backgroundlocation.database

import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

/**
 * Database migrations for LocationDatabase
 *
 * IMPORTANT: Never delete migrations. Always add new ones.
 * Each migration must handle both upgrade and potential data preservation.
 *
 * SCHEMA VERSION HISTORY:
 * - Version 1: Initial schema (locations, tracking_state tables)
 * - Version 2: Added notification customization columns to tracking_state
 * - Version 3: Added notificationActions column to tracking_state
 * - Version 4: Added notificationLargeIcon, notificationSubtext, notificationChannelId columns
 */
object Migrations {

    /**
     * Migration from version 1 to 2
     * Adds notification customization columns to tracking_state table
     */
    val MIGRATION_1_2 = object : Migration(1, 2) {
        override fun migrate(database: SupportSQLiteDatabase) {
            database.execSQL("ALTER TABLE tracking_state ADD COLUMN notificationSmallIcon TEXT")
            database.execSQL("ALTER TABLE tracking_state ADD COLUMN notificationColor TEXT")
            database.execSQL("ALTER TABLE tracking_state ADD COLUMN notificationShowTimestamp INTEGER")
        }
    }

    /**
     * Migration from version 2 to 3
     * Adds notificationActions column to tracking_state table
     */
    val MIGRATION_2_3 = object : Migration(2, 3) {
        override fun migrate(database: SupportSQLiteDatabase) {
            database.execSQL("ALTER TABLE tracking_state ADD COLUMN notificationActions TEXT")
        }
    }

    /**
     * Migration from version 3 to 4
     * Adds notificationLargeIcon, notificationSubtext, notificationChannelId columns
     */
    val MIGRATION_3_4 = object : Migration(3, 4) {
        override fun migrate(database: SupportSQLiteDatabase) {
            database.execSQL("ALTER TABLE tracking_state ADD COLUMN notificationLargeIcon TEXT")
            database.execSQL("ALTER TABLE tracking_state ADD COLUMN notificationSubtext TEXT")
            database.execSQL("ALTER TABLE tracking_state ADD COLUMN notificationChannelId TEXT")
        }
    }

    /**
     * Get all migrations in order
     * Add new migrations to this array as they are created
     */
    fun getAllMigrations(): Array<Migration> {
        return arrayOf(
            MIGRATION_1_2,
            MIGRATION_2_3,
            MIGRATION_3_4,
        )
    }

    /**
     * Validates that migration path exists between versions
     * Useful for testing and debugging migration issues
     */
    fun validateMigrationPath(startVersion: Int, endVersion: Int): Boolean {
        // For now, just check that we don't skip versions
        val migrations = getAllMigrations()
        var currentVersion = startVersion

        for (migration in migrations) {
            if (migration.startVersion == currentVersion) {
                currentVersion = migration.endVersion
            }
            if (currentVersion >= endVersion) {
                return true
            }
        }

        return currentVersion >= endVersion
    }

    /**
     * Gets a human-readable description of all available migrations
     * Useful for documentation and debugging
     */
    fun getMigrationHistory(): List<String> {
        val migrations = getAllMigrations()
        return migrations.map { migration ->
            "Migration ${migration.startVersion} -> ${migration.endVersion}"
        }
    }
}
