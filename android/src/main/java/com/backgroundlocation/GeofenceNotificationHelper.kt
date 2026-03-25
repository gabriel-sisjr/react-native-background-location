package com.backgroundlocation

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import androidx.core.app.NotificationCompat

/**
 * Handles notifications for geofence transition events
 * Uses a separate notification channel from location tracking
 * Reuses NotificationDefaults for icon/color resolution
 */
object GeofenceNotificationHelper {

    private const val CHANNEL_ID = "geofence_transition_channel"
    private const val CHANNEL_NAME = "Geofence Transitions"
    private const val NOTIFICATION_BASE_ID = 10000

    /**
     * Creates the geofence notification channel (Android 8.0+)
     */
    fun createNotificationChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "Notifications for geofence transitions"
                setShowBadge(true)
            }

            val notificationManager =
                context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }

    /**
     * Shows a notification for a geofence transition event
     */
    fun showTransitionNotification(
        context: Context,
        geofenceId: String,
        transitionType: String,
        notificationId: Int = geofenceId.hashCode() + NOTIFICATION_BASE_ID
    ) {
        createNotificationChannel(context)

        val title = when (transitionType) {
            "ENTER" -> "Entered geofence"
            "EXIT" -> "Exited geofence"
            "DWELL" -> "Dwelling in geofence"
            else -> "Geofence transition"
        }
        val text = "Geofence: $geofenceId"

        val smallIcon = NotificationDefaults.getSmallIcon(context)

        val builder = NotificationCompat.Builder(context, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(text)
            .setSmallIcon(smallIcon)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)

        NotificationDefaults.getColor(context)?.let { color ->
            builder.setColor(color)
        }

        val notificationManager =
            context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.notify(notificationId, builder.build())
    }
}
