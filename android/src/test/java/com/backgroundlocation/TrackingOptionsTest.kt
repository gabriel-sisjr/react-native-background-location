package com.backgroundlocation

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class TrackingOptionsTest {

    @Test
    fun `default values are returned when properties are null`() {
        val options = TrackingOptions()

        assertFalse(options.getActivityTrackingEnabledOrDefault())
        assertFalse(options.getPauseLocationWhenStillOrDefault())
        assertEquals(60000L, options.getActivityUpdateIntervalOrDefault())
        
        // Check other existing defaults to ensure no regression
        assertEquals(5000L, options.getUpdateIntervalOrDefault())
        assertEquals(3000L, options.getFastestIntervalOrDefault())
        assertEquals(10000L, options.getMaxWaitTimeOrDefault())
        assertFalse(options.getForegroundOnlyOrDefault())
        assertEquals(0f, options.getDistanceFilterOrDefault())
    }

    @Test
    fun `custom values are returned when properties are provided`() {
        val options = TrackingOptions(
            activityTrackingEnabled = true,
            pauseLocationWhenStill = true,
            activityUpdateInterval = 30000L,
            updateInterval = 10000L,
            distanceFilter = 50f
        )

        assertTrue(options.getActivityTrackingEnabledOrDefault())
        assertTrue(options.getPauseLocationWhenStillOrDefault())
        assertEquals(30000L, options.getActivityUpdateIntervalOrDefault())
        
        // Overridden values
        assertEquals(10000L, options.getUpdateIntervalOrDefault())
        assertEquals(50f, options.getDistanceFilterOrDefault())
    }
}
