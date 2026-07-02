package com.backgroundlocation

/**
 * Data class representing tracking configuration options.
 *
 * Default values are inlined as safety-net fallbacks in `get*OrDefault()`
 * methods. The authoritative source of defaults is
 * `src/utils/trackingOptionsDefaults.ts` — the JS mapper always sends
 * every field explicitly, so the `?:` branch here is only reached during
 * recovery/storage paths where the field was not persisted.
 */
data class TrackingOptions(
  val updateInterval: Long? = null,
  val fastestInterval: Long? = null,
  val maxWaitTime: Long? = null,
  val accuracy: LocationAccuracy? = null,
  val waitForAccurateLocation: Boolean? = null,
  val foregroundOnly: Boolean? = null,
  val distanceFilter: Float? = null,
  val notificationOptions: NotificationOptions? = null,
  val activityTrackingEnabled: Boolean? = null,
  val pauseLocationWhenStill: Boolean? = null,
  val activityUpdateInterval: Long? = null
) {
  // --- Computed property accessors for fields that LocationService.kt accesses directly ---

  val notificationSmallIcon: String? get() = notificationOptions?.smallIcon
  val notificationColor: String? get() = notificationOptions?.color
  val notificationLargeIcon: String? get() = notificationOptions?.largeIcon
  val notificationSubtext: String? get() = notificationOptions?.subtext
  val notificationActions: String? get() = notificationOptions?.actions
  val notificationChannelId: String? get() = notificationOptions?.channelId

  // --- Safety-net default-fallback accessors ---
  // (Authoritative defaults live in src/utils/trackingOptionsDefaults.ts)

  fun getUpdateIntervalOrDefault(): Long = updateInterval ?: 5000L
  fun getFastestIntervalOrDefault(): Long = fastestInterval ?: 3000L
  fun getMaxWaitTimeOrDefault(): Long = maxWaitTime ?: 10000L
  fun getAccuracyOrDefault(): LocationAccuracy = accuracy ?: LocationAccuracy.HIGH_ACCURACY
  fun getWaitForAccurateLocationOrDefault(): Boolean = waitForAccurateLocation ?: false
  fun getNotificationTitleOrDefault(): String = notificationOptions?.title ?: "Location Tracking"
  fun getNotificationTextOrDefault(): String = notificationOptions?.text ?: "Tracking your location in background"
  fun getNotificationChannelNameOrDefault(): String = notificationOptions?.channelName ?: "Background Location"
  fun getNotificationPriorityOrDefault(): String = notificationOptions?.priority ?: "LOW"
  fun getForegroundOnlyOrDefault(): Boolean = foregroundOnly ?: false
  fun getDistanceFilterOrDefault(): Float = distanceFilter ?: 0f
  fun getNotificationShowTimestampOrDefault(): Boolean = notificationOptions?.showTimestamp ?: false
  fun getActivityTrackingEnabledOrDefault(): Boolean = activityTrackingEnabled ?: false
  fun getPauseLocationWhenStillOrDefault(): Boolean = pauseLocationWhenStill ?: false
  fun getActivityUpdateIntervalOrDefault(): Long = activityUpdateInterval ?: 60000L
}
