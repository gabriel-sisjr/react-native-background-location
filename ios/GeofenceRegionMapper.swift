import Foundation
import CoreLocation

/// Maps TypeScript GeofenceRegion JSON to CLCircularRegion and internal data structures
@objc public class GeofenceRegionMapper: NSObject {

    // Transition type bitmask constants (matching TypeScript/Android)
    static let TRANSITION_ENTER = 1
    static let TRANSITION_EXIT = 2
    static let TRANSITION_DWELL = 4

    /// Parsed representation of a GeofenceRegion from TypeScript
    @objc public class GeofenceRegionData: NSObject {
        @objc public let identifier: String
        @objc public let latitude: Double
        @objc public let longitude: Double
        @objc public let radius: Double
        @objc public let transitionTypes: Int32
        @objc public let loiteringDelay: Int32
        @objc public let expirationDuration: NSNumber? // milliseconds, nil = indefinite
        @objc public let metadata: String?
        @objc public let createdAt: Date?

        init(
            identifier: String,
            latitude: Double,
            longitude: Double,
            radius: Double,
            transitionTypes: Int32,
            loiteringDelay: Int32,
            expirationDuration: NSNumber?,
            metadata: String?,
            createdAt: Date? = nil
        ) {
            self.identifier = identifier
            self.latitude = latitude
            self.longitude = longitude
            self.radius = radius
            self.transitionTypes = transitionTypes
            self.loiteringDelay = loiteringDelay
            self.expirationDuration = expirationDuration
            self.metadata = metadata
            self.createdAt = createdAt
            super.init()
        }

        /// Whether ENTER transition is monitored
        @objc public var monitorsEnter: Bool {
            return Int(transitionTypes) & GeofenceRegionMapper.TRANSITION_ENTER != 0
        }

        /// Whether EXIT transition is monitored
        @objc public var monitorsExit: Bool {
            return Int(transitionTypes) & GeofenceRegionMapper.TRANSITION_EXIT != 0
        }

        /// Whether DWELL transition is monitored
        @objc public var monitorsDwell: Bool {
            return Int(transitionTypes) & GeofenceRegionMapper.TRANSITION_DWELL != 0
        }

        /// Center coordinate of the geofence
        @objc public var centerCoordinate: CLLocationCoordinate2D {
            return CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
        }

        /// Center location of the geofence (for distance calculations)
        @objc public var centerLocation: CLLocation {
            return CLLocation(latitude: latitude, longitude: longitude)
        }
    }

    // MARK: - JSON Parsing

    /// Parses a single GeofenceRegion from JSON string
    @objc public static func parseRegionJson(_ json: String) throws -> GeofenceRegionData {
        guard let data = json.data(using: .utf8),
              let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw GeofenceError.invalidRegion("Failed to parse region JSON")
        }
        return try parseRegionDict(dict)
    }

    /// Parses an array of GeofenceRegions from JSON string
    @objc public static func parseRegionsJson(_ json: String) throws -> [GeofenceRegionData] {
        guard let data = json.data(using: .utf8),
              let array = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] else {
            throw GeofenceError.invalidRegion("Failed to parse regions JSON array")
        }
        return try array.map { try parseRegionDict($0) }
    }

    /// Parses identifiers array from JSON string
    @objc public static func parseIdentifiersJson(_ json: String) throws -> [String] {
        guard let data = json.data(using: .utf8),
              let array = try? JSONSerialization.jsonObject(with: data) as? [String] else {
            throw GeofenceError.invalidRegion("Failed to parse identifiers JSON array")
        }
        return array
    }

    private static func parseRegionDict(_ dict: [String: Any]) throws -> GeofenceRegionData {
        guard let identifier = dict["identifier"] as? String, !identifier.isEmpty else {
            throw GeofenceError.invalidRegion("Geofence identifier is required and cannot be empty")
        }

        guard let latitude = dict["latitude"] as? Double else {
            throw GeofenceError.invalidRegion("Latitude is required")
        }

        guard let longitude = dict["longitude"] as? Double else {
            throw GeofenceError.invalidRegion("Longitude is required")
        }

        guard let radius = dict["radius"] as? Double else {
            throw GeofenceError.invalidRegion("Radius is required")
        }

        // Parse transition types (default: ENTER | EXIT)
        var transitionBitmask: Int32 = Int32(TRANSITION_ENTER | TRANSITION_EXIT)
        if let typesArray = dict["transitionTypes"] as? [String] {
            var bitmask: Int = 0
            for typeStr in typesArray {
                switch typeStr {
                case "ENTER": bitmask |= TRANSITION_ENTER
                case "EXIT": bitmask |= TRANSITION_EXIT
                case "DWELL": bitmask |= TRANSITION_DWELL
                default: break
                }
            }
            transitionBitmask = Int32(bitmask)
        }

        let loiteringDelay = Int32(dict["loiteringDelay"] as? Int ?? 30000)

        var expirationDuration: NSNumber? = nil
        if let expiration = dict["expirationDuration"] as? NSNumber {
            expirationDuration = expiration
        }

        var metadata: String? = nil
        if let metaDict = dict["metadata"] as? [String: Any],
           let metaData = try? JSONSerialization.data(withJSONObject: metaDict),
           let metaString = String(data: metaData, encoding: .utf8) {
            metadata = metaString
        }

        return GeofenceRegionData(
            identifier: identifier,
            latitude: latitude,
            longitude: longitude,
            radius: radius,
            transitionTypes: transitionBitmask,
            loiteringDelay: loiteringDelay,
            expirationDuration: expirationDuration,
            metadata: metadata
        )
    }

    // MARK: - CLCircularRegion Conversion

    /// Converts a GeofenceRegionData to CLCircularRegion for monitoring
    @objc public static func toCLRegion(_ region: GeofenceRegionData) -> CLCircularRegion {
        let center = CLLocationCoordinate2D(latitude: region.latitude, longitude: region.longitude)
        let clRegion = CLCircularRegion(center: center, radius: region.radius, identifier: region.identifier)

        // CLCircularRegion only supports ENTER and EXIT natively
        // DWELL is handled by DwellTimer
        clRegion.notifyOnEntry = region.monitorsEnter || region.monitorsDwell
        clRegion.notifyOnExit = region.monitorsExit || region.monitorsDwell
        // Note: DWELL requires ENTER notification to start the timer

        return clRegion
    }

    // MARK: - Validation

    /// Validates a GeofenceRegionData, throws GeofenceError if invalid
    @objc public static func validate(_ region: GeofenceRegionData) throws {
        if region.identifier.isEmpty {
            throw GeofenceError.invalidRegion("Geofence identifier cannot be empty")
        }
        if region.latitude < -90 || region.latitude > 90 {
            throw GeofenceError.invalidRegion("Latitude must be between -90 and 90")
        }
        if region.longitude < -180 || region.longitude > 180 {
            throw GeofenceError.invalidRegion("Longitude must be between -180 and 180")
        }
        if region.radius < 100 {
            throw GeofenceError.invalidRegion("Radius must be at least 100 meters")
        }
    }

    // MARK: - JSON Serialization

    /// Converts a geofence entity dictionary to a GeofenceRegion JSON-compatible dictionary
    @objc public static func entityToDict(
        identifier: String,
        latitude: Double,
        longitude: Double,
        radius: Double,
        transitionTypes: Int32,
        loiteringDelay: Int32,
        expirationDuration: NSNumber?,
        metadata: String?
    ) -> [String: Any] {
        var dict: [String: Any] = [
            "identifier": identifier,
            "latitude": latitude,
            "longitude": longitude,
            "radius": radius,
            "loiteringDelay": loiteringDelay,
        ]

        // Convert bitmask back to array
        var types: [String] = []
        if Int(transitionTypes) & TRANSITION_ENTER != 0 { types.append("ENTER") }
        if Int(transitionTypes) & TRANSITION_EXIT != 0 { types.append("EXIT") }
        if Int(transitionTypes) & TRANSITION_DWELL != 0 { types.append("DWELL") }
        dict["transitionTypes"] = types

        if let exp = expirationDuration {
            dict["expirationDuration"] = exp
        }

        if let meta = metadata,
           let metaData = meta.data(using: .utf8),
           let metaObj = try? JSONSerialization.jsonObject(with: metaData) {
            dict["metadata"] = metaObj
        }

        return dict
    }
}

// MARK: - GeofenceError

@objc public class GeofenceError: NSError {
    @objc public static let domain = "com.backgroundlocation.geofence"

    @objc public let code_: String

    private init(code: String, message: String) {
        self.code_ = code
        super.init(domain: GeofenceError.domain, code: 0, userInfo: [NSLocalizedDescriptionKey: message])
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    @objc public static func invalidRegion(_ message: String) -> GeofenceError {
        return GeofenceError(code: "INVALID_REGION", message: message)
    }

    @objc public static func duplicateIdentifier(_ identifier: String) -> GeofenceError {
        return GeofenceError(code: "DUPLICATE_IDENTIFIER", message: "Geofence with identifier '\(identifier)' already exists")
    }

    @objc public static func limitExceeded(limit: Int) -> GeofenceError {
        return GeofenceError(code: "LIMIT_EXCEEDED", message: "Maximum of \(limit) geofences reached")
    }

    @objc public static func monitoringFailed(_ message: String) -> GeofenceError {
        return GeofenceError(code: "MONITORING_FAILED", message: message)
    }

    @objc public static func notAvailable() -> GeofenceError {
        return GeofenceError(code: "NOT_AVAILABLE", message: "Geofence monitoring is not available on this device")
    }

    @objc public static func permissionDenied(_ message: String) -> GeofenceError {
        return GeofenceError(code: "PERMISSION_DENIED", message: message)
    }
}
