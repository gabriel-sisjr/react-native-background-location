package com.backgroundlocation.database

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * Room entity for storing tracking state
 * Single row table to store current tracking session state
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
  val notificationTitle: String? = null,
  val notificationText: String? = null,
  val notificationChannelName: String? = null,
  val notificationPriority: String? = null,
  val foregroundOnly: Boolean? = null,
  val notificationSmallIcon: String? = null,
  val notificationColor: String? = null,
  val notificationShowTimestamp: Boolean? = null,
  val notificationActions: String? = null,
  val notificationLargeIcon: String? = null,
  val notificationSubtext: String? = null,
  val notificationChannelId: String? = null
)

