package com.backgroundlocation

import org.json.JSONObject

/**
 * Resolves {{variable}} template placeholders in notification strings.
 *
 * Template resolution happens on the native side because geofence
 * notifications must render when the JS runtime is not active.
 *
 * @since 0.11.0
 */
object GeofenceTemplateResolver {

    private val TEMPLATE_REGEX = Regex("\\{\\{(\\w+(?:\\.\\w+)*)\\}\\}")

    data class TransitionContext(
        val identifier: String,
        val transitionType: String,
        val latitude: Double,
        val longitude: Double,
        val radius: Double,
        val timestamp: String,
        val metadata: JSONObject?
    )

    fun resolve(template: String, context: TransitionContext): String {
        if (!template.contains("{{")) return template

        return TEMPLATE_REGEX.replace(template) { matchResult ->
            val variablePath = matchResult.groupValues[1]
            resolveVariable(variablePath, context)
        }
    }

    private fun resolveVariable(path: String, context: TransitionContext): String {
        if (path.startsWith("metadata.")) {
            return resolveMetadataPath(path.removePrefix("metadata."), context.metadata)
        }

        return when (path) {
            "identifier" -> context.identifier
            "transitionType" -> context.transitionType
            "latitude" -> context.latitude.toString()
            "longitude" -> context.longitude.toString()
            "radius" -> context.radius.toString()
            "timestamp" -> context.timestamp
            else -> ""
        }
    }

    private fun resolveMetadataPath(path: String, metadata: JSONObject?): String {
        if (metadata == null) return ""

        val segments = path.split(".")
        var current: Any? = metadata

        for (segment in segments) {
            current = when (current) {
                is JSONObject -> current.opt(segment)
                else -> return ""
            }
        }

        return when {
            current == null -> ""
            current == JSONObject.NULL -> ""
            else -> current.toString()
        }
    }
}
