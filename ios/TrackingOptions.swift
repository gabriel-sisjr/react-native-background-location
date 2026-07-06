import Foundation
import CoreLocation

@objc public class TrackingOptions: NSObject {
  @objc public let accuracy: String?
  @objc public let activityType: String?
  @objc public let distanceFilter: NSNumber?
  @objc public let updateInterval: NSNumber?
  @objc public let foregroundOnly: NSNumber?
  @objc public let waitForAccurateLocation: NSNumber?
  @objc public let activityTrackingEnabled: NSNumber?
  @objc public let pauseLocationWhenStill: NSNumber?
  @objc public let activityUpdateInterval: NSNumber?

  // Notification options — no-op on iOS (no foreground service notification concept)
  // Stored as JSON string to allow cross-platform TrackingOptions without crashes
  @objc public let notificationOptions: String?

  @objc public init(dictionary: NSDictionary?) {
    guard let dict = dictionary else {
      self.accuracy = nil
      self.activityType = nil
      self.distanceFilter = nil
      self.updateInterval = nil
      self.foregroundOnly = nil
      self.waitForAccurateLocation = nil
      self.activityTrackingEnabled = nil
      self.pauseLocationWhenStill = nil
      self.activityUpdateInterval = nil
      self.notificationOptions = nil
      super.init()
      return
    }

    self.accuracy = dict["accuracy"] as? String
    self.activityType = dict["activityType"] as? String
    self.distanceFilter = dict["distanceFilter"] as? NSNumber
    self.updateInterval = dict["updateInterval"] as? NSNumber
    self.foregroundOnly = dict["foregroundOnly"] as? NSNumber
    self.waitForAccurateLocation = dict["waitForAccurateLocation"] as? NSNumber
    self.activityTrackingEnabled = dict["activityTrackingEnabled"] as? NSNumber
    self.pauseLocationWhenStill = dict["pauseLocationWhenStill"] as? NSNumber
    self.activityUpdateInterval = dict["activityUpdateInterval"] as? NSNumber

    // Notification options — parsed without error, unused on iOS
    self.notificationOptions = dict["notificationOptions"] as? String
    super.init()
  }

  @objc public static func from(rawOptions: Any?, methodName: String) -> TrackingOptions {
    guard let unwrapped = rawOptions else {
      guardLogger("[BackgroundLocation] \(methodName) received nil options dictionary; falling back to defaults")
      return TrackingOptions(dictionary: nil)
    }

    if unwrapped is NSNull {
      guardLogger("[BackgroundLocation] \(methodName) received nil options dictionary; falling back to defaults")
      return TrackingOptions(dictionary: nil)
    }
    guard let dict = unwrapped as? NSDictionary else {
      guardLogger("[BackgroundLocation] \(methodName) received non-dictionary options; falling back to defaults")
      return TrackingOptions(dictionary: nil)
    }

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

    // activityType: NSString
    if let raw = dict["activityType"] {
      if let value = raw as? String {
        sanitized["activityType"] = value
      } else if !(raw is NSNull) {
        wrongTypeKeys.append("'activityType' (expected NSString)")
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

    // activityTrackingEnabled: NSNumber (bool-bridged)
    if let raw = dict["activityTrackingEnabled"] {
      if let value = raw as? NSNumber, !(raw is NSNull) {
        sanitized["activityTrackingEnabled"] = value
      } else if !(raw is NSNull) {
        wrongTypeKeys.append("'activityTrackingEnabled' (expected NSNumber)")
      }
    }

    // pauseLocationWhenStill: NSNumber (bool-bridged)
    if let raw = dict["pauseLocationWhenStill"] {
      if let value = raw as? NSNumber, !(raw is NSNull) {
        sanitized["pauseLocationWhenStill"] = value
      } else if !(raw is NSNull) {
        wrongTypeKeys.append("'pauseLocationWhenStill' (expected NSNumber)")
      }
    }

    // activityUpdateInterval: NSNumber
    if let raw = dict["activityUpdateInterval"] {
      if let value = raw as? NSNumber, !(raw is NSNull) {
        sanitized["activityUpdateInterval"] = value
      } else if !(raw is NSNull) {
        wrongTypeKeys.append("'activityUpdateInterval' (expected NSNumber)")
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

  @objc public func clActivityType(methodName: String) -> CLActivityType {
    return LocationActivityType.clActivityType(from: activityType, methodName: methodName)
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

  @objc public var isActivityTrackingEnabled: Bool {
    return activityTrackingEnabled?.boolValue ?? false
  }

  @objc public var shouldPauseLocationWhenStill: Bool {
    return pauseLocationWhenStill?.boolValue ?? false
  }
}
