package com.backgroundlocation

import kotlinx.coroutines.channels.BufferOverflow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow

sealed interface GeofenceEvent {
    data class Transition(
        val geofenceId: String,
        val transitionType: String,
        val latitude: Double,
        val longitude: Double,
        val timestamp: Long,
        val distanceFromCenter: Double,
        val metadata: String?
    ) : GeofenceEvent
}

object GeofenceEventFlow {
    private val _events = MutableSharedFlow<GeofenceEvent>(
        replay = 0,
        extraBufferCapacity = 64,
        onBufferOverflow = BufferOverflow.DROP_OLDEST
    )

    val events: SharedFlow<GeofenceEvent> = _events

    fun emit(event: GeofenceEvent): Boolean = _events.tryEmit(event)
}
