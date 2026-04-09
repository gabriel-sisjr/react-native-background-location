package com.backgroundlocation

import kotlinx.coroutines.channels.BufferOverflow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow

sealed interface NotificationActionEvent {
    data class ActionClicked(val tripId: String, val actionId: String) : NotificationActionEvent
}

object NotificationActionFlow {
    private val _events = MutableSharedFlow<NotificationActionEvent>(
        replay = 0,
        extraBufferCapacity = 64,
        onBufferOverflow = BufferOverflow.DROP_OLDEST
    )

    val events: SharedFlow<NotificationActionEvent> = _events

    fun emit(event: NotificationActionEvent): Boolean = _events.tryEmit(event)
}
