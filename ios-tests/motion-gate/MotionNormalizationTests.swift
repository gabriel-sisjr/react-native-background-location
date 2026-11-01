import Foundation

private func reading(
  stationary: Bool = false,
  walking: Bool = false,
  running: Bool = false,
  cycling: Bool = false,
  automotive: Bool = false,
  unknown: Bool = false,
  confidence: Int = 2,
  timestampMs: Double = 1_761_500_000_000
) -> MotionReading {
  return MotionReading(
    stationary: stationary,
    walking: walking,
    running: running,
    cycling: cycling,
    automotive: automotive,
    unknown: unknown,
    confidenceRawValue: confidence,
    timestampMs: timestampMs
  )
}

func test_normalization_automotiveAndStationaryIsAutomotive() {
  // A red light: both flags set. Vehicle evidence wins for the gate as well.
  let sample = MotionNormalization.sample(from: reading(stationary: true, automotive: true))
  harness.expectEqual(sample.activity, MotionActivityType.automotive)
  harness.expect(sample.vehicleEvidence, "automotive is vehicle evidence")
  harness.expectEqual(MotionNormalization.gateInput(for: sample), MotionGate.Input.vehicle)
}

func test_normalization_cyclingAndWalkingIsCycling() {
  let sample = MotionNormalization.sample(from: reading(walking: true, cycling: true))
  harness.expectEqual(sample.activity, MotionActivityType.cycling)
  harness.expectEqual(MotionNormalization.gateInput(for: sample), MotionGate.Input.movement)
}

func test_normalization_runningAndWalkingIsRunning() {
  let sample = MotionNormalization.sample(from: reading(walking: true, running: true))
  harness.expectEqual(sample.activity, MotionActivityType.running)
}

func test_normalization_unknownAndStationaryIsUnknown() {
  let sample = MotionNormalization.sample(from: reading(stationary: true, unknown: true))
  harness.expectEqual(sample.activity, MotionActivityType.unknown)
  harness.expectEqual(MotionNormalization.gateInput(for: sample), MotionGate.Input.movement)
}

func test_normalization_allFalseIsUnknown() {
  let sample = MotionNormalization.sample(from: reading())
  harness.expectEqual(sample.activity, MotionActivityType.unknown)
  harness.expect(!sample.vehicleEvidence, "no vehicle evidence")
  harness.expectEqual(MotionNormalization.gateInput(for: sample), MotionGate.Input.movement)
}

func test_normalization_stationaryAloneIsStationary() {
  let sample = MotionNormalization.sample(from: reading(stationary: true))
  harness.expectEqual(sample.activity, MotionActivityType.stationary)
}

func test_normalization_confidenceRawValues() {
  harness.expectEqual(MotionNormalization.confidence(rawValue: 0), MotionConfidence.low)
  harness.expectEqual(MotionNormalization.confidence(rawValue: 1), MotionConfidence.medium)
  harness.expectEqual(MotionNormalization.confidence(rawValue: 2), MotionConfidence.high)
  harness.expectEqual(MotionNormalization.confidence(rawValue: -1), MotionConfidence.low, "unexpected values are LOW")
  harness.expectEqual(MotionNormalization.confidence(rawValue: 3), MotionConfidence.low, "unexpected values are LOW")
}

func test_normalization_gateInputClasses() {
  let cases: [(MotionReading, MotionGate.Input)] = [
    (reading(stationary: true, confidence: 2), .stillHigh),
    (reading(stationary: true, confidence: 1), .stillMedium),
    (reading(stationary: true, confidence: 0), .movement),
    (reading(walking: true, confidence: 2), .movement),
    (reading(running: true, confidence: 0), .movement),
    (reading(cycling: true, confidence: 1), .movement),
    (reading(unknown: true, confidence: 2), .movement),
    (reading(automotive: true, confidence: 0), .vehicle),
    (reading(stationary: true, automotive: true, confidence: 2), .vehicle),
  ]
  for (input, expected) in cases {
    let sample = MotionNormalization.sample(from: input)
    harness.expectEqual(MotionNormalization.gateInput(for: sample), expected, "\(input)")
  }
}

func test_normalization_eventFieldsPassThrough() {
  let sample = MotionNormalization.sample(from: reading(walking: true, confidence: 1, timestampMs: 1_761_500_123_456))
  harness.expectEqual(sample.activity.rawValue, "WALKING")
  harness.expectEqual(sample.confidence.rawValue, "MEDIUM")
  harness.expectEqual(sample.timestampMs, 1_761_500_123_456)
}

let motionNormalizationTests: [TestCase] = [
  ("test_normalization_automotiveAndStationaryIsAutomotive", test_normalization_automotiveAndStationaryIsAutomotive),
  ("test_normalization_cyclingAndWalkingIsCycling", test_normalization_cyclingAndWalkingIsCycling),
  ("test_normalization_runningAndWalkingIsRunning", test_normalization_runningAndWalkingIsRunning),
  ("test_normalization_unknownAndStationaryIsUnknown", test_normalization_unknownAndStationaryIsUnknown),
  ("test_normalization_allFalseIsUnknown", test_normalization_allFalseIsUnknown),
  ("test_normalization_stationaryAloneIsStationary", test_normalization_stationaryAloneIsStationary),
  ("test_normalization_confidenceRawValues", test_normalization_confidenceRawValues),
  ("test_normalization_gateInputClasses", test_normalization_gateInputClasses),
  ("test_normalization_eventFieldsPassThrough", test_normalization_eventFieldsPassThrough),
]
