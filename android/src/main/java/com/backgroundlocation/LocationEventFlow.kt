package com.backgroundlocation

import android.os.Bundle
import kotlinx.coroutines.channels.BufferOverflow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow

sealed interface LocationEvent {
    data class Update(val tripId: String, val locationData: Bundle) : LocationEvent
    data class Error(val tripId: String?, val errorType: String, val message: String) : LocationEvent

    /** [timestamp] is taken when the warning is created (milliseconds since epoch). */
    data class Warning(
        val tripId: String?,
        val warningType: String,
        val message: String,
        val timestamp: Long = System.currentTimeMillis()
    ) : LocationEvent

    /**
     * Motion activity of a tracking session. [activity] and [confidence] carry the wire values of
     * the TypeScript `MotionActivityType` and `MotionConfidence` enums; [timestamp] is in
     * milliseconds since epoch.
     */
    data class MotionActivity(
        val tripId: String,
        val activity: String,
        val confidence: String,
        val timestamp: Long
    ) : LocationEvent
}

object LocationEventFlow {
    private val _events = MutableSharedFlow<LocationEvent>(
        replay = 0,
        extraBufferCapacity = 64,
        onBufferOverflow = BufferOverflow.DROP_OLDEST
    )

    val events: SharedFlow<LocationEvent> = _events

    fun emit(event: LocationEvent): Boolean = _events.tryEmit(event)
}
