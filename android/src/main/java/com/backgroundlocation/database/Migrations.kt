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
 */
object Migrations {

    /**
     * Migration from version 1 to 2
     * Example: Adding a new column
     *
     * To be used when adding new fields to LocationEntity or TrackingStateEntity
     *
     * Example implementation (uncomment when needed):
     * val MIGRATION_1_2 = object : Migration(1, 2) {
     *     override fun migrate(database: SupportSQLiteDatabase) {
     *         // Example: Add batteryLevel column to locations table
     *         database.execSQL("ALTER TABLE locations ADD COLUMN batteryLevel REAL")
     *     }
     * }
     */

    /**
     * Get all migrations in order
     * Add new migrations to this array as they are created
     */
    fun getAllMigrations(): Array<Migration> {
        return arrayOf(
            // Add migrations here as they are created
            // Example:
            // MIGRATION_1_2,
            // MIGRATION_2_3,
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
