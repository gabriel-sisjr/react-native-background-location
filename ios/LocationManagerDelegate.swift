import Foundation
import CoreLocation

@objc public protocol LocationManagerDelegateCallback: AnyObject {
  func didUpdateLocations(_ locations: [CLLocation])
  func didFailWithError(_ error: Error)
  func didChangeAuthorization(_ status: CLAuthorizationStatus)
  func didPauseLocationUpdates()
  func didResumeLocationUpdates()
}

@objc public class LocationManagerDelegate: NSObject, CLLocationManagerDelegate {
  @objc public weak var callback: LocationManagerDelegateCallback?

  public func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
    callback?.didUpdateLocations(locations)
  }

  public func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
    callback?.didFailWithError(error)
  }

  public func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
    callback?.didChangeAuthorization(manager.authorizationStatus)
  }

  public func locationManagerDidPauseLocationUpdates(_ manager: CLLocationManager) {
    callback?.didPauseLocationUpdates()
  }

  public func locationManagerDidResumeLocationUpdates(_ manager: CLLocationManager) {
    callback?.didResumeLocationUpdates()
  }
}
