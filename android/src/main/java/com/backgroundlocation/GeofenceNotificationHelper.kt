package com.backgroundlocation

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import androidx.core.app.NotificationCompat
import org.json.JSONObject

/**
 * Handles notifications for geofence transition events.
 * Uses config-driven notification content with template variable resolution.
 *
 * @since 0.11.0
 */
object GeofenceNotificationHelper {

    private const val DEFAULT_CHANNEL_ID = "geofence_transition_channel"
    private const val DEFAULT_CHANNEL_NAME = "Geofence Transitions"
    private const val NOTIFICATION_BASE_ID = 10000

    /**
     * Shows a notification for a geofence transition event.
     * Reads config from GeofenceNotificationConfigStore.
     * Resolves template variables via GeofenceTemplateResolver.
     */
    fun showTransitionNotification(
        context: Context,
        geofenceId: String,
        transitionType: String,
        latitude: Double,
        longitude: Double,
        radius: Double,
        timestamp: String,
        metadata: String?,
        perGeofenceConfigJson: String? = null,
        notificationId: Int = geofenceId.hashCode() + NOTIFICATION_BASE_ID
    ) {
        // Resolve config through the full resolution chain
        val mergedConfig = GeofenceNotificationConfigResolver.resolve(
            context, perGeofenceConfigJson, transitionType
        )
        if (mergedConfig.enabled == false) return

        // Build transition context for template resolution
        val metadataJson = try {
            if (metadata != null) JSONObject(metadata) else null
        } catch (_: Exception) {
            null
        }

        val transitionContext = GeofenceTemplateResolver.TransitionContext(
            identifier = geofenceId,
            transitionType = transitionType,
            latitude = latitude,
            longitude = longitude,
            radius = radius,
            timestamp = timestamp,
            metadata = metadataJson
        )

        // Resolve template variables in title, text, and subtext
        val resolvedTitle = GeofenceTemplateResolver.resolve(
            mergedConfig.title ?: "", transitionContext
        )
        val resolvedText = GeofenceTemplateResolver.resolve(
            mergedConfig.text ?: "", transitionContext
        )

        // Determine channel settings
        val channelId = mergedConfig.channelId ?: DEFAULT_CHANNEL_ID
        val channelName = mergedConfig.channelName ?: DEFAULT_CHANNEL_NAME
        val importance = mapPriorityToImportance(mergedConfig.priority)

        // Create notification channel
        createNotificationChannel(context, channelId, channelName, importance)

        // Build notification
        val smallIcon = NotificationDefaults.getSmallIcon(context, mergedConfig.smallIcon)

        val builder = NotificationCompat.Builder(context, channelId)
            .setContentTitle(resolvedTitle)
            .setContentText(resolvedText)
            .setSmallIcon(smallIcon)
            .setAutoCancel(true)
            .setPriority(mapPriorityToCompat(mergedConfig.priority))

        // Color: config override -> NotificationDefaults fallback
        val color = if (mergedConfig.color != null) {
            NotificationDefaults.getColor(context, mergedConfig.color)
        } else {
            NotificationDefaults.getColor(context)
        }
        color?.let { builder.setColor(it) }

        // Large icon
        mergedConfig.largeIcon?.let { iconName ->
            NotificationDefaults.getLargeIcon(context, iconName)?.let { bitmap ->
                builder.setLargeIcon(bitmap)
            }
        }

        // Timestamp
        if (mergedConfig.showTimestamp == true) {
            builder.setShowWhen(true)
            builder.setWhen(System.currentTimeMillis())
        }

        // Subtext with template resolution
        mergedConfig.subtext?.let { subtextTemplate ->
            val resolvedSubtext = GeofenceTemplateResolver.resolve(subtextTemplate, transitionContext)
            builder.setSubText(resolvedSubtext)
        }

        val notificationManager =
            context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.notify(notificationId, builder.build())
    }

    private fun createNotificationChannel(
        context: Context,
        channelId: String,
        channelName: String,
        importance: Int
    ) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(channelId, channelName, importance).apply {
                description = "Notifications for geofence transitions"
                setShowBadge(true)
            }

            val notificationManager =
                context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }

    private fun mapPriorityToImportance(priority: String?): Int {
        return when (priority) {
            "LOW" -> NotificationManager.IMPORTANCE_LOW
            "DEFAULT" -> NotificationManager.IMPORTANCE_DEFAULT
            "HIGH" -> NotificationManager.IMPORTANCE_HIGH
            "MAX" -> NotificationManager.IMPORTANCE_MAX
            else -> NotificationManager.IMPORTANCE_DEFAULT
        }
    }

    private fun mapPriorityToCompat(priority: String?): Int {
        return when (priority) {
            "LOW" -> NotificationCompat.PRIORITY_LOW
            "DEFAULT" -> NotificationCompat.PRIORITY_DEFAULT
            "HIGH" -> NotificationCompat.PRIORITY_HIGH
            "MAX" -> NotificationCompat.PRIORITY_MAX
            else -> NotificationCompat.PRIORITY_DEFAULT
        }
    }
}
