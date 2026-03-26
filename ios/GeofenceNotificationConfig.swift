import Foundation

/// Swift representation of NotificationOptions from TypeScript.
/// All fields optional to support partial configs and Phase 2 merge semantics.
///
/// @since 0.11.0
@objc public class GeofenceNotificationConfig: NSObject {

    @objc public let enabled: NSNumber?  // nil = inherit, true/false = explicit
    @objc public let title: String?
    @objc public let text: String?
    @objc public let channelName: String?   // Android-only, stored for parity
    @objc public let channelId: String?     // Android-only, stored for parity
    @objc public let priority: String?      // Android-only, stored for parity
    @objc public let smallIcon: String?     // Android-only, stored for parity
    @objc public let largeIcon: String?     // Android-only, stored for parity
    @objc public let color: String?         // Android-only, stored for parity
    @objc public let showTimestamp: NSNumber? // Android-only, stored for parity
    @objc public let subtext: String?       // Android-only, stored for parity

    /// Per-transition-type notification overrides (e.g. "ENTER", "EXIT", "DWELL")
    /// Each key maps to a GeofenceNotificationConfig with overrides for that transition.
    /// Not exposed to ObjC because dictionaries with custom value types are not bridgeable.
    public let transitionOverrides: [String: GeofenceNotificationConfig]?

    /// Built-in defaults when no configuration is provided
    @objc public static let defaults = GeofenceNotificationConfig(
        enabled: true,
        title: "{{transitionType}} zone: {{identifier}}",
        text: "Transition detected"
    )

    @objc public init(
        enabled: Bool? = true,
        title: String? = nil,
        text: String? = nil,
        channelName: String? = nil,
        channelId: String? = nil,
        priority: String? = nil,
        smallIcon: String? = nil,
        largeIcon: String? = nil,
        color: String? = nil,
        showTimestamp: Bool? = nil,
        subtext: String? = nil
    ) {
        self.enabled = enabled.map { NSNumber(value: $0) }
        self.title = title
        self.text = text
        self.channelName = channelName
        self.channelId = channelId
        self.priority = priority
        self.smallIcon = smallIcon
        self.largeIcon = largeIcon
        self.color = color
        self.showTimestamp = showTimestamp.map { NSNumber(value: $0) }
        self.subtext = subtext
        self.transitionOverrides = nil
        super.init()
    }

    /// Convenience initializer from NSNumber (for ObjC bridge)
    private init(
        enabledNumber: NSNumber?,
        title: String?,
        text: String?,
        channelName: String?,
        channelId: String?,
        priority: String?,
        smallIcon: String?,
        largeIcon: String?,
        color: String?,
        showTimestampNumber: NSNumber?,
        subtext: String?,
        transitionOverrides: [String: GeofenceNotificationConfig]? = nil
    ) {
        self.enabled = enabledNumber
        self.title = title
        self.text = text
        self.channelName = channelName
        self.channelId = channelId
        self.priority = priority
        self.smallIcon = smallIcon
        self.largeIcon = largeIcon
        self.color = color
        self.showTimestamp = showTimestampNumber
        self.subtext = subtext
        self.transitionOverrides = transitionOverrides
        super.init()
    }

    // MARK: - JSON Parsing

    @objc public static func fromJson(_ dict: [String: Any]) -> GeofenceNotificationConfig {
        // Parse transitionOverrides if present
        var overrides: [String: GeofenceNotificationConfig]? = nil
        if let overridesDict = dict["transitionOverrides"] as? [String: Any] {
            var parsed: [String: GeofenceNotificationConfig] = [:]
            for (key, value) in overridesDict {
                if let overrideDict = value as? [String: Any] {
                    parsed[key] = GeofenceNotificationConfig.fromJson(overrideDict)
                }
            }
            if !parsed.isEmpty {
                overrides = parsed
            }
        }

        return GeofenceNotificationConfig(
            enabledNumber: dict["enabled"] as? NSNumber,
            title: dict["title"] as? String,
            text: dict["text"] as? String,
            channelName: dict["channelName"] as? String,
            channelId: dict["channelId"] as? String,
            priority: dict["priority"] as? String,
            smallIcon: dict["smallIcon"] as? String,
            largeIcon: dict["largeIcon"] as? String,
            color: dict["color"] as? String,
            showTimestampNumber: dict["showTimestamp"] as? NSNumber,
            subtext: dict["subtext"] as? String,
            transitionOverrides: overrides
        )
    }

    @objc public static func fromJsonString(_ jsonString: String) -> GeofenceNotificationConfig? {
        guard let data = jsonString.data(using: .utf8),
              let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return nil
        }
        return fromJson(dict)
    }

    @objc public func toJson() -> [String: Any] {
        var dict: [String: Any] = [:]
        if let enabled = enabled { dict["enabled"] = enabled.boolValue }
        if let title = title { dict["title"] = title }
        if let text = text { dict["text"] = text }
        if let channelName = channelName { dict["channelName"] = channelName }
        if let channelId = channelId { dict["channelId"] = channelId }
        if let priority = priority { dict["priority"] = priority }
        if let smallIcon = smallIcon { dict["smallIcon"] = smallIcon }
        if let largeIcon = largeIcon { dict["largeIcon"] = largeIcon }
        if let color = color { dict["color"] = color }
        if let showTimestamp = showTimestamp { dict["showTimestamp"] = showTimestamp.boolValue }
        if let subtext = subtext { dict["subtext"] = subtext }
        if let overrides = transitionOverrides, !overrides.isEmpty {
            var overridesDict: [String: Any] = [:]
            for (key, config) in overrides {
                overridesDict[key] = config.toJson()
            }
            dict["transitionOverrides"] = overridesDict
        }
        return dict
    }

    @objc public func toJsonString() -> String {
        guard let data = try? JSONSerialization.data(withJSONObject: toJson()),
              let str = String(data: data, encoding: .utf8) else {
            return "{}"
        }
        return str
    }

    // MARK: - Merge

    /// Merges this config with a parent. Non-nil fields in self take precedence.
    /// transitionOverrides are NOT merged -- they are resolved separately in the resolution chain.
    @objc public func mergeWith(_ parent: GeofenceNotificationConfig) -> GeofenceNotificationConfig {
        return GeofenceNotificationConfig(
            enabledNumber: self.enabled ?? parent.enabled,
            title: self.title ?? parent.title,
            text: self.text ?? parent.text,
            channelName: self.channelName ?? parent.channelName,
            channelId: self.channelId ?? parent.channelId,
            priority: self.priority ?? parent.priority,
            smallIcon: self.smallIcon ?? parent.smallIcon,
            largeIcon: self.largeIcon ?? parent.largeIcon,
            color: self.color ?? parent.color,
            showTimestampNumber: self.showTimestamp ?? parent.showTimestamp,
            subtext: self.subtext ?? parent.subtext
        )
    }

    // MARK: - Resolution Chain

    /// Resolves the final notification config for a specific geofence transition.
    ///
    /// Resolution order (each layer merges on top of the previous):
    /// 1. Built-in defaults
    /// 2. Global config (from GeofenceNotificationConfigStore)
    /// 3. Global transitionOverrides[transitionType] (if present)
    /// 4. Per-geofence config (from notificationConfig JSON string)
    /// 5. Per-geofence transitionOverrides[transitionType] (if present)
    ///
    /// - Parameters:
    ///   - perGeofenceConfigJson: Optional JSON string with per-geofence notification config
    ///   - transitionType: The transition type string ("ENTER", "EXIT", "DWELL")
    /// - Returns: Fully resolved config ready for notification display
    public static func resolve(
        perGeofenceConfigJson: String?,
        transitionType: String
    ) -> GeofenceNotificationConfig {
        // Step 1: Start with built-in defaults
        var resolved = GeofenceNotificationConfig.defaults

        // Step 2: Merge global config
        let globalConfig = GeofenceNotificationConfigStore.shared.load()
        resolved = globalConfig.mergeWith(resolved)

        // Step 3: Apply global transitionOverrides for this transition type
        if let globalOverride = globalConfig.transitionOverrides?[transitionType] {
            resolved = globalOverride.mergeWith(resolved)
        }

        // Step 4: Merge per-geofence config (if present)
        if let configJson = perGeofenceConfigJson,
           let perGeofenceConfig = GeofenceNotificationConfig.fromJsonString(configJson) {

            resolved = perGeofenceConfig.mergeWith(resolved)

            // Step 5: Apply per-geofence transitionOverrides for this transition type
            if let perGeofenceOverride = perGeofenceConfig.transitionOverrides?[transitionType] {
                resolved = perGeofenceOverride.mergeWith(resolved)
            }
        }

        return resolved
    }

    // MARK: - Template Resolution

    /// Context data for template variable substitution
    public struct TransitionContext {
        public let identifier: String
        public let transitionType: String
        public let latitude: Double
        public let longitude: Double
        public let radius: Double
        public let timestamp: String     // ISO 8601
        public let metadata: String?     // JSON string
    }

    /// Regex pattern for {{variable}} and {{metadata.key}} placeholders
    private static let templatePattern = try! NSRegularExpression(
        pattern: "\\{\\{(\\w+(?:\\.\\w+)*)\\}\\}",
        options: []
    )

    /// Resolves {{variable}} placeholders in a template string
    @objc public static func resolveTemplate(_ template: String, context: TransitionContext) -> String {
        guard template.contains("{{") else { return template }

        let nsTemplate = template as NSString
        let range = NSRange(location: 0, length: nsTemplate.length)

        var result = template
        let matches = templatePattern.matches(in: template, options: [], range: range)

        // Process matches in reverse order to preserve indices
        for match in matches.reversed() {
            guard match.numberOfRanges >= 2 else { continue }

            let fullRange = Range(match.range(at: 0), in: template)!
            let varRange = Range(match.range(at: 1), in: template)!
            let varName = String(template[varRange])

            let resolved = resolveVariable(varName, context: context)
            result = result.replacingCharacters(in: fullRange, with: resolved)
        }

        return result
    }

    private static func resolveVariable(_ path: String, context: TransitionContext) -> String {
        if path.hasPrefix("metadata.") {
            let metadataPath = String(path.dropFirst("metadata.".count))
            return resolveMetadataPath(metadataPath, metadata: context.metadata)
        }

        switch path {
        case "identifier": return context.identifier
        case "transitionType": return context.transitionType
        case "latitude": return String(context.latitude)
        case "longitude": return String(context.longitude)
        case "radius": return String(context.radius)
        case "timestamp": return context.timestamp
        default: return ""
        }
    }

    private static func resolveMetadataPath(_ path: String, metadata: String?) -> String {
        guard let metadata = metadata,
              let data = metadata.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return ""
        }

        let segments = path.split(separator: ".").map(String.init)
        var current: Any? = json

        for segment in segments {
            if let dict = current as? [String: Any] {
                current = dict[segment]
            } else {
                return ""
            }
        }

        if let value = current {
            return "\(value)"
        }
        return ""
    }
}
