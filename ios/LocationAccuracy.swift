import Foundation
import CoreLocation

@objc public class LocationAccuracy: NSObject {
  @objc public static func clAccuracy(from string: String?) -> CLLocationAccuracy {
    guard let accuracy = string else {
      return kCLLocationAccuracyBest
    }

    switch accuracy {
    case "HIGH_ACCURACY":
      return kCLLocationAccuracyBest
    case "BALANCED_POWER_ACCURACY":
      return kCLLocationAccuracyHundredMeters
    case "LOW_POWER":
      return kCLLocationAccuracyKilometer
    case "NO_POWER", "PASSIVE":
      return kCLLocationAccuracyThreeKilometers
    default:
      return kCLLocationAccuracyBest
    }
  }
}
