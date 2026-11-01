import Foundation

/// Library activity values. Raw values are the strings JavaScript receives.
enum MotionActivityType: String, Equatable {
  case stationary = "STATIONARY"
  case walking = "WALKING"
  case running = "RUNNING"
  case cycling = "CYCLING"
  case automotive = "AUTOMOTIVE"
  case unknown = "UNKNOWN"
}

/// Library confidence values. Raw values are the strings JavaScript receives.
enum MotionConfidence: String, Equatable {
  case low = "LOW"
  case medium = "MEDIUM"
  case high = "HIGH"
}

/// One activity reading copied into plain values, so code outside the CoreMotion source
/// never touches CoreMotion types. The flags are not mutually exclusive.
struct MotionReading: Equatable {
  var stationary: Bool
  var walking: Bool
  var running: Bool
  var cycling: Bool
  var automotive: Bool
  var unknown: Bool
  /// Raw confidence value: 0 low, 1 medium, 2 high.
  var confidenceRawValue: Int
  /// Start of the activity, in milliseconds since 1970.
  var timestampMs: Double
}

/// A normalized activity sample.
struct MotionSample: Equatable {
  let activity: MotionActivityType
  let confidence: MotionConfidence
  /// Gate input only; never part of the event payload.
  let vehicleEvidence: Bool
  /// Milliseconds since 1970.
  let timestampMs: Double
}

/// Maps raw readings onto the library's activity, confidence and gate input classes.
enum MotionNormalization {
  /// Priority when several flags are set: automotive > cycling > running > walking > unknown > stationary.
  /// A red light (automotive and stationary) is therefore AUTOMOTIVE, and all flags false is UNKNOWN.
  static func activity(for reading: MotionReading) -> MotionActivityType {
    if reading.automotive {
      return .automotive
    }
    if reading.cycling {
      return .cycling
    }
    if reading.running {
      return .running
    }
    if reading.walking {
      return .walking
    }
    if reading.unknown {
      return .unknown
    }
    if reading.stationary {
      return .stationary
    }
    return .unknown
  }

  /// Maps the raw confidence value; anything unexpected is treated as LOW, which never reduces.
  static func confidence(rawValue: Int) -> MotionConfidence {
    switch rawValue {
    case 2:
      return .high
    case 1:
      return .medium
    default:
      return .low
    }
  }

  /// Builds the normalized sample. Vehicle evidence is the automotive flag, at any confidence.
  static func sample(from reading: MotionReading) -> MotionSample {
    return MotionSample(
      activity: activity(for: reading),
      confidence: confidence(rawValue: reading.confidenceRawValue),
      vehicleEvidence: reading.automotive,
      timestampMs: reading.timestampMs
    )
  }

  /// Classifies a sample for the reduction gate.
  static func gateInput(for sample: MotionSample) -> MotionGate.Input {
    if sample.vehicleEvidence {
      return .vehicle
    }
    switch (sample.activity, sample.confidence) {
    case (.stationary, .high):
      return .stillHigh
    case (.stationary, .medium):
      return .stillMedium
    default:
      return .movement
    }
  }
}
