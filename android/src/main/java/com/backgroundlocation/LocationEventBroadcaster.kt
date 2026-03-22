package com.backgroundlocation

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.location.Location
import android.os.Build
import android.os.Bundle
import androidx.localbroadcastmanager.content.LocalBroadcastManager
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * Handles communication between LocationService and React Native module
 * Uses LocalBroadcastManager to decouple lifecycle dependencies
 */
object LocationEventBroadcaster {

    const val ACTION_LOCATION_UPDATE = "com.backgroundlocation.LOCATION_UPDATE"
    const val ACTION_LOCATION_ERROR = "com.backgroundlocation.LOCATION_ERROR"
    const val ACTION_LOCATION_WARNING = "com.backgroundlocation.LOCATION_WARNING"
    const val ACTION_NOTIFICATION_ACTION = "com.backgroundlocation.NOTIFICATION_ACTION"

    const val EXTRA_TRIP_ID = "tripId"
    const val EXTRA_LOCATION_DATA = "locationData"
    const val EXTRA_ERROR_TYPE = "errorType"
    const val EXTRA_ERROR_MESSAGE = "errorMessage"
    const val EXTRA_ACTION_ID = "actionId"

    /**
     * Broadcasts a location update from the service
     */
    fun broadcastLocationUpdate(context: Context, tripId: String, locationData: Bundle) {
        val intent = Intent(ACTION_LOCATION_UPDATE).apply {
            putExtra(EXTRA_TRIP_ID, tripId)
            putExtra(EXTRA_LOCATION_DATA, locationData)
        }
        LocalBroadcastManager.getInstance(context).sendBroadcast(intent)
    }

    /**
     * Broadcasts an error from the service
     */
    fun broadcastError(context: Context, tripId: String?, errorType: String, message: String) {
        val intent = Intent(ACTION_LOCATION_ERROR).apply {
            putExtra(EXTRA_TRIP_ID, tripId)
            putExtra(EXTRA_ERROR_TYPE, errorType)
            putExtra(EXTRA_ERROR_MESSAGE, message)
        }
        LocalBroadcastManager.getInstance(context).sendBroadcast(intent)
    }

    /**
     * Broadcasts a warning from the service
     */
    fun broadcastWarning(context: Context, tripId: String?, warningType: String, message: String) {
        val intent = Intent(ACTION_LOCATION_WARNING).apply {
            putExtra(EXTRA_TRIP_ID, tripId)
            putExtra(EXTRA_ERROR_TYPE, warningType)
            putExtra(EXTRA_ERROR_MESSAGE, message)
        }
        LocalBroadcastManager.getInstance(context).sendBroadcast(intent)
    }

    /**
     * Broadcasts a notification action event from the service
     */
    fun broadcastNotificationAction(context: Context, tripId: String, actionId: String) {
        val intent = Intent(ACTION_NOTIFICATION_ACTION).apply {
            putExtra(EXTRA_TRIP_ID, tripId)
            putExtra(EXTRA_ACTION_ID, actionId)
        }
        LocalBroadcastManager.getInstance(context).sendBroadcast(intent)
    }

    /**
     * Creates an IntentFilter for all location events
     */
    fun createIntentFilter(): IntentFilter {
        return IntentFilter().apply {
            addAction(ACTION_LOCATION_UPDATE)
            addAction(ACTION_LOCATION_ERROR)
            addAction(ACTION_LOCATION_WARNING)
            addAction(ACTION_NOTIFICATION_ACTION)
        }
    }

    /**
     * Converts Location to Bundle for broadcasting
     */
    fun locationToBundle(location: Location): Bundle {
        return Bundle().apply {
            putDouble("latitude", location.latitude)
            putDouble("longitude", location.longitude)
            putLong("timestamp", location.time)
            if (location.hasAccuracy()) putFloat("accuracy", location.accuracy)
            if (location.hasAltitude()) putDouble("altitude", location.altitude)
            if (location.hasSpeed()) putFloat("speed", location.speed)
            if (location.hasBearing()) putFloat("bearing", location.bearing)
            putLong("elapsedRealtimeNanos", location.elapsedRealtimeNanos)
            location.provider?.let { putString("provider", it) }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val verticalAccuracy = location.verticalAccuracyMeters
                if (!verticalAccuracy.isNaN()) putFloat("verticalAccuracyMeters", verticalAccuracy)
                val speedAccuracy = location.speedAccuracyMetersPerSecond
                if (!speedAccuracy.isNaN()) putFloat("speedAccuracyMetersPerSecond", speedAccuracy)
                val bearingAccuracy = location.bearingAccuracyDegrees
                if (!bearingAccuracy.isNaN()) putFloat("bearingAccuracyDegrees", bearingAccuracy)
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN_MR2) {
                @Suppress("DEPRECATION")
                putBoolean("isFromMockProvider", location.isFromMockProvider)
            }
        }
    }

    /**
     * Converts Bundle back to WritableMap for React Native
     */
    fun bundleToWritableMap(tripId: String, bundle: Bundle): WritableMap {
        return Arguments.createMap().apply {
            putString("tripId", tripId)
            putString("latitude", bundle.getDouble("latitude").toString())
            putString("longitude", bundle.getDouble("longitude").toString())
            putDouble("timestamp", bundle.getLong("timestamp").toDouble())

            if (bundle.containsKey("accuracy")) putDouble("accuracy", bundle.getFloat("accuracy").toDouble())
            if (bundle.containsKey("altitude")) putDouble("altitude", bundle.getDouble("altitude"))
            if (bundle.containsKey("speed")) putDouble("speed", bundle.getFloat("speed").toDouble())
            if (bundle.containsKey("bearing")) putDouble("bearing", bundle.getFloat("bearing").toDouble())
            if (bundle.containsKey("verticalAccuracyMeters")) {
                putDouble("verticalAccuracyMeters", bundle.getFloat("verticalAccuracyMeters").toDouble())
            }
            if (bundle.containsKey("speedAccuracyMetersPerSecond")) {
                putDouble("speedAccuracyMetersPerSecond", bundle.getFloat("speedAccuracyMetersPerSecond").toDouble())
            }
            if (bundle.containsKey("bearingAccuracyDegrees")) {
                putDouble("bearingAccuracyDegrees", bundle.getFloat("bearingAccuracyDegrees").toDouble())
            }
            putDouble("elapsedRealtimeNanos", bundle.getLong("elapsedRealtimeNanos").toDouble())
            bundle.getString("provider")?.let { putString("provider", it) }
            if (bundle.containsKey("isFromMockProvider")) {
                putBoolean("isFromMockProvider", bundle.getBoolean("isFromMockProvider"))
            }
        }
    }
}
