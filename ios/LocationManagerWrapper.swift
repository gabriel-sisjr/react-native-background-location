import Foundation
import CoreLocation

@objc public class LocationManagerWrapper: NSObject, LocationManagerDelegateCallback {
  @objc public static let shared = LocationManagerWrapper()

  private var locationManager: CLLocationManager?
  private let locationDelegate = LocationManagerDelegate()
  private let queue: DispatchQueue
  /// Opt-in motion activity session. Owned by `queue`: every call runs there.
  private let motionCoordinator: MotionCoordinator

  private var _isTracking = false
  private var _currentTripId: String?
  private var _currentOptions: TrackingOptions?

  // MARK: - Event Emission Closures
  @objc public var onLocationUpdate: (([String: Any]) -> Void)?
  @objc public var onLocationWarning: (([String: Any]) -> Void)?
  /// Receives `onMotionActivity` events. May be assigned from any thread: the setter hands the
  /// closure to `queue`, where the events are emitted, so it never races with an emission.
  /// Never read it on `queue` (the getter waits for `queue`).
  @objc public var onMotionActivity: (([String: Any]) -> Void)? {
    get { return queue.sync { motionActivityHandler } }
    set { queue.async { [weak self] in self?.motionActivityHandler = newValue } }
  }
  /// Storage behind `onMotionActivity`, confined to `queue`.
  private var motionActivityHandler: (([String: Any]) -> Void)?

  // MARK: - Permission Management Properties
  private var permissionCompletionHandler: (([String: Any]) -> Void)?
  private var pendingForegroundOnly: Bool = false
  private var hasRequestedAlways: Bool = false
  private var permissionManager: CLLocationManager?
  /// When true, the next `didChangeAuthorization` callback is the initial delegate
  /// assignment callback and should be ignored. This prevents premature resolution
  /// when escalating from WhenInUse to Always, because iOS fires the delegate
  /// callback immediately with the current status upon delegate assignment.
  private var shouldIgnoreNextAuthCallback: Bool = false

  private override init() {
    let queue = DispatchQueue(label: "com.backgroundlocation.manager", qos: .userInitiated)
    self.queue = queue
    self.motionCoordinator = MotionCoordinator(queue: queue)
    super.init()
    locationDelegate.callback = self
    motionCoordinator.host = self
  }

  // MARK: - Crash Recovery

  @objc public func recoverTracking(tripId: String?, options: TrackingOptions) {
    queue.sync {
      guard !_isTracking else {
        NSLog("[BackgroundLocation] Recovery skipped: already tracking")
        return
      }

      let effectiveTripId = (tripId != nil && !tripId!.isEmpty) ? tripId! : UUID().uuidString

      _currentTripId = effectiveTripId
      _currentOptions = options
      _isTracking = true

      LocationStorage.shared.saveTrackingState(tripId: effectiveTripId, isActive: true, options: options)

      configureAndStart(options: options)

      // Re-register significant location monitoring
      if !options.isForegroundOnly {
        startSignificantLocationMonitoring()
      }

      // Motion activity restarts through the normal path: a fresh session that never prompts
      motionCoordinator.startSession(tripId: effectiveTripId, options: options)

      NSLog("[BackgroundLocation] Recovery complete: tracking resumed (tripId: \(effectiveTripId))")
    }
  }

  // MARK: - Public API

  @objc public func startTracking(tripId: String?, rawOptions: Any?) -> String {
    let opts = TrackingOptions.from(rawOptions: rawOptions, methodName: "startTracking")
    return startTracking(tripId: tripId, options: opts)
  }

  @objc public func startTracking(tripId: String?, options: TrackingOptions?) -> String {
    return queue.sync {
      if _isTracking, let existingTripId = _currentTripId {
        return existingTripId
      }

      let effectiveTripId = (tripId != nil && !tripId!.isEmpty) ? tripId! : UUID().uuidString
      let opts = options ?? TrackingOptions(dictionary: nil)

      _currentTripId = effectiveTripId
      _currentOptions = opts
      _isTracking = true

      // Clear stop token on explicit start (user wants tracking)
      LocationStorage.shared.clearStopToken()
      LocationStorage.shared.resetRecoveryCounter()
      LocationStorage.shared.saveTrackingStateSync(tripId: effectiveTripId, isActive: true, options: opts)

      configureAndStart(options: opts)

      // Start significant location monitoring for crash recovery
      if !opts.isForegroundOnly {
        startSignificantLocationMonitoring()
      }

      // Motion activity (opt-in): never prompts; a detection warning is sent after this call returns
      motionCoordinator.startSession(tripId: effectiveTripId, options: opts)

      return effectiveTripId
    }
  }

  @objc public func stopTracking() {
    queue.sync {
      guard _isTracking else { return }

      motionCoordinator.stopSession()
      _isTracking = false
      _currentTripId = nil
      _currentOptions = nil

      // Set stop token BEFORE saving state — prevents recovery after explicit stop
      LocationStorage.shared.setStopToken()
      LocationStorage.shared.saveTrackingStateSync(tripId: nil, isActive: false, options: nil)

      DispatchQueue.main.async { [weak self] in
        self?.locationManager?.stopUpdatingLocation()
        self?.locationManager?.stopMonitoringSignificantLocationChanges()
        self?.locationManager = nil
      }
    }
  }

  @objc public func isTracking() -> [String: Any] {
    return queue.sync {
      if _isTracking, let tripId = _currentTripId {
        return ["active": true, "tripId": tripId]
      }
      return ["active": false]
    }
  }

  @objc public func getLocations(tripId: String) -> [[String: Any]] {
    return LocationStorage.shared.getLocations(tripId: tripId)
  }

  @objc public func clearTrip(tripId: String) {
    LocationStorage.shared.clearTrip(tripId: tripId)
  }

  // MARK: - Background Lifecycle

  @objc public var isCurrentTrackingForegroundOnly: Bool {
    return queue.sync {
      guard _isTracking, let opts = _currentOptions else { return false }
      return opts.isForegroundOnly
    }
  }

  @objc public func pauseTrackingForBackground() {
    queue.async { [weak self] in
      guard let self = self else { return }
      guard self._isTracking, self._currentOptions?.isForegroundOnly == true else { return }

      DispatchQueue.main.async { [weak self] in
        self?.locationManager?.stopUpdatingLocation()
      }
    }
  }

  @objc public func resumeTrackingFromBackground() {
    queue.async { [weak self] in
      guard let self = self else { return }
      guard self._isTracking, self._currentOptions?.isForegroundOnly == true else { return }

      DispatchQueue.main.async { [weak self] in
        self?.locationManager?.startUpdatingLocation()
      }
    }
  }

  // MARK: - Permission Management

  @objc public func checkLocationPermission() -> [String: Any] {
    let manager = locationManager ?? CLLocationManager()
    return mapAuthorizationStatus(manager.authorizationStatus)
  }

  @objc public func requestLocationPermission(foregroundOnly: Bool, completion: @escaping ([String: Any]) -> Void) {
    DispatchQueue.main.async { [weak self] in
      guard let self = self else {
        completion(["status": "undetermined", "canRequestAgain": true])
        return
      }

      let currentStatus = CLLocationManager().authorizationStatus

      // If status is already determined, handle escalation or return immediately
      if currentStatus != .notDetermined {
        // Special case: WhenInUse granted but caller wants Always — attempt escalation
        if currentStatus == .authorizedWhenInUse && !foregroundOnly {
          self.permissionCompletionHandler = completion
          self.pendingForegroundOnly = false
          self.hasRequestedAlways = true
          // Skip the initial didChangeAuthorization callback that fires on delegate assignment,
          // since we already know the status is authorizedWhenInUse
          self.shouldIgnoreNextAuthCallback = true

          let manager = CLLocationManager()
          manager.delegate = self.locationDelegate
          self.permissionManager = manager

          manager.requestAlwaysAuthorization()
          return
        }

        completion(self.mapAuthorizationStatus(currentStatus))
        return
      }

      // Store completion handler and flags for async callback
      self.permissionCompletionHandler = completion
      self.pendingForegroundOnly = foregroundOnly
      self.hasRequestedAlways = false

      // Create a dedicated CLLocationManager for permission requests
      let manager = CLLocationManager()
      manager.delegate = self.locationDelegate
      self.permissionManager = manager

      // Start the permission request flow
      manager.requestWhenInUseAuthorization()
    }
  }

  // MARK: - Motion Activity

  /// Motion & Fitness permission without prompting: `granted`, `denied`, `undetermined`, or
  /// `unavailable` (not compiled in, `NSMotionUsageDescription` missing or blank, or no motion hardware).
  @objc public func checkMotionPermission() -> String {
    let result = MotionActivityPlatformFactory.preconditions()
    return MotionPreconditions.permissionStatus(for: result).rawValue
  }

  /// Prompts for Motion & Fitness access only when it is undetermined; otherwise returns the
  /// current status. Independent of the location-permission flow.
  @objc public func requestMotionPermission(completion: @escaping (String) -> Void) {
    guard let platform = MotionActivityPlatformFactory.makePlatform() else {
      completion(MotionPermissionStatus.unavailable.rawValue)
      return
    }
    let result = platform.evaluatePreconditions()
    guard result == .permissionNotDetermined else {
      completion(MotionPreconditions.permissionStatus(for: result).rawValue)
      return
    }
    platform.requestAuthorization { status in
      completion(status.rawValue)
    }
  }

  /// JSON snapshot of the motion session for `getMotionActivityState()`.
  @objc public func motionActivityStateJSON() -> String {
    return queue.sync {
      motionCoordinator.stateJSON()
    }
  }

  public func didUpdateLocations(_ locations: [CLLocation]) {
    queue.async { [weak self] in
      guard let self = self, self._isTracking, let tripId = self._currentTripId else { return }

      let now = Date()
      for location in locations {
        // Reject invalid locations (negative accuracy means CLLocationManager couldn't determine position)
        guard location.horizontalAccuracy >= 0 else {
          NSLog("[BackgroundLocation] Filtered invalid location (horizontalAccuracy: \(location.horizontalAccuracy))")
          continue
        }

        // Motion reduction: keep-alive fixes (reduced profile, a switch back to full accuracy not
        // applied yet, or older than that switch) only feed the displacement check. They skip the
        // age filter and are never persisted or emitted.
        if self.motionCoordinator.hasGate && self.motionCoordinator.isKeepAliveFix(timestamp: location.timestamp) {
          self.motionCoordinator.handleFix(
            latitude: location.coordinate.latitude,
            longitude: location.coordinate.longitude,
            accuracyMeters: location.horizontalAccuracy,
            rawAccuracyMeters: location.horizontalAccuracy,
            kind: .keepAlive
          )
          continue
        }

        // Reject stale cached locations (older than 10 seconds)
        let age = now.timeIntervalSince(location.timestamp)
        guard age <= 10.0 else {
          NSLog("[BackgroundLocation] Filtered stale location (age: \(String(format: "%.1f", age))s)")
          continue
        }

        self.saveLocationToDB(location: location, tripId: tripId)

        let eventData = self.formatLocationForEvent(location: location, tripId: tripId)
        self.onLocationUpdate?(eventData)

        // A full fix reaches the gate only after it was recorded. Its accuracy includes the trip's
        // distance filter: the device can move that far before the next full fix is delivered.
        if self.motionCoordinator.hasGate {
          let distanceFilter = self._currentOptions.map { self.fullLocationProfile(for: $0).distanceFilter } ?? 0
          self.motionCoordinator.handleFix(
            latitude: location.coordinate.latitude,
            longitude: location.coordinate.longitude,
            accuracyMeters: MotionGate.fullFixAccuracy(location.horizontalAccuracy, distanceFilter),
            rawAccuracyMeters: location.horizontalAccuracy,
            kind: .full
          )
        }
      }
    }
  }

  public func didFailWithError(_ error: Error) {
    queue.async { [weak self] in
      guard let self = self, self._isTracking else { return }

      let clError = error as? CLError

      // While motion reduction is active the error describes the keep-alive request, not the trip
      if clError?.code != .denied && self.motionCoordinator.isReduced {
        return
      }

      let errorType: String
      let message: String

      if clError?.code == .denied {
        errorType = "PERMISSION_REVOKED"
        message = "Location permission was denied. Stopping tracking."
      } else {
        errorType = "LOCATION_UNAVAILABLE"
        message = error.localizedDescription
      }

      let eventData = self.makeWarningEvent(type: errorType, message: message, tripId: self._currentTripId)
      self.onLocationWarning?(eventData)

      // If permission denied, stop tracking
      if clError?.code == .denied {
        self.motionCoordinator.stopSession()
        self._isTracking = false
        let tripIdForStorage = self._currentTripId
        self._currentTripId = nil
        self._currentOptions = nil
        LocationStorage.shared.saveTrackingStateSync(tripId: tripIdForStorage, isActive: false, options: nil)

        DispatchQueue.main.async { [weak self] in
          self?.locationManager?.stopUpdatingLocation()
          self?.locationManager = nil
        }
      }
    }
  }

  public func didPauseLocationUpdates() {
    queue.async { [weak self] in
      guard let self = self, self._isTracking else { return }

      let eventData = self.makeWarningEvent(
        type: "LOCATION_UPDATES_PAUSED",
        message: "iOS paused location updates automatically to save battery.",
        tripId: self._currentTripId
      )
      self.onLocationWarning?(eventData)
      NSLog("[BackgroundLocation] Location updates paused by system")

      // Auto-resume guard: only auto-resume if tracking is active and configured for background updates
      guard self._currentOptions?.isForegroundOnly == false else { return }

      DispatchQueue.main.async { [weak self] in
        guard let self = self,
              self._isTracking,
              let manager = self.locationManager else { return }
        manager.startUpdatingLocation()
        NSLog("[BackgroundLocation] Auto-resumed location updates after system pause")
      }
    }
  }

  public func didResumeLocationUpdates() {
    queue.async { [weak self] in
      guard let self = self, self._isTracking else { return }

      let eventData = self.makeWarningEvent(
        type: "LOCATION_UPDATES_RESUMED",
        message: "iOS resumed location updates.",
        tripId: self._currentTripId
      )
      self.onLocationWarning?(eventData)
      NSLog("[BackgroundLocation] Location updates resumed by system")
    }
  }

  public func didChangeAuthorization(_ status: CLAuthorizationStatus) {
    // Skip the initial delegate-assignment callback when escalating from WhenInUse to Always.
    // iOS fires didChangeAuthorization immediately when a delegate is assigned, reporting the
    // current status (authorizedWhenInUse). Without this guard, the completion handler would
    // resolve before the Always permission dialog appears.
    if shouldIgnoreNextAuthCallback {
      shouldIgnoreNextAuthCallback = false
      return
    }

    // If there is a pending permission request, handle the request flow
    if let completion = permissionCompletionHandler {
      // Two-step flow: if WhenInUse was granted and we need Always, escalate once
      if status == .authorizedWhenInUse && !pendingForegroundOnly && !hasRequestedAlways {
        hasRequestedAlways = true
        permissionManager?.requestAlwaysAuthorization()
        return
      }

      // Resolve the pending promise and clean up
      let result = mapAuthorizationStatus(status)
      completion(result)
      permissionCompletionHandler = nil
      pendingForegroundOnly = false
      hasRequestedAlways = false
      permissionManager = nil
      return
    }

    // No pending permission request — detect mid-session permission changes
    queue.async { [weak self] in
      guard let self = self, self._isTracking else { return }

      switch status {
      case .denied, .restricted:
        // Permission fully revoked while tracking — emit warning and stop
        let warningData = self.makeWarningEvent(
          type: "PERMISSION_REVOKED",
          message: "Location permission was revoked while tracking. Stopping tracking.",
          tripId: self._currentTripId
        )
        self.onLocationWarning?(warningData)

        // Stop tracking (inline to avoid deadlock since we are already on queue)
        self.motionCoordinator.stopSession()
        self._isTracking = false
        let tripIdForStorage = self._currentTripId
        self._currentTripId = nil
        self._currentOptions = nil
        LocationStorage.shared.saveTrackingStateSync(tripId: tripIdForStorage, isActive: false, options: nil)

        DispatchQueue.main.async { [weak self] in
          self?.locationManager?.stopUpdatingLocation()
          self?.locationManager = nil
        }

      case .authorizedWhenInUse:
        // Downgraded from Always to WhenInUse while background tracking
        guard self._currentOptions?.isForegroundOnly == false else { return }

        let warningData = self.makeWarningEvent(
          type: "PERMISSION_DOWNGRADED",
          message: "Location permission downgraded to When In Use. Background tracking may stop when the app is suspended.",
          tripId: self._currentTripId
        )
        self.onLocationWarning?(warningData)

      default:
        break
      }
    }
  }

  // MARK: - Significant Location Monitoring

  private func startSignificantLocationMonitoring() {
    DispatchQueue.main.async { [weak self] in
      guard let self = self else { return }
      guard CLLocationManager.significantLocationChangeMonitoringAvailable() else {
        NSLog("[BackgroundLocation] Significant location monitoring not available on this device")
        return
      }
      self.locationManager?.startMonitoringSignificantLocationChanges()
      NSLog("[BackgroundLocation] Significant location monitoring started (crash recovery wake-up)")
    }
  }

  // MARK: - Private

  private func mapAuthorizationStatus(_ status: CLAuthorizationStatus) -> [String: Any] {
    switch status {
    case .notDetermined:
      return ["status": "undetermined", "canRequestAgain": true]
    case .restricted:
      return ["status": "blocked", "canRequestAgain": false]
    case .denied:
      return ["status": "denied", "canRequestAgain": false]
    case .authorizedWhenInUse:
      // WhenInUse + background capability allows background location while app is alive
      // User can upgrade to Always via Settings for full background support
      return ["status": "whenInUse", "canRequestAgain": true]
    case .authorizedAlways:
      return ["status": "granted", "canRequestAgain": false]
    @unknown default:
      return ["status": "undetermined", "canRequestAgain": true]
    }
  }

  private func configureAndStart(options: TrackingOptions) {
    DispatchQueue.main.async { [weak self] in
      guard let self = self else { return }

      let manager = CLLocationManager()
      manager.delegate = self.locationDelegate
      let profile = self.fullLocationProfile(for: options)
      manager.desiredAccuracy = profile.desiredAccuracy
      manager.distanceFilter = profile.distanceFilter

      manager.activityType = options.clActivityType(methodName: "startTracking")
      // `pausesLocationUpdatesAutomatically = false` reduces — but does not
      // eliminate — system-initiated pauses. iOS may still pause when its
      // motion classifier decides the configured `activityType` disagrees
      // with the observed motion. The `didPauseLocationUpdates` delegate
      manager.pausesLocationUpdatesAutomatically = false
      manager.allowsBackgroundLocationUpdates = !options.isForegroundOnly
      manager.showsBackgroundLocationIndicator = !options.isForegroundOnly

      self.locationManager = manager

      // For PASSIVE accuracy, use significant location changes only
      if options.accuracy == "PASSIVE" || options.accuracy == "NO_POWER" {
        manager.startMonitoringSignificantLocationChanges()
      } else {
        manager.startUpdatingLocation()
      }
    }
  }

  private func defaultDistanceFilter(for accuracy: String?) -> CLLocationDistance {
    switch accuracy {
    case "BALANCED_POWER_ACCURACY":
      return 50.0
    case "LOW_POWER":
      return 200.0
    case "PASSIVE", "NO_POWER":
      return kCLDistanceFilterNone  // significant changes handles this
    default:
      return kCLDistanceFilterNone
    }
  }

  /// The trip's own accuracy settings, used by `configureAndStart` and when motion reduction ends.
  private func fullLocationProfile(for options: TrackingOptions) -> LocationProfile {
    // Apply battery-optimized distance filter: use explicit distanceFilter if set,
    // otherwise apply defaults based on accuracy level
    let distanceFilter: CLLocationDistance
    if let filter = options.distanceFilter?.doubleValue, filter > 0 {
      distanceFilter = options.clDistanceFilter
    } else {
      distanceFilter = defaultDistanceFilter(for: options.accuracy)
    }
    return LocationProfile(desiredAccuracy: options.clAccuracy, distanceFilter: distanceFilter)
  }

  /// The only writer of `desiredAccuracy`/`distanceFilter` after `configureAndStart`. Called on
  /// `queue`; main only sets the properties, and FIFO order keeps successive profiles consistent.
  /// Updates keep running, so a profile change never lets the app be suspended. `applied` runs on
  /// main right after the properties are set, with the current time, even when no manager exists.
  private func applyLocationProfile(_ profile: LocationProfile, applied: ((Date) -> Void)?) {
    DispatchQueue.main.async { [weak self] in
      if let manager = self?.locationManager {
        manager.desiredAccuracy = profile.desiredAccuracy
        manager.distanceFilter = profile.distanceFilter
      }
      applied?(Date())
    }
  }

  /// Builds every `onLocationWarning` payload: `type`, `message`, `tripId` when known, and the
  /// emission `timestamp` in milliseconds since 1970.
  private func makeWarningEvent(type: String, message: String, tripId: String?) -> [String: Any] {
    var eventData: [String: Any] = [
      "type": type,
      "message": message,
      "timestamp": Date().timeIntervalSince1970 * 1000,
    ]
    if let tripId = tripId {
      eventData["tripId"] = tripId
    }
    return eventData
  }

  private func formatLocationForEvent(location: CLLocation, tripId: String) -> [String: Any] {
    var data: [String: Any] = [
      "tripId": tripId,
      "latitude": String(location.coordinate.latitude),
      "longitude": String(location.coordinate.longitude),
      "timestamp": location.timestamp.timeIntervalSince1970 * 1000,
      "provider": "gps",
    ]

    if location.horizontalAccuracy >= 0 {
      data["accuracy"] = location.horizontalAccuracy
    }

    data["altitude"] = location.altitude

    if location.speed >= 0 {
      data["speed"] = location.speed
    }

    if location.course >= 0 {
      data["bearing"] = location.course
    }

    if location.verticalAccuracy >= 0 {
      data["verticalAccuracyMeters"] = location.verticalAccuracy
    }

    if location.speedAccuracy >= 0 {
      data["speedAccuracyMetersPerSecond"] = location.speedAccuracy
    }

    if location.courseAccuracy >= 0 {
      data["bearingAccuracyDegrees"] = location.courseAccuracy
    }

    if let sourceInfo = location.sourceInformation {
      data["isFromMockProvider"] = sourceInfo.isSimulatedBySoftware
    }

    if let floor = location.floor {
      data["floor"] = floor.level
    }

    return data
  }

  private func saveLocationToDB(location: CLLocation, tripId: String) {
    var provider = "gps"
    var isFromMockProvider: NSNumber? = nil

    if let sourceInfo = location.sourceInformation {
      isFromMockProvider = NSNumber(value: sourceInfo.isSimulatedBySoftware)
      provider = sourceInfo.isSimulatedBySoftware ? "simulated" : "gps"
    }

    LocationStorage.shared.saveLocation(
      tripId: tripId,
      latitude: String(location.coordinate.latitude),
      longitude: String(location.coordinate.longitude),
      timestamp: location.timestamp.timeIntervalSince1970 * 1000,
      accuracy: location.horizontalAccuracy,
      altitude: location.altitude,
      speed: location.speed,
      bearing: location.course,
      verticalAccuracyMeters: location.verticalAccuracy,
      speedAccuracyMetersPerSecond: location.speedAccuracy,
      bearingAccuracyDegrees: location.courseAccuracy,
      provider: provider,
      isFromMockProvider: isFromMockProvider
    )
  }
}

// MARK: - Location Profiles

/// Accuracy settings applied to the running location manager.
private struct LocationProfile {
  let desiredAccuracy: CLLocationAccuracy
  let distanceFilter: CLLocationDistance

  /// Keep-alive profile while motion reduction is active. Standard updates keep running and
  /// `allowsBackgroundLocationUpdates` is unchanged, so the app stays alive and CoreMotion keeps delivering.
  static let reduced = LocationProfile(desiredAccuracy: kCLLocationAccuracyThreeKilometers, distanceFilter: 500)
}

// MARK: - Motion Coordinator Host

extension LocationManagerWrapper: MotionCoordinatorHost {
  // Called on `queue` by the motion coordinator.

  func motionCoordinatorApplyLocationProfile(reduced: Bool, applied: ((Date) -> Void)?) {
    guard let options = _currentOptions else {
      // No trip, so nothing to apply; still answer, so a requested full profile never stays pending.
      if let applied = applied {
        DispatchQueue.main.async { applied(Date()) }
      }
      return
    }
    #if DEBUG
    NSLog("[BackgroundLocation] Motion gate applies the \(reduced ? "reduced" : "full") location profile")
    #endif
    applyLocationProfile(reduced ? LocationProfile.reduced : fullLocationProfile(for: options), applied: applied)
  }

  func motionCoordinatorFlushStorage() {
    LocationStorage.shared.forceFlush()
  }

  func motionCoordinatorCanEmit() -> Bool {
    return _isTracking && !LocationStorage.shared.hasValidStopToken()
  }

  func motionCoordinatorEmitWarning(_ warning: MotionWarning, tripId: String) {
    onLocationWarning?(makeWarningEvent(type: warning.type, message: warning.message, tripId: tripId))
  }

  func motionCoordinatorEmitActivity(_ payload: [String: Any]) {
    motionActivityHandler?(payload)
  }
}
