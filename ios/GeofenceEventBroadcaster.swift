import Foundation

/// Handles emission of geofence transition events to React Native JS layer
/// Uses a closure-based pattern consistent with LocationManagerWrapper.onLocationUpdate
@objc public class GeofenceEventBroadcaster: NSObject {

    @objc public static let shared = GeofenceEventBroadcaster()

    private static let isoFormatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    /// Closure set by BackgroundLocation.mm to emit events to JS
    @objc public var onGeofenceTransition: (([String: Any]) -> Void)?

    private override init() {
        super.init()
    }

    /// Broadcasts a geofence transition event to the JS layer
    /// - Parameters:
    ///   - geofenceId: Identifier of the geofence that triggered the event
    ///   - transitionType: Type of transition ("ENTER", "EXIT", "DWELL")
    ///   - latitude: Device latitude at the moment of transition
    ///   - longitude: Device longitude at the moment of transition
    ///   - timestamp: Timestamp of the transition
    ///   - distanceFromCenter: Distance from the center of the geofence in meters
    ///   - metadata: Optional JSON string with geofence metadata
    @objc public func broadcastTransition(
        geofenceId: String,
        transitionType: String,
        latitude: Double,
        longitude: Double,
        timestamp: Date,
        distanceFromCenter: Double,
        metadata: String?
    ) {
        var eventData: [String: Any] = [
            "geofenceId": geofenceId,
            "transitionType": transitionType,
            "latitude": latitude,
            "longitude": longitude,
            "timestamp": GeofenceEventBroadcaster.isoFormatter.string(from: timestamp),
            "distanceFromCenter": distanceFromCenter,
        ]

        // Parse metadata JSON string back to dictionary for JS consumption
        if let metadataJson = metadata,
           let metaData = metadataJson.data(using: .utf8),
           let metaObj = try? JSONSerialization.jsonObject(with: metaData) as? [String: Any] {
            eventData["metadata"] = metaObj
        }

        onGeofenceTransition?(eventData)

        NSLog("[BackgroundLocation] Geofence transition broadcast: \(transitionType) for '\(geofenceId)'")
    }
}
