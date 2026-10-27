#if BACKGROUND_LOCATION_MOTION
import CoreMotion
import Foundation

/// CoreMotion-backed activity source for one session.
///
/// The `CMMotionActivityManager` is created only in `start`, after every start-up check passed.
/// Updates arrive on a dedicated serial `OperationQueue`; the handler receives plain values and
/// must hop to the owner's queue itself.
final class CoreMotionActivitySource: MotionActivitySource {
  private var manager: CMMotionActivityManager?
  private let deliveryQueue: OperationQueue

  init() {
    let queue = OperationQueue()
    queue.name = "com.backgroundlocation.motion.activity"
    queue.maxConcurrentOperationCount = 1
    deliveryQueue = queue
  }

  func start(handler: @escaping (MotionReading) -> Void) {
    guard manager == nil else {
      return
    }
    let activityManager = CMMotionActivityManager()
    manager = activityManager
    activityManager.startActivityUpdates(to: deliveryQueue) { activity in
      guard let activity = activity else {
        return
      }
      handler(MotionReading(activity: activity))
    }
  }

  func stop() {
    manager?.stopActivityUpdates()
    manager = nil
  }
}

/// CoreMotion capabilities: start-up checks, authorization and the explicit permission request.
final class CoreMotionActivityPlatform: MotionActivityPlatform {
  /// Serial queue for permission queries; also guards `pendingPermissionManagers`.
  private static let permissionQueue: OperationQueue = {
    let queue = OperationQueue()
    queue.name = "com.backgroundlocation.motion.permission"
    queue.maxConcurrentOperationCount = 1
    return queue
  }()

  /// Keeps each temporary permission manager alive until CoreMotion answers. Touched only on `permissionQueue`.
  private static var pendingPermissionManagers: [ObjectIdentifier: CMMotionActivityManager] = [:]

  func evaluatePreconditions() -> MotionPreconditionResult {
    return MotionPreconditions.evaluate(
      isCompiledIn: true,
      usageDescription: { Bundle.main.object(forInfoDictionaryKey: MotionPreconditions.usageDescriptionKey) },
      isActivityAvailable: { CMMotionActivityManager.isActivityAvailable() },
      authorizationStatus: { CoreMotionActivityPlatform.currentAuthorization() }
    )
  }

  func authorizationStatus() -> MotionAuthorizationStatus {
    return CoreMotionActivityPlatform.currentAuthorization()
  }

  func makeSource() -> MotionActivitySource {
    return CoreMotionActivitySource()
  }

  /// Runs a one-second activity query, which shows the Motion & Fitness prompt when access is
  /// undetermined. Never touches the location-permission flow.
  func requestAuthorization(completion: @escaping (MotionPermissionStatus) -> Void) {
    let queue = CoreMotionActivityPlatform.permissionQueue
    queue.addOperation {
      let manager = CMMotionActivityManager()
      let key = ObjectIdentifier(manager)
      CoreMotionActivityPlatform.pendingPermissionManagers[key] = manager
      let now = Date()
      manager.queryActivityStarting(from: now.addingTimeInterval(-1), to: now, to: queue) { _, _ in
        CoreMotionActivityPlatform.pendingPermissionManagers.removeValue(forKey: key)
        // The stored authorization decides, whatever error the query reported: when the prompt
        // could not be shown (for example while the app is not active) the answer stays undetermined.
        completion(MotionPreconditions.permissionStatus(for: CoreMotionActivityPlatform.currentAuthorization()))
      }
    }
  }

  private static func currentAuthorization() -> MotionAuthorizationStatus {
    switch CMMotionActivityManager.authorizationStatus() {
    case .authorized:
      return .authorized
    case .notDetermined:
      return .notDetermined
    case .restricted:
      return .restricted
    case .denied:
      return .denied
    @unknown default:
      return .denied
    }
  }
}

private extension MotionReading {
  init(activity: CMMotionActivity) {
    self.init(
      stationary: activity.stationary,
      walking: activity.walking,
      running: activity.running,
      cycling: activity.cycling,
      automotive: activity.automotive,
      unknown: activity.unknown,
      confidenceRawValue: activity.confidence.rawValue,
      timestampMs: activity.startDate.timeIntervalSince1970 * 1000
    )
  }
}

/// Entry points that exist in every build.
enum MotionActivityPlatformFactory {
  /// The CoreMotion platform.
  static func makePlatform() -> MotionActivityPlatform? {
    return CoreMotionActivityPlatform()
  }

  /// Start-up checks for the permission functions.
  static func preconditions() -> MotionPreconditionResult {
    return CoreMotionActivityPlatform().evaluatePreconditions()
  }
}
#else
import Foundation

/// Entry points that exist in every build. CoreMotion support is not compiled in: set
/// `$BackgroundLocationMotionActivity = true` in the app's Podfile and reinstall pods to enable it.
enum MotionActivityPlatformFactory {
  /// No platform: motion activity is unavailable in this build.
  static func makePlatform() -> MotionActivityPlatform? {
    return nil
  }

  /// Always `.notCompiled` in this build.
  static func preconditions() -> MotionPreconditionResult {
    return .notCompiled
  }
}
#endif
