package com.backgroundlocation.database

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * Room entity for storing tracking state.
 * Single row table to store current tracking session state.
 */
@Entity(tableName = "tracking_state")
data class TrackingStateEntity(
  @PrimaryKey
  val id: Int = 1,

  val isActive: Boolean = false,
  val tripId: String? = null,

  // TrackingOptions fields
  val updateInterval: Long? = null,
  val fastestInterval: Long? = null,
  val maxWaitTime: Long? = null,
  val accuracy: String? = null,
  val waitForAccurateLocation: Boolean? = null,
  val foregroundOnly: Boolean? = null,

  // Notification options as a single JSON string
  val notificationOptionsJson: String? = null,

  // Schema v2 columns. Keep them last, in this order: the generated CREATE TABLE must
  // match the ALTER TABLE ... ADD COLUMN statements of MIGRATION_1_2.
  val distanceFilter: Float? = null,

  // Motion activity options as a single JSON string (null when the feature is off)
  val motionOptionsJson: String? = null
)

