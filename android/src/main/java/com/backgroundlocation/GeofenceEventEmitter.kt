package com.backgroundlocation

/**
 * Handles communication of geofence transition events between native and React Native module
 * Emits events via SharedFlow (GeofenceEventFlow) to decouple lifecycle dependencies
 */
object GeofenceEventEmitter {

    /**
     * Emits a geofence transition event via SharedFlow
     */
    fun emitTransition(
        geofenceId: String,
        transitionType: String,
        latitude: Double,
        longitude: Double,
        timestamp: Long,
        distanceFromCenter: Double,
        metadata: String?
    ) {
        GeofenceEventFlow.emit(
            GeofenceEvent.Transition(
                geofenceId = geofenceId,
                transitionType = transitionType,
                latitude = latitude,
                longitude = longitude,
                timestamp = timestamp,
                distanceFromCenter = distanceFromCenter,
                metadata = metadata
            )
        )
    }
}
