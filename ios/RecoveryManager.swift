import Foundation
import CoreLocation

@objc public class RecoveryManager: NSObject {
  @objc public static let shared = RecoveryManager()

  private override init() {
    super.init()
  }

  // MARK: - Recovery Check

  @objc public func attemptRecoveryIfNeeded() {
    // Step 1: Check stop token — if set, user explicitly stopped tracking
    if LocationStorage.shared.hasValidStopToken() {
      NSLog("[BackgroundLocation] Recovery skipped: stop token is set (user stopped tracking explicitly)")
      LocationStorage.shared.clearStopToken()
      return
    }

    // Step 2: Read persisted tracking state from Core Data
    let state = LocationStorage.shared.getTrackingState()

    guard let isActive = state["isActive"] as? Bool, isActive else {
      NSLog("[BackgroundLocation] Recovery skipped: no active tracking session found")
      return
    }

    // Step 3: Check stop token again (double-check after reading state)
    if LocationStorage.shared.hasValidStopToken() {
      NSLog("[BackgroundLocation] Recovery skipped: stop token set (double-check)")
      LocationStorage.shared.clearStopToken()
      return
    }

    // Step 4: Restart loop detection
    guard LocationStorage.shared.canAttemptRecovery() else {
      NSLog("[BackgroundLocation] Recovery aborted: max restarts per hour exceeded (5/hour limit)")
      return
    }

    // Step 5: Validate location authorization
    let authStatus = CLLocationManager().authorizationStatus

    guard authStatus == .authorizedAlways || authStatus == .authorizedWhenInUse else {
      NSLog("[BackgroundLocation] Recovery skipped: insufficient location permission (status: \(authStatus.rawValue))")
      return
    }

    // Step 6: Record recovery attempt
    LocationStorage.shared.recordRecoveryAttempt()

    // Step 7: Rebuild options from persisted state
    let tripId = state["tripId"] as? String
    let options = rebuildOptions(from: state)

    NSLog("[BackgroundLocation] Recovery: resuming tracking session (tripId: \(tripId ?? "nil"))")

    // Step 8: Check stop token one final time before starting
    if LocationStorage.shared.hasValidStopToken() {
      NSLog("[BackgroundLocation] Recovery skipped: stop token set (final check)")
      LocationStorage.shared.clearStopToken()
      return
    }

    // Step 9: Resume tracking via LocationManagerWrapper
    let wrapper = LocationManagerWrapper.shared
    wrapper.recoverTracking(tripId: tripId, options: options)
  }

  // MARK: - Private

  private func rebuildOptions(from state: [String: Any]) -> TrackingOptions {
    let dict = NSMutableDictionary()

    if let accuracy = state["accuracy"] as? String {
      dict["accuracy"] = accuracy
    }

    if let distanceFilter = state["distanceFilter"] as? Double, distanceFilter > 0 {
      dict["distanceFilter"] = NSNumber(value: distanceFilter)
    }

    if let updateInterval = state["updateInterval"] as? Double, updateInterval > 0 {
      dict["updateInterval"] = NSNumber(value: updateInterval)
    }

    if let foregroundOnly = state["foregroundOnly"] as? Bool {
      dict["foregroundOnly"] = NSNumber(value: foregroundOnly)
    }

    return TrackingOptions(dictionary: dict)
  }
}
