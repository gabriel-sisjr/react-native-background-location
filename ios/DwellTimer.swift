import Foundation

/// Timer-based DWELL detection for iOS
/// iOS does not support DWELL/LOITER natively like Android's GeofencingClient.
/// This class manages per-geofence timers that fire after the configured loitering delay.
///
/// Flow:
/// 1. Device enters region -> didEnterRegion called
/// 2. If DWELL is configured, startDwellTimer() is called with the loitering delay
/// 3. If timer expires without EXIT -> callback fires (emit DWELL event)
/// 4. If EXIT before timer -> cancelDwellTimer(), timer is invalidated
@objc public class DwellTimer: NSObject {

    private var activeTimers: [String: DispatchSourceTimer] = [:]
    private let queue = DispatchQueue(label: "com.backgroundlocation.dwelltimer", qos: .userInitiated)

    /// Starts a dwell timer for a specific geofence identifier
    /// - Parameters:
    ///   - identifier: The geofence identifier
    ///   - delayMs: The loitering delay in milliseconds
    ///   - callback: Closure called when the dwell timer fires (device stayed in region)
    @objc public func startDwellTimer(
        for identifier: String,
        delayMs: Int32,
        callback: @escaping () -> Void
    ) {
        queue.async { [weak self] in
            guard let self = self else { return }

            // Cancel existing timer for this identifier if any
            self.cancelTimerInternal(for: identifier)

            let delaySeconds = Double(delayMs) / 1000.0

            let timer = DispatchSource.makeTimerSource(queue: self.queue)
            timer.schedule(deadline: .now() + delaySeconds)
            timer.setEventHandler { [weak self] in
                callback()
                self?.activeTimers.removeValue(forKey: identifier)
            }
            timer.setCancelHandler { }
            timer.resume()

            self.activeTimers[identifier] = timer

            NSLog("[BackgroundLocation] Dwell timer started for '\(identifier)' (delay: \(delaySeconds)s)")
        }
    }

    /// Cancels the dwell timer for a specific geofence identifier
    /// Called when the device exits the region before the loitering delay elapses
    @objc public func cancelDwellTimer(for identifier: String) {
        queue.async { [weak self] in
            self?.cancelTimerInternal(for: identifier)
        }
    }

    /// Cancels all active dwell timers
    @objc public func cancelAll() {
        queue.async { [weak self] in
            guard let self = self else { return }
            for (identifier, timer) in self.activeTimers {
                timer.cancel()
                NSLog("[BackgroundLocation] Dwell timer cancelled for '\(identifier)'")
            }
            self.activeTimers.removeAll()
        }
    }

    /// Returns whether a dwell timer is active for the given identifier
    @objc public func isTimerActive(for identifier: String) -> Bool {
        return queue.sync {
            return activeTimers[identifier] != nil
        }
    }

    /// Returns the count of active dwell timers
    @objc public var activeTimerCount: Int {
        return queue.sync {
            return activeTimers.count
        }
    }

    // MARK: - Private

    /// Must be called on `queue`
    private func cancelTimerInternal(for identifier: String) {
        if let timer = activeTimers[identifier] {
            timer.cancel()
            activeTimers.removeValue(forKey: identifier)
            NSLog("[BackgroundLocation] Dwell timer cancelled for '\(identifier)'")
        }
    }
}
