package com.backgroundlocation.provider

import android.app.PendingIntent
import android.content.Context

/**
 * Abstract interface for activity recognition providers.
 * Allows structured management of activity transitions and continuous updates.
 */
interface ActivityProvider {

  /**
   * Initialize the provider with context
   */
  fun initialize(context: Context)

  /**
   * Request periodic updates on the user's current activity.
   * Uses a polling-based approach.
   * @param intervalMs The specified interval for updates (e.g., every 30 seconds).
   * @param pendingIntent The intent that receives the activity updates.
   */
  fun requestActivityUpdates(intervalMs: Long, pendingIntent: PendingIntent)

  /**
   * Stop periodic activity updates.
   */
  fun removeActivityUpdates(pendingIntent: PendingIntent)

  /**
   * Check if this provider is available on the device.
   */
  fun isAvailable(): Boolean

  /**
   * Cleanup resources.
   */
  fun cleanup()
}
