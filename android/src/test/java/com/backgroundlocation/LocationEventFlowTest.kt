package com.backgroundlocation

import android.os.Bundle
import app.cash.turbine.test
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class LocationEventFlowTest {

    @Test
    fun `emit Update event and verify fields`() = runTest {
        val bundle = Bundle()
        val event = LocationEvent.Update(tripId = "trip-001", locationData = bundle)

        LocationEventFlow.events.test {
            LocationEventFlow.emit(event)

            val received = awaitItem()
            assertTrue(received is LocationEvent.Update)
            val update = received as LocationEvent.Update
            assertEquals("trip-001", update.tripId)
            assertEquals(bundle, update.locationData)

            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun `emit Error event and verify fields`() = runTest {
        val event = LocationEvent.Error(
            tripId = "trip-err",
            errorType = "GPS_FAILURE",
            message = "GPS signal lost"
        )

        LocationEventFlow.events.test {
            LocationEventFlow.emit(event)

            val received = awaitItem()
            assertTrue(received is LocationEvent.Error)
            val error = received as LocationEvent.Error
            assertEquals("trip-err", error.tripId)
            assertEquals("GPS_FAILURE", error.errorType)
            assertEquals("GPS signal lost", error.message)

            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun `emit Warning event and verify fields`() = runTest {
        val event = LocationEvent.Warning(
            tripId = null,
            warningType = "LOW_BATTERY",
            message = "Battery below 15%"
        )

        LocationEventFlow.events.test {
            LocationEventFlow.emit(event)

            val received = awaitItem()
            assertTrue(received is LocationEvent.Warning)
            val warning = received as LocationEvent.Warning
            assertEquals(null, warning.tripId)
            assertEquals("LOW_BATTERY", warning.warningType)
            assertEquals("Battery below 15%", warning.message)

            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun `emit all 3 event types sequentially and collect in order`() = runTest {
        val bundle = Bundle()
        val updateEvent = LocationEvent.Update(tripId = "trip-seq", locationData = bundle)
        val errorEvent = LocationEvent.Error(tripId = "trip-seq", errorType = "TIMEOUT", message = "Timed out")
        val warningEvent = LocationEvent.Warning(tripId = "trip-seq", warningType = "DRIFT", message = "Location drift detected")

        LocationEventFlow.events.test {
            LocationEventFlow.emit(updateEvent)
            LocationEventFlow.emit(errorEvent)
            LocationEventFlow.emit(warningEvent)

            val first = awaitItem()
            assertTrue("Expected Update, got $first", first is LocationEvent.Update)
            assertEquals("trip-seq", (first as LocationEvent.Update).tripId)

            val second = awaitItem()
            assertTrue("Expected Error, got $second", second is LocationEvent.Error)
            assertEquals("TIMEOUT", (second as LocationEvent.Error).errorType)

            val third = awaitItem()
            assertTrue("Expected Warning, got $third", third is LocationEvent.Warning)
            assertEquals("DRIFT", (third as LocationEvent.Warning).warningType)

            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun `buffer overflow with DROP_OLDEST - emit returns true`() = runTest {
        // Buffer capacity is 64 (extraBufferCapacity). With no active collector,
        // events fill the buffer and overflow via DROP_OLDEST.
        // tryEmit() should still return true because DROP_OLDEST discards the oldest item.
        val results = (1..70).map { i ->
            LocationEventFlow.emit(
                LocationEvent.Update(tripId = "trip-overflow-$i", locationData = Bundle())
            )
        }

        assertTrue("All 70 emit() calls should return true with DROP_OLDEST", results.all { it })
    }

    @Test
    fun `no replay - late subscriber receives no historical events`() = runTest {
        // Emit events before any subscriber exists
        LocationEventFlow.emit(LocationEvent.Update(tripId = "trip-old", locationData = Bundle()))
        LocationEventFlow.emit(LocationEvent.Error(tripId = null, errorType = "OLD_ERR", message = "old"))

        // Now subscribe - should NOT receive the events above (replay = 0)
        LocationEventFlow.events.test {
            // Emit a new event to confirm the subscriber is active
            LocationEventFlow.emit(LocationEvent.Warning(tripId = "trip-new", warningType = "NEW", message = "new"))

            val received = awaitItem()
            assertTrue("Expected Warning (new), got $received", received is LocationEvent.Warning)
            assertEquals("trip-new", (received as LocationEvent.Warning).tripId)

            cancelAndIgnoreRemainingEvents()
        }
    }
}
