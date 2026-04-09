import Foundation
import CoreLocation

/// Orchestrates geofence region monitoring on iOS using a dedicated CLLocationManager instance
/// Separate from LocationManagerWrapper (tracking) to ensure isolated lifecycle and delegates
///
/// Responsibilities:
/// - Register/remove regions via CLLocationManager.startMonitoring(for:)
/// - Receive CLLocationManagerDelegate callbacks for region transitions
/// - Manage DWELL detection via DwellTimer (not native on iOS)
/// - Manage TTL via expiration timers
/// - Calculate distanceFromCenter on transition
/// - Enforce platform limit of 20 monitored regions
/// - Validate "Always" permission before registration
/// - Atomic batch operations (all-or-nothing)
/// - Recovery: restore geofences from Core Data after crash
@objc public class GeofenceManager: NSObject, CLLocationManagerDelegate {

    @objc public static let shared = GeofenceManager()

    /// Maximum number of geofences supported on iOS
    @objc public static let MAX_GEOFENCES = 20

    private let locationManager: CLLocationManager
    private let storage: GeofenceStorage
    private let emitter: GeofenceEventEmitter
    private let dwellTimer: DwellTimer
    private let queue = DispatchQueue(label: "com.backgroundlocation.geofencemanager", qos: .userInitiated)

    /// Expiration timers for geofences with TTL
    private var expirationTimers: [String: DispatchSourceTimer] = [:]

    private override init() {
        if Thread.isMainThread {
            self.locationManager = CLLocationManager()
        } else {
            self.locationManager = DispatchQueue.main.sync { CLLocationManager() }
        }
        self.storage = GeofenceStorage.shared
        self.emitter = GeofenceEventEmitter.shared
        self.dwellTimer = DwellTimer()
        super.init()

        let manager = self.locationManager
        let delegate = self
        if Thread.isMainThread {
            manager.delegate = delegate
            manager.allowsBackgroundLocationUpdates = true
        } else {
            DispatchQueue.main.sync {
                manager.delegate = delegate
                manager.allowsBackgroundLocationUpdates = true
            }
        }
    }

    // MARK: - Permission Check

    private func checkAlwaysPermission() throws {
        let status = locationManager.authorizationStatus
        switch status {
        case .authorizedAlways:
            // OK
            break
        case .authorizedWhenInUse:
            throw GeofenceError.permissionDenied("Geofencing requires 'Always' location permission. Current permission is 'When In Use'.")
        case .denied, .restricted:
            throw GeofenceError.permissionDenied("Location permission is denied or restricted. Geofencing requires 'Always' location permission.")
        case .notDetermined:
            throw GeofenceError.permissionDenied("Location permission has not been requested. Request 'Always' permission before adding geofences.")
        @unknown default:
            throw GeofenceError.permissionDenied("Unknown location permission status.")
        }
    }

    // MARK: - Public API

    /// Adds a single geofence region for monitoring
    @objc public func addGeofence(regionJson: String, resolve: @escaping (Any?) -> Void, reject: @escaping (String, String, NSError?) -> Void) {
        queue.async { [weak self] in
            guard let self = self else { return }

            do {
                try self.checkAlwaysPermission()

                guard CLLocationManager.isMonitoringAvailable(for: CLCircularRegion.self) else {
                    throw GeofenceError.notAvailable()
                }

                let region = try GeofenceRegionMapper.parseRegionJson(regionJson)
                try GeofenceRegionMapper.validate(region)

                // Check for duplicate
                if self.storage.getGeofenceByIdentifier(region.identifier) != nil {
                    throw GeofenceError.duplicateIdentifier(region.identifier)
                }

                // Check limit
                let currentCount = self.storage.getGeofenceCount()
                if currentCount >= GeofenceManager.MAX_GEOFENCES {
                    throw GeofenceError.limitExceeded(limit: GeofenceManager.MAX_GEOFENCES)
                }

                // Register with CLLocationManager on main thread
                let clRegion = GeofenceRegionMapper.toCLRegion(region)
                DispatchQueue.main.sync {
                    self.locationManager.startMonitoring(for: clRegion)
                }

                // Persist to Core Data
                self.storage.saveGeofenceSync(region)

                // Set up expiration timer if TTL is configured
                if let expDuration = region.expirationDuration {
                    self.setupExpirationTimer(for: region.identifier, durationMs: expDuration.int64Value)
                }

                NSLog("[BackgroundLocation] Geofence added: '\(region.identifier)'")
                resolve(nil)

            } catch let error as GeofenceError {
                reject(error.code_, error.localizedDescription, error)
            } catch {
                reject("MONITORING_FAILED", "Failed to add geofence: \(error.localizedDescription)", error as NSError)
            }
        }
    }

    /// Adds multiple geofence regions atomically (all-or-nothing)
    @objc public func addGeofences(regionsJson: String, resolve: @escaping (Any?) -> Void, reject: @escaping (String, String, NSError?) -> Void) {
        queue.async { [weak self] in
            guard let self = self else { return }

            do {
                try self.checkAlwaysPermission()

                guard CLLocationManager.isMonitoringAvailable(for: CLCircularRegion.self) else {
                    throw GeofenceError.notAvailable()
                }

                let regions = try GeofenceRegionMapper.parseRegionsJson(regionsJson)

                if regions.isEmpty {
                    resolve(nil)
                    return
                }

                // Validate all regions first (atomic: all-or-nothing)
                for region in regions {
                    try GeofenceRegionMapper.validate(region)
                }

                // Check for duplicates within the batch
                let identifiers = regions.map { $0.identifier }
                if Set(identifiers).count != identifiers.count {
                    throw GeofenceError.duplicateIdentifier("Duplicate identifiers found within batch")
                }

                // Check for duplicates with existing geofences
                for region in regions {
                    if self.storage.getGeofenceByIdentifier(region.identifier) != nil {
                        throw GeofenceError.duplicateIdentifier(region.identifier)
                    }
                }

                // Check limit
                let currentCount = self.storage.getGeofenceCount()
                if currentCount + regions.count > GeofenceManager.MAX_GEOFENCES {
                    throw GeofenceError.limitExceeded(limit: GeofenceManager.MAX_GEOFENCES)
                }

                // Register all with CLLocationManager on main thread
                let clRegions = regions.map { GeofenceRegionMapper.toCLRegion($0) }
                DispatchQueue.main.sync {
                    for clRegion in clRegions {
                        self.locationManager.startMonitoring(for: clRegion)
                    }
                }

                // Persist all to Core Data
                self.storage.saveGeofencesSync(regions)

                // Set up expiration timers
                for region in regions {
                    if let expDuration = region.expirationDuration {
                        self.setupExpirationTimer(for: region.identifier, durationMs: expDuration.int64Value)
                    }
                }

                NSLog("[BackgroundLocation] Batch added \(regions.count) geofences")
                resolve(nil)

            } catch let error as GeofenceError {
                reject(error.code_, error.localizedDescription, error)
            } catch {
                reject("MONITORING_FAILED", "Failed to add geofences: \(error.localizedDescription)", error as NSError)
            }
        }
    }

    /// Removes a single geofence by identifier
    @objc public func removeGeofence(identifier: String, resolve: @escaping (Any?) -> Void, reject: @escaping (String, String, NSError?) -> Void) {
        queue.async { [weak self] in
            guard let self = self else { return }

            do {
                // Stop monitoring on main thread
                DispatchQueue.main.sync {
                    for region in self.locationManager.monitoredRegions {
                        if region.identifier == identifier {
                            self.locationManager.stopMonitoring(for: region)
                            break
                        }
                    }
                }

                // Cancel associated timers
                self.dwellTimer.cancelDwellTimer(for: identifier)
                self.cancelExpirationTimer(for: identifier)

                // Remove from Core Data
                self.storage.removeGeofence(identifier)

                NSLog("[BackgroundLocation] Geofence removed: '\(identifier)'")
                resolve(nil)
            } catch {
                reject("MONITORING_FAILED", "Failed to remove geofence: \(error.localizedDescription)", error as NSError)
            }
        }
    }

    /// Removes multiple geofences by identifiers
    @objc public func removeGeofences(identifiersJson: String, resolve: @escaping (Any?) -> Void, reject: @escaping (String, String, NSError?) -> Void) {
        queue.async { [weak self] in
            guard let self = self else { return }

            do {
                let identifiers = try GeofenceRegionMapper.parseIdentifiersJson(identifiersJson)

                if identifiers.isEmpty {
                    resolve(nil)
                    return
                }

                let identifierSet = Set(identifiers)

                // Stop monitoring on main thread
                DispatchQueue.main.sync {
                    for region in self.locationManager.monitoredRegions {
                        if identifierSet.contains(region.identifier) {
                            self.locationManager.stopMonitoring(for: region)
                        }
                    }
                }

                // Cancel associated timers
                for identifier in identifiers {
                    self.dwellTimer.cancelDwellTimer(for: identifier)
                    self.cancelExpirationTimer(for: identifier)
                }

                // Remove from Core Data
                self.storage.removeGeofences(identifiers)

                NSLog("[BackgroundLocation] Removed \(identifiers.count) geofences")
                resolve(nil)
            } catch let error as GeofenceError {
                reject(error.code_, error.localizedDescription, error)
            } catch {
                reject("MONITORING_FAILED", "Failed to remove geofences: \(error.localizedDescription)", error as NSError)
            }
        }
    }

    /// Removes all registered geofences
    @objc public func removeAllGeofences(resolve: @escaping (Any?) -> Void, reject: @escaping (String, String, NSError?) -> Void) {
        queue.async { [weak self] in
            guard let self = self else { return }

            // Stop all region monitoring on main thread
            DispatchQueue.main.sync {
                for region in self.locationManager.monitoredRegions {
                    self.locationManager.stopMonitoring(for: region)
                }
            }

            // Cancel all timers
            self.dwellTimer.cancelAll()
            self.cancelAllExpirationTimers()

            // Remove all from Core Data
            self.storage.removeAllGeofences()

            NSLog("[BackgroundLocation] All geofences removed")
            resolve(nil)
        }
    }

    /// Returns all currently active geofences as JSON string
    @objc public func getActiveGeofences(resolve: @escaping (Any?) -> Void, reject: @escaping (String, String, NSError?) -> Void) {
        queue.async { [weak self] in
            guard let self = self else { return }

            let geofences = self.storage.getActiveGeofences()

            do {
                let jsonData = try JSONSerialization.data(withJSONObject: geofences)
                let jsonString = String(data: jsonData, encoding: .utf8) ?? "[]"
                resolve(jsonString)
            } catch {
                reject("MONITORING_FAILED", "Failed to serialize geofences: \(error.localizedDescription)", error as NSError)
            }
        }
    }

    /// Returns the maximum number of geofences supported on this platform
    @objc public func getMaxGeofences(resolve: @escaping (Any?) -> Void, reject: @escaping (String, String, NSError?) -> Void) {
        resolve(NSNumber(value: GeofenceManager.MAX_GEOFENCES))
    }

    /// Returns geofence transition events as JSON string
    @objc public func getGeofenceTransitions(identifier: String?, resolve: @escaping (Any?) -> Void, reject: @escaping (String, String, NSError?) -> Void) {
        queue.async { [weak self] in
            guard let self = self else { return }

            let transitions = self.storage.getTransitions(identifier)

            do {
                let jsonData = try JSONSerialization.data(withJSONObject: transitions)
                let jsonString = String(data: jsonData, encoding: .utf8) ?? "[]"
                resolve(jsonString)
            } catch {
                reject("MONITORING_FAILED", "Failed to serialize transitions: \(error.localizedDescription)", error as NSError)
            }
        }
    }

    /// Clears geofence transition events
    @objc public func clearGeofenceTransitions(identifier: String?, resolve: @escaping (Any?) -> Void, reject: @escaping (String, String, NSError?) -> Void) {
        queue.async { [weak self] in
            self?.storage.clearTransitions(identifier)
            NSLog("[BackgroundLocation] Cleared transitions for: \(identifier ?? "all")")
            resolve(nil)
        }
    }

    // MARK: - Recovery

    /// Restores geofences from Core Data after app crash/restart
    @objc public func restoreGeofences() {
        queue.async { [weak self] in
            guard let self = self else { return }

            let regions = self.storage.getActiveGeofenceRegions()
            if regions.isEmpty {
                NSLog("[BackgroundLocation] No geofences to restore")
                return
            }

            guard CLLocationManager.isMonitoringAvailable(for: CLCircularRegion.self) else {
                NSLog("[BackgroundLocation] Region monitoring not available, cannot restore geofences")
                return
            }

            let authStatus = self.locationManager.authorizationStatus
            guard authStatus == .authorizedAlways else {
                NSLog("[BackgroundLocation] Insufficient permission for geofence recovery (status: \(authStatus.rawValue))")
                return
            }

            DispatchQueue.main.sync {
                for region in regions {
                    let clRegion = GeofenceRegionMapper.toCLRegion(region)
                    self.locationManager.startMonitoring(for: clRegion)
                }
            }

            // Restore expiration timers with remaining duration calculation
            for region in regions {
                if let expDuration = region.expirationDuration {
                    let totalDurationMs = expDuration.int64Value
                    if let createdAt = region.createdAt {
                        let elapsedMs = Int64(Date().timeIntervalSince(createdAt) * 1000)
                        let remainingMs = totalDurationMs - elapsedMs
                        if remainingMs > 0 {
                            self.setupExpirationTimer(for: region.identifier, durationMs: remainingMs)
                        } else {
                            // Geofence has expired during downtime, remove it
                            DispatchQueue.main.sync {
                                for monitoredRegion in self.locationManager.monitoredRegions {
                                    if monitoredRegion.identifier == region.identifier {
                                        self.locationManager.stopMonitoring(for: monitoredRegion)
                                        break
                                    }
                                }
                            }
                            self.storage.removeGeofence(region.identifier)
                            NSLog("[BackgroundLocation] Geofence '\(region.identifier)' expired during downtime, removed")
                        }
                    } else {
                        // No createdAt available, fall back to full duration
                        self.setupExpirationTimer(for: region.identifier, durationMs: totalDurationMs)
                    }
                }
            }

            NSLog("[BackgroundLocation] Restored \(regions.count) geofences")
        }
    }

    // MARK: - CLLocationManagerDelegate

    public func locationManager(_ manager: CLLocationManager, didEnterRegion region: CLRegion) {
        guard let circularRegion = region as? CLCircularRegion else { return }

        queue.async { [weak self] in
            self?.handleEnterTransition(for: circularRegion)
        }
    }

    public func locationManager(_ manager: CLLocationManager, didExitRegion region: CLRegion) {
        guard let circularRegion = region as? CLCircularRegion else { return }

        queue.async { [weak self] in
            self?.handleExitTransition(for: circularRegion)
        }
    }

    public func locationManager(_ manager: CLLocationManager, monitoringDidFailFor region: CLRegion?, withError error: Error) {
        NSLog("[BackgroundLocation] Geofence monitoring failed for region '\(region?.identifier ?? "unknown")': \(error.localizedDescription)")
    }

    public func locationManager(_ manager: CLLocationManager, didStartMonitoringFor region: CLRegion) {
        NSLog("[BackgroundLocation] Started monitoring for region: '\(region.identifier)'")
        // Request initial state after monitoring starts
        manager.requestState(for: region)
    }

    public func locationManager(_ manager: CLLocationManager, didDetermineState state: CLRegionState, for region: CLRegion) {
        guard let circularRegion = region as? CLCircularRegion else { return }

        // Handle initial state when monitoring starts
        // If the device is already inside the region, trigger ENTER
        if state == .inside {
            queue.async { [weak self] in
                guard let self = self else { return }
                guard let geofenceData = self.storage.getGeofenceByIdentifier(circularRegion.identifier) else { return }

                // Only handle if ENTER or DWELL is monitored
                if geofenceData.monitorsEnter || geofenceData.monitorsDwell {
                    NSLog("[BackgroundLocation] Device is inside region '\(circularRegion.identifier)' on start")
                    self.handleEnterTransition(for: circularRegion)
                }
            }
        }
    }

    // MARK: - Transition Handling

    private func handleEnterTransition(for region: CLCircularRegion) {
        let identifier = region.identifier

        guard let geofenceData = storage.getGeofenceByIdentifier(identifier) else {
            NSLog("[BackgroundLocation] Received ENTER for unknown geofence: '\(identifier)'")
            return
        }

        // Get current location for distance calculation (must access on main thread)
        var deviceLocation: CLLocation?
        DispatchQueue.main.sync {
            deviceLocation = self.locationManager.location
        }
        let timestamp = deviceLocation?.timestamp ?? Date()
        let lat = deviceLocation?.coordinate.latitude ?? region.center.latitude
        let lng = deviceLocation?.coordinate.longitude ?? region.center.longitude

        // Calculate distance from center
        let deviceLoc = CLLocation(latitude: lat, longitude: lng)
        let centerLoc = CLLocation(latitude: region.center.latitude, longitude: region.center.longitude)
        let distanceFromCenter = deviceLoc.distance(from: centerLoc)

        // Emit ENTER event if monitored
        if geofenceData.monitorsEnter {
            emitTransition(
                geofenceId: identifier,
                transitionType: "ENTER",
                latitude: lat,
                longitude: lng,
                radius: region.radius,
                timestamp: timestamp,
                distanceFromCenter: distanceFromCenter,
                metadata: geofenceData.metadata,
                notificationConfig: geofenceData.notificationConfig
            )
        }

        // Start DWELL timer if DWELL is configured
        if geofenceData.monitorsDwell {
            dwellTimer.startDwellTimer(for: identifier, delayMs: geofenceData.loiteringDelay) { [weak self] in
                self?.queue.async {
                    guard let self = self else { return }

                    // Re-check device location at dwell time (must access on main thread)
                    var dwellLocation: CLLocation?
                    DispatchQueue.main.sync {
                        dwellLocation = self.locationManager.location
                    }
                    let dwellTimestamp = dwellLocation?.timestamp ?? Date()
                    let dwellLat = dwellLocation?.coordinate.latitude ?? region.center.latitude
                    let dwellLng = dwellLocation?.coordinate.longitude ?? region.center.longitude

                    let dwellDeviceLoc = CLLocation(latitude: dwellLat, longitude: dwellLng)
                    let dwellDistance = dwellDeviceLoc.distance(from: centerLoc)

                    self.emitTransition(
                        geofenceId: identifier,
                        transitionType: "DWELL",
                        latitude: dwellLat,
                        longitude: dwellLng,
                        radius: region.radius,
                        timestamp: dwellTimestamp,
                        distanceFromCenter: dwellDistance,
                        metadata: geofenceData.metadata,
                        notificationConfig: geofenceData.notificationConfig
                    )
                }
            }
        }
    }

    private func handleExitTransition(for region: CLCircularRegion) {
        let identifier = region.identifier

        guard let geofenceData = storage.getGeofenceByIdentifier(identifier) else {
            NSLog("[BackgroundLocation] Received EXIT for unknown geofence: '\(identifier)'")
            return
        }

        // Cancel DWELL timer (device left before dwell delay)
        dwellTimer.cancelDwellTimer(for: identifier)

        // Only emit EXIT if monitored
        guard geofenceData.monitorsExit else { return }

        // Get current location (must access on main thread)
        var deviceLocation: CLLocation?
        DispatchQueue.main.sync {
            deviceLocation = self.locationManager.location
        }
        let timestamp = deviceLocation?.timestamp ?? Date()
        let lat = deviceLocation?.coordinate.latitude ?? region.center.latitude
        let lng = deviceLocation?.coordinate.longitude ?? region.center.longitude

        // Calculate distance from center
        let deviceLoc = CLLocation(latitude: lat, longitude: lng)
        let centerLoc = CLLocation(latitude: region.center.latitude, longitude: region.center.longitude)
        let distanceFromCenter = deviceLoc.distance(from: centerLoc)

        emitTransition(
            geofenceId: identifier,
            transitionType: "EXIT",
            latitude: lat,
            longitude: lng,
            radius: region.radius,
            timestamp: timestamp,
            distanceFromCenter: distanceFromCenter,
            metadata: geofenceData.metadata,
            notificationConfig: geofenceData.notificationConfig
        )
    }

    private func emitTransition(
        geofenceId: String,
        transitionType: String,
        latitude: Double,
        longitude: Double,
        radius: Double,
        timestamp: Date,
        distanceFromCenter: Double,
        metadata: String?,
        notificationConfig: String? = nil
    ) {
        // Persist transition
        storage.saveTransition(
            geofenceId: geofenceId,
            transitionType: transitionType,
            latitude: latitude,
            longitude: longitude,
            distanceFromCenter: distanceFromCenter,
            timestamp: timestamp,
            metadata: metadata
        )

        // Emit to JS
        emitter.emitTransition(
            geofenceId: geofenceId,
            transitionType: transitionType,
            latitude: latitude,
            longitude: longitude,
            timestamp: timestamp,
            distanceFromCenter: distanceFromCenter,
            metadata: metadata
        )

        // Resolve notification config through the full resolution chain
        let resolvedConfig = GeofenceNotificationConfig.resolve(
            perGeofenceConfigJson: notificationConfig,
            transitionType: transitionType
        )

        // Show notification if enabled
        if resolvedConfig.enabled?.boolValue != false {
            GeofenceNotificationHelper.shared.showTransitionNotification(
                geofenceId: geofenceId,
                transitionType: transitionType,
                latitude: latitude,
                longitude: longitude,
                radius: radius,
                timestamp: ISO8601DateFormatter().string(from: timestamp),
                metadata: metadata,
                config: resolvedConfig
            )
        }

        NSLog("[BackgroundLocation] Transition: \(transitionType) for '\(geofenceId)' (distance: \(String(format: "%.1f", distanceFromCenter))m)")
    }

    // MARK: - Expiration Timers

    private func setupExpirationTimer(for identifier: String, durationMs: Int64) {
        cancelExpirationTimer(for: identifier)

        let durationSeconds = Double(durationMs) / 1000.0

        let timer = DispatchSource.makeTimerSource(queue: queue)
        timer.schedule(deadline: .now() + durationSeconds)
        timer.setEventHandler { [weak self] in
            guard let self = self else { return }

            NSLog("[BackgroundLocation] Geofence '\(identifier)' expired after \(durationSeconds)s")

            // Stop monitoring on main thread
            DispatchQueue.main.sync {
                for region in self.locationManager.monitoredRegions {
                    if region.identifier == identifier {
                        self.locationManager.stopMonitoring(for: region)
                        break
                    }
                }
            }

            // Cancel dwell timer if active
            self.dwellTimer.cancelDwellTimer(for: identifier)

            // Remove from storage
            self.storage.removeGeofence(identifier)

            // Clean up timer reference
            self.expirationTimers.removeValue(forKey: identifier)
        }
        timer.resume()

        expirationTimers[identifier] = timer
    }

    private func cancelExpirationTimer(for identifier: String) {
        if let timer = expirationTimers[identifier] {
            timer.cancel()
            expirationTimers.removeValue(forKey: identifier)
        }
    }

    private func cancelAllExpirationTimers() {
        for (_, timer) in expirationTimers {
            timer.cancel()
        }
        expirationTimers.removeAll()
    }
}
