import Foundation
import CoreLocation

// MARK: - Workstream A (v0.16.0) — iOS native input-validation layer
//
// This file owns the canonical `TrackingOptions` value plus the Swift-side
// nil/wrong-type coercion used by all entry points that accept an
// options-dictionary argument from JS.
//
// Methods that receive an options/dictionary argument across the JS → native
// boundary on iOS (final enumerated list as of v0.16.0):
//
//   • startTracking(tripId:options:) — TrackingOptionsSpec dictionary
//
// Notes on methods considered but excluded from the dictionary-guard pattern:
//
//   • updateNotification(title:text:) — receives two NSString scalars, no
//     options dictionary. iOS implementation is a no-op (`resolve(nil)`).
//   • addGeofence / addGeofences / removeGeofence / removeGeofences /
//     getGeofenceTransitions / clearGeofenceTransitions /
//     configureGeofenceNotifications — receive JSON strings (Codegen does not
//     bridge typed object arrays). String validation lives inside the Swift
//     layer (`GeofenceManager`, `GeofenceNotificationConfig.fromJsonString`)
//     and is out of scope for this dictionary-shaped guard.
//   • getLocations(tripId:) / clearTrip(tripId:) — receive a single NSString
//     `tripId`. Generic nil/empty-string checks live in the .mm transport
//     layer per the architectural rule allowing "generic nil checks for
//     non-dictionary args".
//
// Design (option A4):
//   JS → .mm thin pass-through (no content branching) → Swift authority that
//   coerces nil / non-dict / wrong-type into defaults plus exactly ONE
//   guardLogger line per degenerate input event. Never throws. Never rejects
//   the Promise. Never emits a JS event.

@objc public class TrackingOptions: NSObject {
  @objc public let accuracy: String?
  @objc public let distanceFilter: NSNumber?
  @objc public let updateInterval: NSNumber?
  @objc public let foregroundOnly: NSNumber?
  @objc public let waitForAccurateLocation: NSNumber?

  // Notification options — no-op on iOS (no foreground service notification concept)
  // Stored as JSON string to allow cross-platform TrackingOptions without crashes
  @objc public let notificationOptions: String?

  @objc public init(dictionary: NSDictionary?) {
    guard let dict = dictionary else {
      self.accuracy = nil
      self.distanceFilter = nil
      self.updateInterval = nil
      self.foregroundOnly = nil
      self.waitForAccurateLocation = nil
      self.notificationOptions = nil
      super.init()
      return
    }

    self.accuracy = dict["accuracy"] as? String
    self.distanceFilter = dict["distanceFilter"] as? NSNumber
    self.updateInterval = dict["updateInterval"] as? NSNumber
    self.foregroundOnly = dict["foregroundOnly"] as? NSNumber
    self.waitForAccurateLocation = dict["waitForAccurateLocation"] as? NSNumber

    // Notification options — parsed without error, unused on iOS
    self.notificationOptions = dict["notificationOptions"] as? String
    super.init()
  }

  /// Workstream A guarded factory — single source of truth for translating an
  /// untrusted options payload arriving from the JS bridge into a typed
  /// `TrackingOptions` instance.
  ///
  /// Coerces every degenerate shape (nil, non-dictionary, dictionary with
  /// wrong-typed values) into safe defaults and emits at most ONE
  /// `guardLogger` line per invocation. Never throws. Never rejects the
  /// Promise. Never emits a JS event.
  ///
  /// - Parameters:
  ///   - rawOptions: Untyped value crossing from `.mm` (or any other Swift
  ///     caller). Expected to be `NSDictionary?` but tolerates anything.
  ///   - methodName: Name of the bridge method receiving the input, used as
  ///     the `<methodName>` slot in the log format
  ///     `[BackgroundLocation] <methodName> received <reason>; falling back to defaults`.
  /// - Returns: A `TrackingOptions` instance whose unset fields fall through
  ///   to the existing default behavior elsewhere in this type
  ///   (`clAccuracy`, `clDistanceFilter`, `isForegroundOnly`).
  @objc public static func from(rawOptions: Any?, methodName: String) -> TrackingOptions {
    // 1. nil → empty dict, log once
    guard let unwrapped = rawOptions else {
      guardLogger("[BackgroundLocation] \(methodName) received nil options dictionary; falling back to defaults")
      return TrackingOptions(dictionary: nil)
    }

    // 2. non-NSDictionary (and not NSNull) → empty dict, log once
    if unwrapped is NSNull {
      guardLogger("[BackgroundLocation] \(methodName) received nil options dictionary; falling back to defaults")
      return TrackingOptions(dictionary: nil)
    }
    guard let dict = unwrapped as? NSDictionary else {
      guardLogger("[BackgroundLocation] \(methodName) received non-dictionary options; falling back to defaults")
      return TrackingOptions(dictionary: nil)
    }

    // 3. Dictionary present — type-check each key. Coalesce all wrong-type
    //    observations into a single log line (one log per invocation max).
    var sanitized = NSMutableDictionary()
    var wrongTypeKeys: [String] = []

    // accuracy: NSString
    if let raw = dict["accuracy"] {
      if let value = raw as? String {
        sanitized["accuracy"] = value
      } else if !(raw is NSNull) {
        wrongTypeKeys.append("'accuracy' (expected NSString)")
      }
    }

    // distanceFilter: NSNumber
    if let raw = dict["distanceFilter"] {
      if let value = raw as? NSNumber, !(raw is NSNull) {
        sanitized["distanceFilter"] = value
      } else if !(raw is NSNull) {
        wrongTypeKeys.append("'distanceFilter' (expected NSNumber)")
      }
    }

    // updateInterval: NSNumber
    if let raw = dict["updateInterval"] {
      if let value = raw as? NSNumber, !(raw is NSNull) {
        sanitized["updateInterval"] = value
      } else if !(raw is NSNull) {
        wrongTypeKeys.append("'updateInterval' (expected NSNumber)")
      }
    }

    // foregroundOnly: NSNumber (bool-bridged)
    if let raw = dict["foregroundOnly"] {
      if let value = raw as? NSNumber, !(raw is NSNull) {
        sanitized["foregroundOnly"] = value
      } else if !(raw is NSNull) {
        wrongTypeKeys.append("'foregroundOnly' (expected NSNumber)")
      }
    }

    // waitForAccurateLocation: NSNumber (bool-bridged)
    if let raw = dict["waitForAccurateLocation"] {
      if let value = raw as? NSNumber, !(raw is NSNull) {
        sanitized["waitForAccurateLocation"] = value
      } else if !(raw is NSNull) {
        wrongTypeKeys.append("'waitForAccurateLocation' (expected NSNumber)")
      }
    }

    // notificationOptions: NSString (JSON-serialized; iOS no-op)
    if let raw = dict["notificationOptions"] {
      if let value = raw as? String {
        sanitized["notificationOptions"] = value
      } else if !(raw is NSNull) {
        wrongTypeKeys.append("'notificationOptions' (expected NSString)")
      }
    }

    if !wrongTypeKeys.isEmpty {
      let joined = wrongTypeKeys.joined(separator: ", ")
      guardLogger("[BackgroundLocation] \(methodName) received wrong type for key(s) \(joined); falling back to defaults")
    }

    return TrackingOptions(dictionary: sanitized)
  }

  @objc public var clAccuracy: CLLocationAccuracy {
    return LocationAccuracy.clAccuracy(from: accuracy)
  }

  @objc public var clDistanceFilter: CLLocationDistance {
    guard let filter = distanceFilter?.doubleValue, filter > 0 else {
      return kCLDistanceFilterNone
    }
    return filter
  }

  @objc public var isForegroundOnly: Bool {
    return foregroundOnly?.boolValue ?? false
  }
}
