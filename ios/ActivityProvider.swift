import Foundation
import CoreMotion

@objc public protocol ActivityProviderDelegate: AnyObject {
  func onActivityStateChanged(isStationary: Bool, activityDescription: String, confidence: CMMotionActivityConfidence)
}

@objc public class ActivityProvider: NSObject {
  
  private let activityManager = CMMotionActivityManager()
  private let activityQueue = OperationQueue()
  
  @objc public weak var delegate: ActivityProviderDelegate?
  
  public override init() {
    super.init()
    activityQueue.name = "com.backgroundlocation.activityQueue"
    activityQueue.maxConcurrentOperationCount = 1
  }
  
  @objc public func startTracking() {
    guard CMMotionActivityManager.isActivityAvailable() else {
      NSLog("[BackgroundLocation] CoreMotion Activity is not available on this device.")
      return
    }

    guard Bundle.main.object(forInfoDictionaryKey: "NSMotionUsageDescription") != nil else {
      NSLog("[BackgroundLocation] CRITICAL WARNING: Cannot start Activity Tracking because NSMotionUsageDescription is missing from Info.plist. GPS will not be paused when stationary.")
      return
    }

    let authStatus = CMMotionActivityManager.authorizationStatus()
    if authStatus == .denied || authStatus == .restricted {
      NSLog("[BackgroundLocation] Motion activity authorization denied or restricted. Activity recognition will not work. Please grant Motion & Fitness permission in Settings.")
      return
    }
    
    NSLog("[BackgroundLocation] Starting CoreMotion Activity tracking...")
    
    activityManager.startActivityUpdates(to: activityQueue) { [weak self] activity in
      guard let activity = activity else { return }
      
      let isStationary = activity.stationary
      let desc = self?.describeActivity(activity) ?? "Unknown"
      
      NSLog("[BackgroundLocation] Detected Activity: \(desc) (Stationary: \(isStationary)) Confidence: \(activity.confidence.rawValue)")
      
      // Notify delegate about the state change
      self?.delegate?.onActivityStateChanged(isStationary: isStationary, activityDescription: desc, confidence: activity.confidence)
    }
  }
  
  @objc public func stopTracking() {
    NSLog("[BackgroundLocation] Stopping CoreMotion Activity tracking...")
    activityManager.stopActivityUpdates()
  }
  
  private func describeActivity(_ activity: CMMotionActivity) -> String {
    var types: [String] = []
    if activity.stationary { types.append("Stationary") }
    if activity.walking { types.append("Walking") }
    if activity.running { types.append("Running") }
    if activity.automotive { types.append("Automotive") }
    if activity.cycling { types.append("Cycling") }
    
    if types.isEmpty {
      return "Unknown"
    }
    return types.joined(separator: ", ")
  }
}
