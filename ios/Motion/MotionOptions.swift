import Foundation

/// Motion options as iOS applies them: JavaScript defaults and clamps applied again.
/// Durations are integer milliseconds. The sampling interval and notification text are
/// Android-only and never reach iOS.
struct MotionOptions: Equatable {
  static let defaultStationaryDelayMs = 300_000
  static let stationaryDelayRangeMs = 60_000...3_600_000
  static let defaultAutomotiveCooldownMs = 600_000
  static let automotiveCooldownRangeMs = 120_000...3_600_000
  static let defaultMaxReducedDurationMs = 1_800_000
  static let maxReducedDurationRangeMs = 300_000...3_600_000

  /// Whether reduction of location updates while stationary was requested.
  let reduceWhenStationary: Bool
  /// Continuous STATIONARY/HIGH time required before reducing.
  let stationaryDelayMs: Int
  /// Minimum time since the last vehicle evidence, and since the session started, before reducing.
  let automotiveCooldownMs: Int
  /// Longest reduced period before one full-accuracy fix is forced.
  let maxReducedDurationMs: Int

  /// Returns nil unless `enabled` is true; a reduction flag without detection is ignored.
  /// Absent or non-finite durations fall back to the defaults; others are clamped and rounded.
  static func normalized(
    enabled: Bool?,
    reduceWhenStationary: Bool?,
    stationaryDelayMs: Double?,
    automotiveCooldownMs: Double?,
    maxReducedDurationMs: Double?
  ) -> MotionOptions? {
    guard enabled == true else {
      return nil
    }
    return MotionOptions(
      reduceWhenStationary: reduceWhenStationary == true,
      stationaryDelayMs: clamped(stationaryDelayMs, to: stationaryDelayRangeMs, fallback: defaultStationaryDelayMs),
      automotiveCooldownMs: clamped(
        automotiveCooldownMs,
        to: automotiveCooldownRangeMs,
        fallback: defaultAutomotiveCooldownMs
      ),
      maxReducedDurationMs: clamped(
        maxReducedDurationMs,
        to: maxReducedDurationRangeMs,
        fallback: defaultMaxReducedDurationMs
      )
    )
  }

  /// Clamps to `range` and rounds half away from zero (the same result as `Math.round` for these
  /// positive ranges). Absent or non-finite values give `fallback`.
  static func clamped(_ value: Double?, to range: ClosedRange<Int>, fallback: Int) -> Int {
    guard let value = value, value.isFinite else {
      return fallback
    }
    let bounded = min(max(value, Double(range.lowerBound)), Double(range.upperBound))
    return Int(bounded.rounded())
  }
}
