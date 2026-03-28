import Foundation
import UserNotifications

/// Handles local notification display for geofence transitions on iOS.
///
/// IMPORTANT: This class checks notification authorization status but
/// NEVER requests permissions. The consuming app is responsible for
/// calling `UNUserNotificationCenter.requestAuthorization()`.
///
/// @since 0.11.0
@objc public class GeofenceNotificationHelper: NSObject {

    @objc public static let shared = GeofenceNotificationHelper()

    private override init() {
        super.init()
    }

    /// Shows a local notification for a geofence transition event.
    /// Expects a fully resolved config (defaults and overrides already applied).
    /// Checks auth status first; silently skips if not authorized.
    @objc public func showTransitionNotification(
        geofenceId: String,
        transitionType: String,
        latitude: Double,
        longitude: Double,
        radius: Double,
        timestamp: String,
        metadata: String?,
        config: GeofenceNotificationConfig
    ) {
        // Check enabled flag (nil or true = enabled, false = disabled)
        if config.enabled?.boolValue == false {
            return
        }

        // Config is already fully resolved by the resolution chain.
        // Build context and resolve templates.
        let context = GeofenceNotificationConfig.TransitionContext(
            identifier: geofenceId,
            transitionType: transitionType,
            latitude: latitude,
            longitude: longitude,
            radius: radius,
            timestamp: timestamp,
            metadata: metadata
        )

        let resolvedTitle = GeofenceNotificationConfig.resolveTemplate(
            config.title ?? "", context: context
        )
        let resolvedText = GeofenceNotificationConfig.resolveTemplate(
            config.text ?? "", context: context
        )

        // Check notification authorization status
        let center = UNUserNotificationCenter.current()
        center.getNotificationSettings { settings in
            switch settings.authorizationStatus {
            case .authorized, .provisional:
                break
            case .ephemeral:
                break
            case .notDetermined:
                NSLog("[BackgroundLocation] Notification auth not granted, skipping geofence notification (status: notDetermined)")
                return
            case .denied:
                NSLog("[BackgroundLocation] Notification auth not granted, skipping geofence notification (status: denied)")
                return
            @unknown default:
                NSLog("[BackgroundLocation] Notification auth not granted, skipping geofence notification (status: unknown)")
                return
            }

            // Build and schedule the notification
            let content = UNMutableNotificationContent()
            content.title = resolvedTitle
            content.body = resolvedText
            content.sound = .default

            // Deduplication: same geofenceId + transitionType replaces previous
            let requestId = "geofence_\(geofenceId)_\(transitionType)"

            // Trigger immediately
            let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 0.1, repeats: false)

            let request = UNNotificationRequest(
                identifier: requestId,
                content: content,
                trigger: trigger
            )

            center.add(request) { error in
                if let error = error {
                    NSLog("[BackgroundLocation] Failed to schedule geofence notification: \(error.localizedDescription)")
                }
            }
        }
    }
}
