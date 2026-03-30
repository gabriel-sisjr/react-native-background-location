package com.backgroundlocation

import android.location.Location
import android.os.Build
import android.os.Bundle
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap

/**
 * Handles communication between LocationService and React Native module
 * Emits events via SharedFlow (LocationEventFlow) to decouple lifecycle dependencies
 */
object LocationEventBroadcaster {

    /**
     * Emits a location update event via SharedFlow
     */
    fun broadcastLocationUpdate(tripId: String, locationData: Bundle) {
        LocationEventFlow.emit(LocationEvent.Update(tripId = tripId, locationData = locationData))
    }

    /**
     * Emits an error event via SharedFlow
     */
    fun broadcastError(tripId: String?, errorType: String, message: String) {
        LocationEventFlow.emit(LocationEvent.Error(tripId = tripId, errorType = errorType, message = message))
    }

    /**
     * Emits a warning event via SharedFlow
     */
    fun broadcastWarning(tripId: String?, warningType: String, message: String) {
        LocationEventFlow.emit(LocationEvent.Warning(tripId = tripId, warningType = warningType, message = message))
    }

    /**
     * Converts Location to Bundle for event emission
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

            putBoolean("isFromMockProvider", location.isMockLocation())
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
