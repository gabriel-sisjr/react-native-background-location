package com.backgroundlocation

import org.json.JSONObject

/**
 * Kotlin representation of NotificationOptions from TypeScript.
 * All fields nullable to support partial configs and Phase 2 merge semantics.
 *
 * @since 0.11.0
 */
data class GeofenceNotificationConfig(
    val enabled: Boolean? = true,
    val title: String? = null,
    val text: String? = null,
    val channelName: String? = null,
    val channelId: String? = null,
    val priority: String? = null,
    val smallIcon: String? = null,
    val largeIcon: String? = null,
    val color: String? = null,
    val showTimestamp: Boolean? = null,
    val subtext: String? = null,
    val transitionOverrides: Map<String, GeofenceNotificationConfig>? = null
) {
    companion object {
        /** Built-in defaults when no configuration is provided */
        val DEFAULTS = GeofenceNotificationConfig(
            enabled = true,
            title = "{{transitionType}} zone: {{identifier}}",
            text = "Transition detected"
        )

        fun fromJson(json: JSONObject): GeofenceNotificationConfig {
            val overrides = json.optJSONObject("transitionOverrides")?.let { overridesJson ->
                val map = mutableMapOf<String, GeofenceNotificationConfig>()
                overridesJson.keys().forEach { key ->
                    val overrideJson = overridesJson.optJSONObject(key)
                    if (overrideJson != null) {
                        map[key] = fromJson(overrideJson)
                    }
                }
                if (map.isNotEmpty()) map else null
            }

            return GeofenceNotificationConfig(
                enabled = if (json.has("enabled")) json.getBoolean("enabled") else null,
                title = json.opt("title") as? String,
                text = json.opt("text") as? String,
                channelName = json.opt("channelName") as? String,
                channelId = json.opt("channelId") as? String,
                priority = json.opt("priority") as? String,
                smallIcon = json.opt("smallIcon") as? String,
                largeIcon = json.opt("largeIcon") as? String,
                color = json.opt("color") as? String,
                showTimestamp = if (json.has("showTimestamp")) json.getBoolean("showTimestamp") else null,
                subtext = json.opt("subtext") as? String,
                transitionOverrides = overrides
            )
        }

        fun fromJsonString(jsonString: String): GeofenceNotificationConfig {
            return fromJson(JSONObject(jsonString))
        }
    }

    fun toJson(): JSONObject {
        val json = JSONObject()
        enabled?.let { json.put("enabled", it) }
        title?.let { json.put("title", it) }
        text?.let { json.put("text", it) }
        channelName?.let { json.put("channelName", it) }
        channelId?.let { json.put("channelId", it) }
        priority?.let { json.put("priority", it) }
        smallIcon?.let { json.put("smallIcon", it) }
        largeIcon?.let { json.put("largeIcon", it) }
        color?.let { json.put("color", it) }
        showTimestamp?.let { json.put("showTimestamp", it) }
        subtext?.let { json.put("subtext", it) }
        transitionOverrides?.let { overrides ->
            val overridesJson = JSONObject()
            overrides.forEach { (key, config) ->
                overridesJson.put(key, config.toJson())
            }
            json.put("transitionOverrides", overridesJson)
        }
        return json
    }

    fun toJsonString(): String = toJson().toString()

    /**
     * Merges this config with a parent config.
     * Non-null fields in this config take precedence.
     */
    fun mergeWith(parent: GeofenceNotificationConfig): GeofenceNotificationConfig {
        return GeofenceNotificationConfig(
            enabled = this.enabled ?: parent.enabled,
            title = this.title ?: parent.title,
            text = this.text ?: parent.text,
            channelName = this.channelName ?: parent.channelName,
            channelId = this.channelId ?: parent.channelId,
            priority = this.priority ?: parent.priority,
            smallIcon = this.smallIcon ?: parent.smallIcon,
            largeIcon = this.largeIcon ?: parent.largeIcon,
            color = this.color ?: parent.color,
            showTimestamp = this.showTimestamp ?: parent.showTimestamp,
            subtext = this.subtext ?: parent.subtext
        )
    }
}
