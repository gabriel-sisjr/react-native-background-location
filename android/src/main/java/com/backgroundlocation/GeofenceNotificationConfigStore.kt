package com.backgroundlocation

import android.content.Context
import android.content.SharedPreferences

/**
 * Persists global geofence notification config to SharedPreferences.
 *
 * IMPORTANT: GeofenceBroadcastReceiver runs outside the React Native module
 * lifecycle. This store must work with only a Context (no module dependency).
 */
object GeofenceNotificationConfigStore {

    private const val PREFS_FILE = "geofence_notification_config"
    private const val KEY_CONFIG = "config_json"

    @Volatile
    private var cachedConfig: GeofenceNotificationConfig? = null

    fun save(context: Context, config: GeofenceNotificationConfig) {
        cachedConfig = config
        getPrefs(context)
            .edit()
            .putString(KEY_CONFIG, config.toJsonString())
            .apply()
    }

    fun load(context: Context): GeofenceNotificationConfig {
        cachedConfig?.let { return it }

        val json = getPrefs(context).getString(KEY_CONFIG, null)
        val config = if (json != null) {
            try {
                GeofenceNotificationConfig.fromJsonString(json)
            } catch (_: Exception) {
                GeofenceNotificationConfig.DEFAULTS
            }
        } else {
            GeofenceNotificationConfig.DEFAULTS
        }

        cachedConfig = config
        return config
    }

    fun clear(context: Context) {
        cachedConfig = null
        getPrefs(context)
            .edit()
            .remove(KEY_CONFIG)
            .apply()
    }

    private fun getPrefs(context: Context): SharedPreferences =
        context.applicationContext.getSharedPreferences(PREFS_FILE, Context.MODE_PRIVATE)
}
