package com.backgroundlocation.provider

import com.google.android.gms.location.Priority

/**
 * Low-power request a [LocationProvider] switches to while location updates are reduced.
 * It keeps a request alive (never a stop), so the foreground service and its pipeline
 * stay warm and coarse fixes can still reveal a displacement.
 *
 * @property priority A `com.google.android.gms.location.Priority` constant.
 * @property intervalMs Desired interval between fixes.
 * @property fastestIntervalMs Fastest accepted interval between fixes.
 * @property minDistanceM Minimum displacement between fixes; `0` disables the filter.
 */
data class ReducedLocationProfile(
  val priority: Int,
  val intervalMs: Long,
  val fastestIntervalMs: Long,
  val minDistanceM: Float
) {
  companion object {
    /** Profile applied while the device is stationary. */
    val STATIONARY = ReducedLocationProfile(
      priority = Priority.PRIORITY_LOW_POWER,
      intervalMs = 60_000L,
      fastestIntervalMs = 30_000L,
      minDistanceM = 0f
    )
  }
}
