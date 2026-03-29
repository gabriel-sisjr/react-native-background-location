package com.backgroundlocation

import org.json.JSONObject

/**
 * Data class representing notification configuration options for background location tracking.
 * Mirrors the TypeScript `NotificationOptions` interface (tracking-specific subset).
 *
 * Serialized as a JSON string when crossing the TurboModule bridge (Codegen does not
 * support complex nested objects).
 */
data class NotificationOptions(
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
    val actions: String? = null // Raw JSON array string for notification actions
) {
    companion object {
        /**
         * Parses a [NotificationOptions] from a [JSONObject].
         *
         * Uses `json.opt("key") as? Type` pattern instead of `json.optString("key", null)`
         * to correctly distinguish between absent keys and explicit `"null"` strings.
         */
        fun fromJson(json: JSONObject): NotificationOptions {
            return NotificationOptions(
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
                actions = json.optJSONArray("actions")?.toString()
            )
        }

        /**
         * Parses a [NotificationOptions] from a JSON string.
         *
         * @param jsonString A valid JSON string representing notification options
         * @return Parsed [NotificationOptions] instance
         */
        fun fromJsonString(jsonString: String): NotificationOptions {
            return fromJson(JSONObject(jsonString))
        }
    }

    /**
     * Converts this [NotificationOptions] to a [JSONObject].
     */
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
        actions?.let { json.put("actions", org.json.JSONArray(it)) }
        return json
    }

    /**
     * Converts this [NotificationOptions] to a JSON string.
     */
    fun toJsonString(): String = toJson().toString()
}
