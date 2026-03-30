package com.backgroundlocation

import app.cash.turbine.test
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class GeofenceEventFlowTest {

    @Test
    fun `emit Transition with all fields including metadata`() = runTest {
        val event = GeofenceEvent.Transition(
            geofenceId = "geo-001",
            transitionType = "ENTER",
            latitude = -23.550520,
            longitude = -46.633308,
            timestamp = 1711800000000L,
            distanceFromCenter = 42.5,
            metadata = """{"zone":"restricted","level":3}"""
        )

        GeofenceEventFlow.events.test {
            GeofenceEventFlow.emit(event)

            val received = awaitItem()
            assertTrue(received is GeofenceEvent.Transition)
            val transition = received as GeofenceEvent.Transition
            assertEquals("geo-001", transition.geofenceId)
            assertEquals("ENTER", transition.transitionType)
            assertEquals(-23.550520, transition.latitude, 0.0)
            assertEquals(-46.633308, transition.longitude, 0.0)
            assertEquals(1711800000000L, transition.timestamp)
            assertEquals(42.5, transition.distanceFromCenter, 0.0)
            assertEquals("""{"zone":"restricted","level":3}""", transition.metadata)

            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun `emit Transition with null metadata`() = runTest {
        val event = GeofenceEvent.Transition(
            geofenceId = "geo-002",
            transitionType = "EXIT",
            latitude = 40.712776,
            longitude = -74.005974,
            timestamp = 1711800060000L,
            distanceFromCenter = 150.0,
            metadata = null
        )

        GeofenceEventFlow.events.test {
            GeofenceEventFlow.emit(event)

            val received = awaitItem()
            assertTrue(received is GeofenceEvent.Transition)
            val transition = received as GeofenceEvent.Transition
            assertEquals("geo-002", transition.geofenceId)
            assertNull("metadata should be null", transition.metadata)

            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun `payload integrity - Double precision for lat lng and Long for timestamp`() = runTest {
        // Use high-precision coordinates to verify Double precision is preserved
        val preciseLat = -23.55052012345678
        val preciseLng = -46.63330887654321
        val preciseTimestamp = 1711800000123L

        val event = GeofenceEvent.Transition(
            geofenceId = "geo-precision",
            transitionType = "DWELL",
            latitude = preciseLat,
            longitude = preciseLng,
            timestamp = preciseTimestamp,
            distanceFromCenter = 0.001,
            metadata = null
        )

        GeofenceEventFlow.events.test {
            GeofenceEventFlow.emit(event)

            val received = awaitItem() as GeofenceEvent.Transition
            assertEquals(
                "Double precision must be preserved for latitude",
                preciseLat,
                received.latitude,
                0.0
            )
            assertEquals(
                "Double precision must be preserved for longitude",
                preciseLng,
                received.longitude,
                0.0
            )
            assertEquals(
                "Long timestamp must be preserved exactly",
                preciseTimestamp,
                received.timestamp
            )

            cancelAndIgnoreRemainingEvents()
        }
    }
}
