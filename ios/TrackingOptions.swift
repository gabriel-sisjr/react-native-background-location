import Foundation
import CoreLocation

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
