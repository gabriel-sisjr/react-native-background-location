import Foundation

/// Counts how often each check ran, to prove that later checks are skipped.
private final class CheckCounter {
  var usage = 0
  var availability = 0
  var authorization = 0
}

private func evaluate(
  compiled: Bool = true,
  usage: Any? = "Detects when you are stationary or driving.",
  available: Bool = true,
  status: MotionAuthorizationStatus = .authorized,
  counter: CheckCounter = CheckCounter()
) -> MotionPreconditionResult {
  return MotionPreconditions.evaluate(
    isCompiledIn: compiled,
    usageDescription: {
      counter.usage += 1
      return usage
    },
    isActivityAvailable: {
      counter.availability += 1
      return available
    },
    authorizationStatus: {
      counter.authorization += 1
      return status
    }
  )
}

func test_preconditions_flagOffIsNotCompiled() {
  let counter = CheckCounter()
  harness.expectEqual(evaluate(compiled: false, counter: counter), MotionPreconditionResult.notCompiled)
  harness.expectEqual(counter.usage + counter.availability + counter.authorization, 0, "no later check runs")
}

func test_preconditions_missingOrBlankUsageDescription() {
  let values: [Any?] = [nil, "", "   ", " \n\t ", NSNumber(value: 1)]
  for value in values {
    let counter = CheckCounter()
    harness.expectEqual(evaluate(usage: value, counter: counter), MotionPreconditionResult.usageDescriptionMissing, "\(String(describing: value))")
    harness.expectEqual(counter.availability + counter.authorization, 0, "availability and authorization skipped")
  }
}

func test_preconditions_activityUnavailable() {
  let counter = CheckCounter()
  harness.expectEqual(evaluate(available: false, counter: counter), MotionPreconditionResult.activityUnavailable)
  harness.expectEqual(counter.authorization, 0, "authorization skipped")
}

func test_preconditions_authorizationStatuses() {
  harness.expectEqual(evaluate(status: .authorized), MotionPreconditionResult.ready)
  harness.expectEqual(evaluate(status: .notDetermined), MotionPreconditionResult.permissionNotDetermined)
  harness.expectEqual(evaluate(status: .denied), MotionPreconditionResult.permissionDenied)
  harness.expectEqual(evaluate(status: .restricted), MotionPreconditionResult.permissionDenied)
}

func test_preconditions_checkOrder() {
  // The first failing check wins: flag, usage description, availability, authorization.
  harness.expectEqual(
    evaluate(compiled: false, usage: nil, available: false, status: .denied),
    MotionPreconditionResult.notCompiled
  )
  harness.expectEqual(evaluate(usage: "", available: false, status: .denied), MotionPreconditionResult.usageDescriptionMissing)
  harness.expectEqual(evaluate(available: false, status: .notDetermined), MotionPreconditionResult.activityUnavailable)
}

func test_preconditions_permissionStatusMapping() {
  let cases: [(MotionPreconditionResult, MotionPermissionStatus)] = [
    (.notCompiled, .unavailable),
    (.usageDescriptionMissing, .unavailable),
    (.activityUnavailable, .unavailable),
    (.ready, .granted),
    (.permissionNotDetermined, .undetermined),
    (.permissionDenied, .denied),
  ]
  for (result, expected) in cases {
    harness.expectEqual(MotionPreconditions.permissionStatus(for: result), expected, "\(result)")
  }
  harness.expectEqual(MotionPreconditions.permissionStatus(for: MotionAuthorizationStatus.authorized), .granted)
  harness.expectEqual(MotionPreconditions.permissionStatus(for: MotionAuthorizationStatus.notDetermined), .undetermined)
  harness.expectEqual(MotionPreconditions.permissionStatus(for: MotionAuthorizationStatus.denied), .denied)
  harness.expectEqual(MotionPreconditions.permissionStatus(for: MotionAuthorizationStatus.restricted), .denied)
  harness.expectEqual(
    [MotionPermissionStatus.granted, .denied, .undetermined, .unavailable].map { $0.rawValue },
    ["granted", "denied", "undetermined", "unavailable"]
  )
}

func test_preconditions_detectionStatusMapping() {
  harness.expectEqual(MotionPreconditions.detectionStatus(for: .ready), MotionDetectionStatus.running)
  harness.expectEqual(MotionPreconditions.detectionStatus(for: .notCompiled), MotionDetectionStatus.unavailable)
  harness.expectEqual(MotionPreconditions.detectionStatus(for: .usageDescriptionMissing), MotionDetectionStatus.unavailable)
  harness.expectEqual(MotionPreconditions.detectionStatus(for: .activityUnavailable), MotionDetectionStatus.unavailable)
  harness.expectEqual(MotionPreconditions.detectionStatus(for: .permissionNotDetermined), MotionDetectionStatus.permissionNotGranted)
  harness.expectEqual(MotionPreconditions.detectionStatus(for: .permissionDenied), MotionDetectionStatus.permissionNotGranted)
}

func test_preconditions_detectionWarnings() {
  harness.expect(MotionWarning.detection(for: .ready) == nil, "no warning when ready")
  harness.expectEqual(
    MotionWarning.detection(for: .notCompiled),
    MotionWarning(
      type: "MOTION_ACTIVITY_UNAVAILABLE",
      message: "Motion activity is not compiled into this app. Set $BackgroundLocationMotionActivity = true in the Podfile (or add the motionActivity plugin prop) and reinstall pods. Location tracking continues at full accuracy."
    )
  )
  harness.expectEqual(
    MotionWarning.detection(for: .usageDescriptionMissing),
    MotionWarning(
      type: "MOTION_ACTIVITY_UNAVAILABLE",
      message: "NSMotionUsageDescription is missing from Info.plist. Location tracking continues at full accuracy."
    )
  )
  harness.expectEqual(
    MotionWarning.detection(for: .activityUnavailable),
    MotionWarning(
      type: "MOTION_ACTIVITY_UNAVAILABLE",
      message: "Motion activity is not available on this device. Location tracking continues at full accuracy."
    )
  )
  harness.expectEqual(
    MotionWarning.detection(for: .permissionNotDetermined),
    MotionWarning(
      type: "MOTION_PERMISSION_NOT_GRANTED",
      message: "Motion & Fitness permission has not been requested. Call requestMotionPermission() before startTracking(). Location tracking continues at full accuracy."
    )
  )
  harness.expectEqual(
    MotionWarning.detection(for: .permissionDenied),
    MotionWarning(
      type: "MOTION_PERMISSION_NOT_GRANTED",
      message: "Motion & Fitness permission is denied. Location tracking continues at full accuracy."
    )
  )
  harness.expectEqual(
    MotionWarning.revoked,
    MotionWarning(
      type: "MOTION_PERMISSION_NOT_GRANTED",
      message: "Motion activity permission was revoked. Location tracking continues at full accuracy."
    )
  )
}

func test_preconditions_gateWarnings() {
  harness.expectEqual(
    MotionWarning.reduced,
    MotionWarning(type: "MOTION_LOCATION_REDUCED", message: "Device stationary; location updates reduced to save battery.")
  )
  let restored: [(MotionGate.RestoreReason, String)] = [
    (.motion, "Movement detected; full-accuracy location updates restored."),
    (.displacement, "Device moved while updates were reduced; full-accuracy location updates restored."),
    (.detectionLost, "Motion activity stopped; full-accuracy location updates restored."),
    (.sessionRestart, "Tracking restarted; full-accuracy location updates restored."),
  ]
  for (reason, message) in restored {
    harness.expectEqual(
      MotionWarning.restored(reason),
      MotionWarning(type: "MOTION_LOCATION_RESTORED", message: message),
      reason.rawValue
    )
  }
}

let motionPreconditionsTests: [TestCase] = [
  ("test_preconditions_flagOffIsNotCompiled", test_preconditions_flagOffIsNotCompiled),
  ("test_preconditions_missingOrBlankUsageDescription", test_preconditions_missingOrBlankUsageDescription),
  ("test_preconditions_activityUnavailable", test_preconditions_activityUnavailable),
  ("test_preconditions_authorizationStatuses", test_preconditions_authorizationStatuses),
  ("test_preconditions_checkOrder", test_preconditions_checkOrder),
  ("test_preconditions_permissionStatusMapping", test_preconditions_permissionStatusMapping),
  ("test_preconditions_detectionStatusMapping", test_preconditions_detectionStatusMapping),
  ("test_preconditions_detectionWarnings", test_preconditions_detectionWarnings),
  ("test_preconditions_gateWarnings", test_preconditions_gateWarnings),
]
