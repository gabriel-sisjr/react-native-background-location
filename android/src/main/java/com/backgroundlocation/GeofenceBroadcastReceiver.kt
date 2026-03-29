package com.backgroundlocation

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.location.LocationManager
import android.util.Log
import com.google.android.gms.location.Geofence
import com.google.android.gms.location.GeofencingEvent

/**
 * BroadcastReceiver that handles geofence transition events from GeofencingClient
 * and proximity alert fallback from LocationManager
 */
class GeofenceBroadcastReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "GeofenceBroadcastRx"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val geofencingEvent = GeofencingEvent.fromIntent(intent)

        if (geofencingEvent == null) {
            // Might be from proximity alert fallback
            handleProximityAlert(context, intent)
            return
        }

        if (geofencingEvent.hasError()) {
            Log.e(TAG, "Geofencing error code: ${geofencingEvent.errorCode}")
            return
        }

        val transitionType = geofencingEvent.geofenceTransition
        val triggeringGeofences = geofencingEvent.triggeringGeofences ?: return
        val triggeringLocation = geofencingEvent.triggeringLocation

        val manager = GeofenceManagerHolder.getInstance(context)

        for (geofence in triggeringGeofences) {
            Log.d(TAG, "Transition ${transitionType} for geofence: ${geofence.requestId}")
            manager.handleTransition(
                geofenceId = geofence.requestId,
                transitionType = transitionType,
                triggeringLocation = triggeringLocation
            )
        }
    }

    /**
     * Handles proximity alert events (fallback for devices without Google Play Services)
     */
    private fun handleProximityAlert(context: Context, intent: Intent) {
        val entering = intent.getBooleanExtra(LocationManager.KEY_PROXIMITY_ENTERING, false)
        val geofenceId = intent.getStringExtra("geofenceId") ?: return

        val transitionType = if (entering) {
            Geofence.GEOFENCE_TRANSITION_ENTER
        } else {
            Geofence.GEOFENCE_TRANSITION_EXIT
        }

        Log.d(TAG, "Proximity alert: ${if (entering) "ENTER" else "EXIT"} for geofence: $geofenceId")

        val manager = GeofenceManagerHolder.getInstance(context)
        manager.handleTransition(
            geofenceId = geofenceId,
            transitionType = transitionType,
            triggeringLocation = null
        )
    }
}
