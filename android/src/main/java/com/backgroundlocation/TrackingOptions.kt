package com.backgroundlocation

/**
 * Data class representing tracking configuration options.
 */
data class TrackingOptions(
  val updateInterval: Long? = null,
  val fastestInterval: Long? = null,
  val maxWaitTime: Long? = null,
  val accuracy: LocationAccuracy? = null,
  val waitForAccurateLocation: Boolean? = null,
  val foregroundOnly: Boolean? = null,
  val distanceFilter: Float? = null,
  val notificationOptions: NotificationOptions? = null
) {
  companion object {
    // Default values
    const val DEFAULT_UPDATE_INTERVAL = 5000L // 5 seconds
    const val DEFAULT_FASTEST_INTERVAL = 3000L // 3 seconds
    const val DEFAULT_MAX_WAIT_TIME = 10000L // 10 seconds
    const val DEFAULT_WAIT_FOR_ACCURATE_LOCATION = false
    const val DEFAULT_NOTIFICATION_TITLE = "Location Tracking"
    const val DEFAULT_NOTIFICATION_TEXT = "Tracking your location in background"
    const val DEFAULT_NOTIFICATION_CHANNEL_NAME = "Background Location"
    const val DEFAULT_NOTIFICATION_PRIORITY = "LOW"
    const val DEFAULT_FOREGROUND_ONLY = false
    const val DEFAULT_DISTANCE_FILTER = 0f // No distance filter
    const val DEFAULT_NOTIFICATION_SHOW_TIMESTAMP = false
  }

  // --- Computed property accessors for fields that LocationService.kt accesses directly ---

  val notificationSmallIcon: String? get() = notificationOptions?.smallIcon
  val notificationColor: String? get() = notificationOptions?.color
  val notificationLargeIcon: String? get() = notificationOptions?.largeIcon
  val notificationSubtext: String? get() = notificationOptions?.subtext
  val notificationActions: String? get() = notificationOptions?.actions
  val notificationChannelId: String? get() = notificationOptions?.channelId

  // --- Default-fallback accessors ---

  /**
   * Gets the update interval with default fallback
   */
  fun getUpdateIntervalOrDefault(): Long = updateInterval ?: DEFAULT_UPDATE_INTERVAL

  /**
   * Gets the fastest interval with default fallback
   */
  fun getFastestIntervalOrDefault(): Long = fastestInterval ?: DEFAULT_FASTEST_INTERVAL

  /**
   * Gets the max wait time with default fallback
   */
  fun getMaxWaitTimeOrDefault(): Long = maxWaitTime ?: DEFAULT_MAX_WAIT_TIME

  /**
   * Gets the accuracy with default fallback
   */
  fun getAccuracyOrDefault(): LocationAccuracy = accuracy ?: LocationAccuracy.HIGH_ACCURACY

  /**
   * Gets waitForAccurateLocation with default fallback
   */
  fun getWaitForAccurateLocationOrDefault(): Boolean = waitForAccurateLocation ?: DEFAULT_WAIT_FOR_ACCURATE_LOCATION

  /**
   * Gets the notification title with default fallback
   */
  fun getNotificationTitleOrDefault(): String = notificationOptions?.title ?: DEFAULT_NOTIFICATION_TITLE

  /**
   * Gets the notification text with default fallback
   */
  fun getNotificationTextOrDefault(): String = notificationOptions?.text ?: DEFAULT_NOTIFICATION_TEXT

  /**
   * Gets the notification channel name with default fallback
   */
  fun getNotificationChannelNameOrDefault(): String = notificationOptions?.channelName ?: DEFAULT_NOTIFICATION_CHANNEL_NAME

  /**
   * Gets the notification priority with default fallback
   */
  fun getNotificationPriorityOrDefault(): String = notificationOptions?.priority ?: DEFAULT_NOTIFICATION_PRIORITY

  /**
   * Gets foregroundOnly with default fallback
   */
  fun getForegroundOnlyOrDefault(): Boolean = foregroundOnly ?: DEFAULT_FOREGROUND_ONLY

  /**
   * Gets the distance filter with default fallback
   */
  fun getDistanceFilterOrDefault(): Float = distanceFilter ?: DEFAULT_DISTANCE_FILTER

  /**
   * Gets notificationShowTimestamp with default fallback
   */
  fun getNotificationShowTimestampOrDefault(): Boolean = notificationOptions?.showTimestamp ?: DEFAULT_NOTIFICATION_SHOW_TIMESTAMP
}
