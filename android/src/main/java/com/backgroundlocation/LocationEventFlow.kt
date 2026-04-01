package com.backgroundlocation

import android.os.Bundle
import kotlinx.coroutines.channels.BufferOverflow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow

sealed interface LocationEvent {
    data class Update(val tripId: String, val locationData: Bundle) : LocationEvent
    data class Error(val tripId: String?, val errorType: String, val message: String) : LocationEvent
    data class Warning(val tripId: String?, val warningType: String, val message: String) : LocationEvent
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
