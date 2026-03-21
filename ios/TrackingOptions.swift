import Foundation
import CoreLocation

@objc public class TrackingOptions: NSObject {
  @objc public let accuracy: String?
  @objc public let distanceFilter: NSNumber?
  @objc public let updateInterval: NSNumber?
  @objc public let foregroundOnly: NSNumber?
  @objc public let waitForAccurateLocation: NSNumber?

  // Notification fields — no-op on iOS (no foreground service notification concept)
  // Stored to allow cross-platform TrackingOptions without crashes
  @objc public let notificationTitle: String?
  @objc public let notificationText: String?
  @objc public let notificationSmallIcon: String?
  @objc public let notificationColor: String?
  @objc public let notificationShowTimestamp: NSNumber?
  @objc public let notificationLargeIcon: String?
  @objc public let notificationSubtext: String?
  @objc public let notificationChannelId: String?
  @objc public let notificationChannelName: String?
  @objc public let notificationPriority: String?
  @objc public let notificationActions: String?

  @objc public init(dictionary: NSDictionary?) {
    guard let dict = dictionary else {
      self.accuracy = nil
      self.distanceFilter = nil
      self.updateInterval = nil
      self.foregroundOnly = nil
      self.waitForAccurateLocation = nil
      self.notificationTitle = nil
      self.notificationText = nil
      self.notificationSmallIcon = nil
      self.notificationColor = nil
      self.notificationShowTimestamp = nil
      self.notificationLargeIcon = nil
      self.notificationSubtext = nil
      self.notificationChannelId = nil
      self.notificationChannelName = nil
      self.notificationPriority = nil
      self.notificationActions = nil
      super.init()
      return
    }

    self.accuracy = dict["accuracy"] as? String
    self.distanceFilter = dict["distanceFilter"] as? NSNumber
    self.updateInterval = dict["updateInterval"] as? NSNumber
    self.foregroundOnly = dict["foregroundOnly"] as? NSNumber
    self.waitForAccurateLocation = dict["waitForAccurateLocation"] as? NSNumber

    // Notification fields — parsed without error, unused on iOS
    self.notificationTitle = dict["notificationTitle"] as? String
    self.notificationText = dict["notificationText"] as? String
    self.notificationSmallIcon = dict["notificationSmallIcon"] as? String
    self.notificationColor = dict["notificationColor"] as? String
    self.notificationShowTimestamp = dict["notificationShowTimestamp"] as? NSNumber
    self.notificationLargeIcon = dict["notificationLargeIcon"] as? String
    self.notificationSubtext = dict["notificationSubtext"] as? String
    self.notificationChannelId = dict["notificationChannelId"] as? String
    self.notificationChannelName = dict["notificationChannelName"] as? String
    self.notificationPriority = dict["notificationPriority"] as? String
    self.notificationActions = dict["notificationActions"] as? String
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
