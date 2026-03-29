package com.backgroundlocation

import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import androidx.localbroadcastmanager.content.LocalBroadcastManager
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/**
 * Handles communication of geofence transition events between native and React Native module
 * Uses LocalBroadcastManager to decouple lifecycle dependencies
 */
object GeofenceEventBroadcaster {

    const val ACTION_GEOFENCE_TRANSITION = "com.backgroundlocation.GEOFENCE_TRANSITION"

    const val EXTRA_GEOFENCE_ID = "geofenceId"
    const val EXTRA_TRANSITION_TYPE = "transitionType"
    const val EXTRA_LATITUDE = "latitude"
    const val EXTRA_LONGITUDE = "longitude"
    const val EXTRA_TIMESTAMP = "timestamp"
    const val EXTRA_DISTANCE_FROM_CENTER = "distanceFromCenter"
    const val EXTRA_METADATA = "metadata"

    private val isoFormatter: SimpleDateFormat
        get() = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }

    /**
     * Broadcasts a geofence transition event from native to the module
     */
    fun broadcastTransition(
        context: Context,
        geofenceId: String,
        transitionType: String,
        latitude: Double,
        longitude: Double,
        timestamp: Long,
        distanceFromCenter: Double,
        metadata: String?
    ) {
        val intent = Intent(ACTION_GEOFENCE_TRANSITION).apply {
            putExtra(EXTRA_GEOFENCE_ID, geofenceId)
            putExtra(EXTRA_TRANSITION_TYPE, transitionType)
            putExtra(EXTRA_LATITUDE, latitude)
            putExtra(EXTRA_LONGITUDE, longitude)
            putExtra(EXTRA_TIMESTAMP, timestamp)
            putExtra(EXTRA_DISTANCE_FROM_CENTER, distanceFromCenter)
            metadata?.let { putExtra(EXTRA_METADATA, it) }
        }
        LocalBroadcastManager.getInstance(context).sendBroadcast(intent)
    }

    /**
     * Creates an IntentFilter for geofence transition events
     */
    fun createIntentFilter(): IntentFilter {
        return IntentFilter(ACTION_GEOFENCE_TRANSITION)
    }

    /**
     * Converts a geofence transition Intent to a WritableMap for React Native
     */
    fun intentToWritableMap(intent: Intent): WritableMap {
        val timestamp = intent.getLongExtra(EXTRA_TIMESTAMP, 0)

        return Arguments.createMap().apply {
            putString("geofenceId", intent.getStringExtra(EXTRA_GEOFENCE_ID))
            putString("transitionType", intent.getStringExtra(EXTRA_TRANSITION_TYPE))
            putDouble("latitude", intent.getDoubleExtra(EXTRA_LATITUDE, 0.0))
            putDouble("longitude", intent.getDoubleExtra(EXTRA_LONGITUDE, 0.0))
            putString("timestamp", isoFormatter.format(Date(timestamp)))
            putDouble("distanceFromCenter", intent.getDoubleExtra(EXTRA_DISTANCE_FROM_CENTER, 0.0))

            intent.getStringExtra(EXTRA_METADATA)?.let { metadataJson ->
                try {
                    val jsonObj = JSONObject(metadataJson)
                    val metadataMap = Arguments.createMap()
                    val keys = jsonObj.keys()
                    while (keys.hasNext()) {
                        val key = keys.next()
                        when (val value = jsonObj.get(key)) {
                            is String -> metadataMap.putString(key, value)
                            is Int -> metadataMap.putInt(key, value)
                            is Double -> metadataMap.putDouble(key, value)
                            is Boolean -> metadataMap.putBoolean(key, value)
                            else -> metadataMap.putString(key, value.toString())
                        }
                    }
                    putMap("metadata", metadataMap)
                } catch (_: Exception) {
                    // If parsing fails, skip metadata
                }
            }
        }
    }
}
