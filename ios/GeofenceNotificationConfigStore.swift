import Foundation

/// Persists global geofence notification config to UserDefaults.
/// Follows the existing `bg_location_*` key prefix convention.
@objc public class GeofenceNotificationConfigStore: NSObject {

    @objc public static let shared = GeofenceNotificationConfigStore()

    private override init() {
        super.init()
    }

    private let key = "bg_location_geofence_notification_config"

    @objc public func save(_ config: GeofenceNotificationConfig) {
        UserDefaults.standard.set(config.toJsonString(), forKey: key)
        UserDefaults.standard.synchronize()
    }

    @objc public func load() -> GeofenceNotificationConfig {
        guard let jsonString = UserDefaults.standard.string(forKey: key),
              let config = GeofenceNotificationConfig.fromJsonString(jsonString) else {
            return GeofenceNotificationConfig.defaults
        }
        return config
    }

    @objc public func clear() {
        UserDefaults.standard.removeObject(forKey: key)
        UserDefaults.standard.synchronize()
    }
}
