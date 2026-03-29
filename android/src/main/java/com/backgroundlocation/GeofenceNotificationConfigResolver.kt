package com.backgroundlocation

import android.content.Context

/**
 * Resolves the effective notification config for a geofence transition.
 *
 * Resolution chain (highest to lowest priority):
 * 1. Per-geofence transitionOverrides[transitionType]
 * 2. Per-geofence notificationOptions
 * 3. Global config transitionOverrides[transitionType]
 * 4. Global config (configureGeofenceNotifications)
 * 5. Built-in defaults (GeofenceNotificationConfig.DEFAULTS)
 */
object GeofenceNotificationConfigResolver {

    /**
     * Resolves the effective notification config by walking the resolution chain.
     *
     * @param context Android context for loading global config from SharedPreferences
     * @param perGeofenceConfigJson Raw JSON string of per-geofence notification options (nullable)
     * @param transitionType Transition type string: "ENTER", "EXIT", or "DWELL"
     * @return Fully resolved [GeofenceNotificationConfig] ready for notification building
     */
    fun resolve(
        context: Context,
        perGeofenceConfigJson: String?,
        transitionType: String
    ): GeofenceNotificationConfig {
        // 1. Start with defaults
        var resolved = GeofenceNotificationConfig.DEFAULTS

        // 2. Load global config and merge on top
        val globalConfig = GeofenceNotificationConfigStore.load(context)
        resolved = globalConfig.mergeWith(resolved)

        // 3. Apply global transitionOverrides if present
        globalConfig.transitionOverrides?.get(transitionType)?.let { globalTransOverride ->
            resolved = globalTransOverride.mergeWith(resolved)
        }

        // 4. If per-geofence config exists, merge on top
        if (perGeofenceConfigJson != null) {
            val perGeofenceConfig = GeofenceNotificationConfig.fromJsonString(perGeofenceConfigJson)

            // Check if per-geofence explicitly disables notifications
            if (perGeofenceConfig.enabled == false) {
                return perGeofenceConfig
            }

            resolved = perGeofenceConfig.mergeWith(resolved)

            // 5. Apply per-geofence transitionOverrides if present
            perGeofenceConfig.transitionOverrides?.get(transitionType)?.let { perGeofenceTransOverride ->
                resolved = perGeofenceTransOverride.mergeWith(resolved)
            }
        }

        return resolved
    }
}
