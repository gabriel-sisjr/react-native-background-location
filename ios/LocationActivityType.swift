import Foundation
import CoreLocation

@objc public class LocationActivityType: NSObject {
  @objc public static func clActivityType(from string: String?, methodName: String) -> CLActivityType {
    guard let value = string else {
      return .other
    }

    switch value {
    case "OTHER":
      return .other
    case "AUTOMOTIVE_NAVIGATION":
      return .automotiveNavigation
    case "FITNESS":
      return .fitness
    case "OTHER_NAVIGATION":
      return .otherNavigation
    case "AIRBORNE":
      return .airborne
    default:
      guardLogger("[BackgroundLocation] \(methodName) received unknown activityType '\(value)'; falling back to .other")
      return .other
    }
  }
}
