package com.backgroundlocation

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Manifest-registered BroadcastReceiver for notification action button clicks.
 * Receives PendingIntent broadcasts from notification actions and forwards
 * them via NotificationActionFlow to BackgroundLocationModule.
 *
 * Flow: Notification action click -> PendingIntent -> this receiver
 *       -> NotificationActionFlow.emit() (SharedFlow)
 *       -> BackgroundLocationModule collector -> JS event
 */
class NotificationActionReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent?) {
        intent ?: return

        val tripId = intent.getStringExtra(EXTRA_TRIP_ID) ?: return
        val actionId = intent.getStringExtra(EXTRA_ACTION_ID) ?: return

        android.util.Log.d("NotificationActionReceiver", "Action received: actionId=$actionId, tripId=$tripId")

        NotificationActionFlow.emit(NotificationActionEvent.ActionClicked(tripId = tripId, actionId = actionId))
    }

    companion object {
        const val ACTION_NOTIFICATION_BUTTON = "com.backgroundlocation.NOTIFICATION_BUTTON_ACTION"
        const val EXTRA_TRIP_ID = "tripId"
        const val EXTRA_ACTION_ID = "actionId"
    }
}
