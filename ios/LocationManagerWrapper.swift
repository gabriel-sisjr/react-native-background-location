import Foundation
import CoreLocation

@objc public class LocationManagerWrapper: NSObject, LocationManagerDelegateCallback {
  @objc public static let shared = LocationManagerWrapper()

  private var locationManager: CLLocationManager?
  private let locationDelegate = LocationManagerDelegate()
  private let queue = DispatchQueue(label: "com.backgroundlocation.manager", qos: .userInitiated)

  private var _isTracking = false
  private var _currentTripId: String?
  private var _currentOptions: TrackingOptions?

  // MARK: - Event Emission Closures
  @objc public var onLocationUpdate: (([String: Any]) -> Void)?
  @objc public var onLocationWarning: (([String: Any]) -> Void)?

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
    super.init()
    locationDelegate.callback = self
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

      // Save recovered state
      LocationStorage.shared.saveTrackingState(tripId: effectiveTripId, isActive: true, options: options)

      configureAndStart(options: options)

      // Re-register significant location monitoring
      if !options.isForegroundOnly {
        startSignificantLocationMonitoring()
      }

      NSLog("[BackgroundLocation] Recovery complete: tracking resumed (tripId: \(effectiveTripId))")
    }
  }

  // MARK: - Public API

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

      return effectiveTripId
    }
  }

  @objc public func stopTracking() {
    queue.sync {
      guard _isTracking else { return }

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

        // Reject stale cached locations (older than 10 seconds)
        let age = now.timeIntervalSince(location.timestamp)
        guard age <= 10.0 else {
          NSLog("[BackgroundLocation] Filtered stale location (age: \(String(format: "%.1f", age))s)")
          continue
        }

        self.saveLocationToDB(location: location, tripId: tripId)

        let eventData = self.formatLocationForEvent(location: location, tripId: tripId)
        self.onLocationUpdate?(eventData)
      }
    }
  }

  public func didFailWithError(_ error: Error) {
    queue.async { [weak self] in
      guard let self = self, self._isTracking else { return }

      let clError = error as? CLError
      let errorType: String
      let message: String

      if clError?.code == .denied {
        errorType = "PERMISSION_REVOKED"
        message = "Location permission was denied. Stopping tracking."
      } else {
        errorType = "LOCATION_UNAVAILABLE"
        message = error.localizedDescription
      }

      var eventData: [String: Any] = [
        "type": errorType,
        "message": message,
      ]
      if let tripId = self._currentTripId {
        eventData["tripId"] = tripId
      }
      self.onLocationWarning?(eventData)

      // If permission denied, stop tracking
      if clError?.code == .denied {
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

      var eventData: [String: Any] = [
        "type": "LOCATION_UPDATES_PAUSED",
        "message": "iOS paused location updates automatically to save battery.",
      ]
      if let tripId = self._currentTripId {
        eventData["tripId"] = tripId
      }
      self.onLocationWarning?(eventData)
      NSLog("[BackgroundLocation] Location updates paused by system")
    }
  }

  public func didResumeLocationUpdates() {
    queue.async { [weak self] in
      guard let self = self, self._isTracking else { return }

      var eventData: [String: Any] = [
        "type": "LOCATION_UPDATES_RESUMED",
        "message": "iOS resumed location updates.",
      ]
      if let tripId = self._currentTripId {
        eventData["tripId"] = tripId
      }
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
        var warningData: [String: Any] = [
          "type": "PERMISSION_REVOKED",
          "message": "Location permission was revoked while tracking. Stopping tracking.",
        ]
        if let tripId = self._currentTripId {
          warningData["tripId"] = tripId
        }
        self.onLocationWarning?(warningData)

        // Stop tracking (inline to avoid deadlock since we are already on queue)
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

        var warningData: [String: Any] = [
          "type": "PERMISSION_DOWNGRADED",
          "message": "Location permission downgraded to When In Use. Background tracking may stop when the app is suspended.",
        ]
        if let tripId = self._currentTripId {
          warningData["tripId"] = tripId
        }
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
      manager.desiredAccuracy = options.clAccuracy

      // Apply battery-optimized distance filter: use explicit distanceFilter if set,
      // otherwise apply defaults based on accuracy level
      if options.distanceFilter != nil && options.distanceFilter!.doubleValue > 0 {
        manager.distanceFilter = options.clDistanceFilter
      } else {
        manager.distanceFilter = self.defaultDistanceFilter(for: options.accuracy)
      }

      manager.activityType = .automotiveNavigation
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
