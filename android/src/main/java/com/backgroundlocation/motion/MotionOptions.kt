package com.backgroundlocation.motion

import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType
import org.json.JSONObject

/**
 * Native options of the opt-in motion activity feature, held by `TrackingOptions.motion`.
 * `null` options mean the feature is off for the session.
 *
 * Build instances through [normalized], [fromReadableMap] or [fromJsonString]: they apply
 * the documented defaults and clamp every duration to its range.
 *
 * @property sampleIntervalMs Activity Recognition sampling interval (Android only).
 * @property reduceWhenStationary Whether location updates may be reduced while stationary.
 * @property stationaryDelayMs Continuous STATIONARY/HIGH time required before reducing.
 * @property automotiveCooldownMs Minimum time since the last vehicle evidence (and since
 * the session started) before reducing.
 * @property maxReducedDurationMs Longest reduced period before one full-accuracy fix is forced.
 * @property reducedNotificationText Foreground-notification text while reduced; `null` uses
 * [DEFAULT_REDUCED_NOTIFICATION_TEXT].
 */
data class MotionOptions(
  val sampleIntervalMs: Long = DEFAULT_SAMPLE_INTERVAL_MS,
  val reduceWhenStationary: Boolean = false,
  val stationaryDelayMs: Long = DEFAULT_STATIONARY_DELAY_MS,
  val automotiveCooldownMs: Long = DEFAULT_AUTOMOTIVE_COOLDOWN_MS,
  val maxReducedDurationMs: Long = DEFAULT_MAX_REDUCED_DURATION_MS,
  val reducedNotificationText: String? = null
) {
  /** Foreground-notification text shown while location updates are reduced. */
  val reducedNotificationTextOrDefault: String
    get() = reducedNotificationText ?: DEFAULT_REDUCED_NOTIFICATION_TEXT

  /** Serializes the options; the JSON keys are the property names. */
  fun toJsonString(): String {
    val json = JSONObject()
      .put(JSON_SAMPLE_INTERVAL, sampleIntervalMs)
      .put(JSON_REDUCE, reduceWhenStationary)
      .put(JSON_STATIONARY_DELAY, stationaryDelayMs)
      .put(JSON_AUTOMOTIVE_COOLDOWN, automotiveCooldownMs)
      .put(JSON_MAX_REDUCED_DURATION, maxReducedDurationMs)
    reducedNotificationText?.let { json.put(JSON_NOTIFICATION_TEXT, it) }
    return json.toString()
  }

  companion object {
    const val DEFAULT_SAMPLE_INTERVAL_MS = 30_000L
    const val MIN_SAMPLE_INTERVAL_MS = 10_000L
    const val MAX_SAMPLE_INTERVAL_MS = 300_000L

    const val DEFAULT_STATIONARY_DELAY_MS = 300_000L
    const val MIN_STATIONARY_DELAY_MS = 60_000L
    const val MAX_STATIONARY_DELAY_MS = 3_600_000L

    const val DEFAULT_AUTOMOTIVE_COOLDOWN_MS = 600_000L
    const val MIN_AUTOMOTIVE_COOLDOWN_MS = 120_000L
    const val MAX_AUTOMOTIVE_COOLDOWN_MS = 3_600_000L

    const val DEFAULT_MAX_REDUCED_DURATION_MS = 1_800_000L
    const val MIN_MAX_REDUCED_DURATION_MS = 300_000L
    const val MAX_MAX_REDUCED_DURATION_MS = 3_600_000L

    const val DEFAULT_REDUCED_NOTIFICATION_TEXT = "Location updates reduced while stationary"

    // TurboModule (Codegen) option keys; every one of them is absent when the feature is off.
    internal const val KEY_ENABLED = "motionActivityEnabled"
    internal const val KEY_SAMPLE_INTERVAL = "motionSampleInterval"
    internal const val KEY_REDUCE = "motionReduceWhenStationary"
    internal const val KEY_STATIONARY_DELAY = "motionStationaryDelay"
    internal const val KEY_AUTOMOTIVE_COOLDOWN = "motionAutomotiveCooldown"
    internal const val KEY_MAX_REDUCED_DURATION = "motionMaxReducedDuration"
    internal const val KEY_NOTIFICATION_TEXT = "motionReducedNotificationText"

    private const val JSON_SAMPLE_INTERVAL = "sampleIntervalMs"
    private const val JSON_REDUCE = "reduceWhenStationary"
    private const val JSON_STATIONARY_DELAY = "stationaryDelayMs"
    private const val JSON_AUTOMOTIVE_COOLDOWN = "automotiveCooldownMs"
    private const val JSON_MAX_REDUCED_DURATION = "maxReducedDurationMs"
    private const val JSON_NOTIFICATION_TEXT = "reducedNotificationText"

    /**
     * Applies the defaults and ranges. A `null` or non-finite number takes the default;
     * a finite one is clamped to its range and rounded to whole milliseconds. A blank
     * notification text is dropped.
     */
    fun normalized(
      sampleInterval: Double? = null,
      reduceWhenStationary: Boolean = false,
      stationaryDelay: Double? = null,
      automotiveCooldown: Double? = null,
      maxReducedDuration: Double? = null,
      reducedNotificationText: String? = null
    ): MotionOptions = MotionOptions(
      sampleIntervalMs = clamp(sampleInterval, DEFAULT_SAMPLE_INTERVAL_MS, MIN_SAMPLE_INTERVAL_MS, MAX_SAMPLE_INTERVAL_MS),
      reduceWhenStationary = reduceWhenStationary,
      stationaryDelayMs = clamp(stationaryDelay, DEFAULT_STATIONARY_DELAY_MS, MIN_STATIONARY_DELAY_MS, MAX_STATIONARY_DELAY_MS),
      automotiveCooldownMs = clamp(
        automotiveCooldown,
        DEFAULT_AUTOMOTIVE_COOLDOWN_MS,
        MIN_AUTOMOTIVE_COOLDOWN_MS,
        MAX_AUTOMOTIVE_COOLDOWN_MS
      ),
      maxReducedDurationMs = clamp(
        maxReducedDuration,
        DEFAULT_MAX_REDUCED_DURATION_MS,
        MIN_MAX_REDUCED_DURATION_MS,
        MAX_MAX_REDUCED_DURATION_MS
      ),
      reducedNotificationText = reducedNotificationText?.takeIf { it.isNotBlank() }
    )

    /**
     * Reads the motion keys of the TurboModule options. Returns `null` (feature off) unless
     * `motionActivityEnabled` is the boolean `true`; a reduction flag without it is ignored.
     * Absent, null and wrong-typed keys fall back to the defaults; nothing throws.
     */
    fun fromReadableMap(options: ReadableMap?): MotionOptions? {
      if (options == null || options.booleanOrNull(KEY_ENABLED) != true) return null
      return normalized(
        sampleInterval = options.finiteNumberOrNull(KEY_SAMPLE_INTERVAL),
        reduceWhenStationary = options.booleanOrNull(KEY_REDUCE) == true,
        stationaryDelay = options.finiteNumberOrNull(KEY_STATIONARY_DELAY),
        automotiveCooldown = options.finiteNumberOrNull(KEY_AUTOMOTIVE_COOLDOWN),
        maxReducedDuration = options.finiteNumberOrNull(KEY_MAX_REDUCED_DURATION),
        reducedNotificationText = options.stringOrNull(KEY_NOTIFICATION_TEXT)
      )
    }

    /**
     * Parses [toJsonString] output (service Bundle, Room). Returns `null` for `null` or
     * malformed JSON; values are clamped again, so stored out-of-range values are safe.
     */
    fun fromJsonString(json: String?): MotionOptions? {
      if (json == null) return null
      return try {
        val obj = JSONObject(json)
        normalized(
          sampleInterval = (obj.opt(JSON_SAMPLE_INTERVAL) as? Number)?.toDouble(),
          reduceWhenStationary = obj.opt(JSON_REDUCE) as? Boolean ?: false,
          stationaryDelay = (obj.opt(JSON_STATIONARY_DELAY) as? Number)?.toDouble(),
          automotiveCooldown = (obj.opt(JSON_AUTOMOTIVE_COOLDOWN) as? Number)?.toDouble(),
          maxReducedDuration = (obj.opt(JSON_MAX_REDUCED_DURATION) as? Number)?.toDouble(),
          reducedNotificationText = obj.opt(JSON_NOTIFICATION_TEXT) as? String
        )
      } catch (e: Exception) {
        null
      }
    }

    private fun clamp(value: Double?, default: Long, min: Long, max: Long): Long {
      if (value == null || !value.isFinite()) return default
      return Math.round(value.coerceIn(min.toDouble(), max.toDouble()))
    }

    private fun ReadableMap.isPresent(key: String, type: ReadableType): Boolean =
      hasKey(key) && !isNull(key) && getType(key) == type

    private fun ReadableMap.booleanOrNull(key: String): Boolean? =
      if (isPresent(key, ReadableType.Boolean)) getBoolean(key) else null

    private fun ReadableMap.finiteNumberOrNull(key: String): Double? =
      if (isPresent(key, ReadableType.Number)) getDouble(key).takeIf { it.isFinite() } else null

    private fun ReadableMap.stringOrNull(key: String): String? =
      if (isPresent(key, ReadableType.String)) getString(key) else null
  }
}
