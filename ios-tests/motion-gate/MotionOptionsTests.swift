import Foundation

private func options(
  enabled: Bool? = true,
  reduce: Bool? = nil,
  stationaryDelay: Double? = nil,
  automotiveCooldown: Double? = nil,
  maxReducedDuration: Double? = nil
) -> MotionOptions? {
  return MotionOptions.normalized(
    enabled: enabled,
    reduceWhenStationary: reduce,
    stationaryDelayMs: stationaryDelay,
    automotiveCooldownMs: automotiveCooldown,
    maxReducedDurationMs: maxReducedDuration
  )
}

func test_options_defaults() {
  harness.expectEqual(
    options(),
    MotionOptions(
      reduceWhenStationary: false,
      stationaryDelayMs: 300_000,
      automotiveCooldownMs: 600_000,
      maxReducedDurationMs: 1_800_000
    )
  )
  harness.expectEqual(options(reduce: true)?.reduceWhenStationary, true)
  harness.expectEqual(options(reduce: false)?.reduceWhenStationary, false)
}

func test_options_clamps() {
  // Below the range
  harness.expectEqual(options(stationaryDelay: -1)?.stationaryDelayMs, 60_000)
  harness.expectEqual(options(stationaryDelay: 0)?.stationaryDelayMs, 60_000)
  harness.expectEqual(options(automotiveCooldown: 1)?.automotiveCooldownMs, 120_000)
  harness.expectEqual(options(maxReducedDuration: 299_999)?.maxReducedDurationMs, 300_000)
  // Above the range
  harness.expectEqual(options(stationaryDelay: 1e12)?.stationaryDelayMs, 3_600_000)
  harness.expectEqual(options(automotiveCooldown: Double.greatestFiniteMagnitude)?.automotiveCooldownMs, 3_600_000)
  harness.expectEqual(options(maxReducedDuration: 3_600_001)?.maxReducedDurationMs, 3_600_000)
  // Non-finite values fall back to the defaults
  harness.expectEqual(options(stationaryDelay: Double.nan)?.stationaryDelayMs, 300_000)
  harness.expectEqual(options(automotiveCooldown: Double.infinity)?.automotiveCooldownMs, 600_000)
  harness.expectEqual(options(maxReducedDuration: -Double.infinity)?.maxReducedDurationMs, 1_800_000)
  // Fractional values are rounded like Math.round
  harness.expectEqual(options(stationaryDelay: 90_000.4)?.stationaryDelayMs, 90_000)
  harness.expectEqual(options(stationaryDelay: 90_000.5)?.stationaryDelayMs, 90_001)
  // In-range values are kept
  harness.expectEqual(options(automotiveCooldown: 240_000)?.automotiveCooldownMs, 240_000)
}

func test_options_reduceWithoutEnabledIsNil() {
  harness.expect(options(enabled: nil, reduce: true) == nil, "reduction without detection is ignored")
  harness.expect(options(enabled: false, reduce: true) == nil, "disabled detection gives no options")
  harness.expect(options(enabled: false) == nil, "disabled detection gives no options")
}

let motionOptionsTests: [TestCase] = [
  ("test_options_defaults", test_options_defaults),
  ("test_options_clamps", test_options_clamps),
  ("test_options_reduceWithoutEnabledIsNil", test_options_reduceWithoutEnabledIsNil),
]
