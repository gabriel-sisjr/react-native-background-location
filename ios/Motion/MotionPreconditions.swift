import Foundation

/// Motion & Fitness authorization, mirrored without CoreMotion types.
enum MotionAuthorizationStatus: Equatable {
  case notDetermined
  case restricted
  case denied
  case authorized
}

/// Outcome of the start-up checks, in the order they are evaluated.
enum MotionPreconditionResult: Equatable {
  /// Every check passed; the activity manager may be created.
  case ready
  /// CoreMotion support is not compiled into this build.
  case notCompiled
  /// `NSMotionUsageDescription` is missing from Info.plist, or blank.
  case usageDescriptionMissing
  /// The device cannot report motion activity.
  case activityUnavailable
  /// The user has not been asked yet. Tracking never prompts.
  case permissionNotDetermined
  /// The user denied access, or access is restricted.
  case permissionDenied
}

/// Permission status strings returned to JavaScript.
enum MotionPermissionStatus: String, Equatable {
  case granted
  case denied
  case undetermined
  case unavailable
}

/// Detection status strings reported by the state snapshot.
enum MotionDetectionStatus: String, Equatable {
  case off = "OFF"
  case running = "RUNNING"
  case unavailable = "UNAVAILABLE"
  case permissionNotGranted = "PERMISSION_NOT_GRANTED"
}

/// A location warning type with its exact message.
struct MotionWarning: Equatable {
  let type: String
  let message: String

  /// The session's detection failed for one of the start-up reasons; nil when it is ready.
  static func detection(for result: MotionPreconditionResult) -> MotionWarning? {
    switch result {
    case .ready:
      return nil
    case .notCompiled:
      return MotionWarning(
        type: "MOTION_ACTIVITY_UNAVAILABLE",
        message: "Motion activity is not compiled into this app. Set $BackgroundLocationMotionActivity = true in the Podfile (or add the motionActivity plugin prop) and reinstall pods. Location tracking continues at full accuracy."
      )
    case .usageDescriptionMissing:
      return MotionWarning(
        type: "MOTION_ACTIVITY_UNAVAILABLE",
        message: "NSMotionUsageDescription is missing from Info.plist. Location tracking continues at full accuracy."
      )
    case .activityUnavailable:
      return MotionWarning(
        type: "MOTION_ACTIVITY_UNAVAILABLE",
        message: "Motion activity is not available on this device. Location tracking continues at full accuracy."
      )
    case .permissionNotDetermined:
      return MotionWarning(
        type: "MOTION_PERMISSION_NOT_GRANTED",
        message: "Motion & Fitness permission has not been requested. Call requestMotionPermission() before startTracking(). Location tracking continues at full accuracy."
      )
    case .permissionDenied:
      return MotionWarning(
        type: "MOTION_PERMISSION_NOT_GRANTED",
        message: "Motion & Fitness permission is denied. Location tracking continues at full accuracy."
      )
    }
  }

  /// Access was revoked while the session was running (found on app-active, at the reduced-period
  /// limit, or when the dwell or the cooldown ends while a reduction is pending).
  static let revoked = MotionWarning(
    type: "MOTION_PERMISSION_NOT_GRANTED",
    message: "Motion activity permission was revoked. Location tracking continues at full accuracy."
  )

  /// The gate reduced location updates.
  static let reduced = MotionWarning(
    type: "MOTION_LOCATION_REDUCED",
    message: "Device stationary; location updates reduced to save battery."
  )

  /// The gate restored full-accuracy updates.
  static func restored(_ reason: MotionGate.RestoreReason) -> MotionWarning {
    let message: String
    switch reason {
    case .motion:
      message = "Movement detected; full-accuracy location updates restored."
    case .displacement:
      message = "Device moved while updates were reduced; full-accuracy location updates restored."
    case .detectionLost:
      message = "Motion activity stopped; full-accuracy location updates restored."
    case .sessionRestart:
      message = "Tracking restarted; full-accuracy location updates restored."
    }
    return MotionWarning(type: "MOTION_LOCATION_RESTORED", message: message)
  }
}

/// Start-up checks for motion activity. Nothing here prompts the user.
enum MotionPreconditions {
  /// Info.plist key that must hold a non-blank purpose string.
  static let usageDescriptionKey = "NSMotionUsageDescription"

  /// Evaluates, in order: compile flag, usage description, device availability, authorization.
  /// Later checks run only when the earlier ones pass.
  static func evaluate(
    isCompiledIn: Bool,
    usageDescription: () -> Any?,
    isActivityAvailable: () -> Bool,
    authorizationStatus: () -> MotionAuthorizationStatus
  ) -> MotionPreconditionResult {
    guard isCompiledIn else {
      return .notCompiled
    }
    guard isUsableUsageDescription(usageDescription()) else {
      return .usageDescriptionMissing
    }
    guard isActivityAvailable() else {
      return .activityUnavailable
    }
    switch authorizationStatus() {
    case .authorized:
      return .ready
    case .notDetermined:
      return .permissionNotDetermined
    case .denied, .restricted:
      return .permissionDenied
    }
  }

  /// True for a string that is not empty after trimming whitespace and newlines.
  static func isUsableUsageDescription(_ value: Any?) -> Bool {
    guard let text = value as? String else {
      return false
    }
    return !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
  }

  /// Status reported by `checkMotionPermission`.
  static func permissionStatus(for result: MotionPreconditionResult) -> MotionPermissionStatus {
    switch result {
    case .notCompiled, .usageDescriptionMissing, .activityUnavailable:
      return .unavailable
    case .ready:
      return .granted
    case .permissionNotDetermined:
      return .undetermined
    case .permissionDenied:
      return .denied
    }
  }

  /// Status for an authorization value read after a permission request.
  static func permissionStatus(for authorization: MotionAuthorizationStatus) -> MotionPermissionStatus {
    switch authorization {
    case .authorized:
      return .granted
    case .notDetermined:
      return .undetermined
    case .denied, .restricted:
      return .denied
    }
  }

  /// Detection status for a session whose start-up checks gave `result`.
  static func detectionStatus(for result: MotionPreconditionResult) -> MotionDetectionStatus {
    switch result {
    case .ready:
      return .running
    case .permissionNotDetermined, .permissionDenied:
      return .permissionNotGranted
    case .notCompiled, .usageDescriptionMissing, .activityUnavailable:
      return .unavailable
    }
  }
}
