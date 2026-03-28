package com.backgroundlocation.database

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * Room entity for storing tracking state.
 * Single row table to store current tracking session state.
 *
 * Since v0.12.0 (DB v7), notification settings are stored as a single JSON string
 * in [notificationOptionsJson]. The 11 legacy flat columns are retained for backward
 * compatibility (SQLite cannot drop columns) and are used as a fallback when
 * recovering sessions saved before the migration.
 */
@Entity(tableName = "tracking_state")
data class TrackingStateEntity(
  @PrimaryKey
  val id: Int = 1, // Always 1 - single row table

  val isActive: Boolean = false,
  val tripId: String? = null,

  // TrackingOptions fields
  val updateInterval: Long? = null,
  val fastestInterval: Long? = null,
  val maxWaitTime: Long? = null,
  val accuracy: String? = null,
  val waitForAccurateLocation: Boolean? = null,
  val foregroundOnly: Boolean? = null,

  // v0.12.0+: Notification options as a single JSON string
  val notificationOptionsJson: String? = null,

  // Legacy flat notification columns (kept for backward compat, SQLite can't DROP COLUMN)
  val notificationTitle: String? = null,
  val notificationText: String? = null,
  val notificationChannelName: String? = null,
  val notificationPriority: String? = null,
  val notificationSmallIcon: String? = null,
  val notificationColor: String? = null,
  val notificationShowTimestamp: Boolean? = null,
  val notificationActions: String? = null,
  val notificationLargeIcon: String? = null,
  val notificationSubtext: String? = null,
  val notificationChannelId: String? = null
)

