package com.backgroundlocation

import app.cash.turbine.test
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class NotificationActionFlowTest {

    @Test
    fun `emit ActionClicked and verify tripId and actionId`() = runTest {
        val event = NotificationActionEvent.ActionClicked(
            tripId = "trip-notify-001",
            actionId = "stop_tracking"
        )

        NotificationActionFlow.events.test {
            NotificationActionFlow.emit(event)

            val received = awaitItem()
            assertTrue(received is NotificationActionEvent.ActionClicked)
            val action = received as NotificationActionEvent.ActionClicked
            assertEquals("trip-notify-001", action.tripId)
            assertEquals("stop_tracking", action.actionId)

            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun `non-suspending tryEmit returns true`() = runTest {
        // emit() delegates to tryEmit() which is non-suspending.
        // With buffer capacity of 64 and DROP_OLDEST, it should always return true.
        val result = NotificationActionFlow.emit(
            NotificationActionEvent.ActionClicked(
                tripId = "trip-sync",
                actionId = "pause"
            )
        )

        assertTrue("emit() should return true (non-suspending tryEmit with buffer)", result)
    }

    @Test
    fun `multiple rapid emissions collected in order`() = runTest {
        val events = listOf(
            NotificationActionEvent.ActionClicked(tripId = "trip-rapid", actionId = "action-1"),
            NotificationActionEvent.ActionClicked(tripId = "trip-rapid", actionId = "action-2"),
            NotificationActionEvent.ActionClicked(tripId = "trip-rapid", actionId = "action-3"),
            NotificationActionEvent.ActionClicked(tripId = "trip-rapid", actionId = "action-4"),
            NotificationActionEvent.ActionClicked(tripId = "trip-rapid", actionId = "action-5")
        )

        NotificationActionFlow.events.test {
            events.forEach { NotificationActionFlow.emit(it) }

            events.forEachIndexed { index, expected ->
                val received = awaitItem()
                assertTrue(
                    "Event $index should be ActionClicked",
                    received is NotificationActionEvent.ActionClicked
                )
                val action = received as NotificationActionEvent.ActionClicked
                assertEquals(
                    "Event $index actionId mismatch",
                    expected.actionId,
                    action.actionId
                )
                assertEquals(
                    "Event $index tripId mismatch",
                    expected.tripId,
                    action.tripId
                )
            }

            cancelAndIgnoreRemainingEvents()
        }
    }
}
