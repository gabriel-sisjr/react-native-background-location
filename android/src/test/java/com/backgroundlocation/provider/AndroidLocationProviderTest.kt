package com.backgroundlocation.provider

import android.content.Context
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Looper
import com.google.android.gms.location.Priority
import io.mockk.Runs
import io.mockk.every
import io.mockk.just
import io.mockk.mockk
import io.mockk.mockkStatic
import io.mockk.slot
import io.mockk.unmockkAll
import io.mockk.verify
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test

class AndroidLocationProviderTest {

    private lateinit var provider: AndroidLocationProvider
    private lateinit var locationManager: LocationManager
    private lateinit var context: Context
    private lateinit var updateCallback: LocationUpdateCallback

    // Captures the LocationListener passed to the location manager
    private val listenerSlot = slot<LocationListener>()

    @Before
    fun setUp() {
        locationManager = mockk(relaxed = true)
        context = mockk(relaxed = true)
        updateCallback = mockk(relaxed = true)

        every { context.getSystemService(Context.LOCATION_SERVICE) } returns locationManager

        // Mock Looper.getMainLooper() since we are in a local JVM test
        mockkStatic(Looper::class)
        every { Looper.getMainLooper() } returns mockk()

        // Stub requestLocationUpdates to capture the listener
        every {
            locationManager.requestLocationUpdates(
                any<String>(),
                any<Long>(),
                any<Float>(),
                capture(listenerSlot),
                any<Looper>()
            )
        } just Runs

        // Stub removeUpdates(LocationListener)
        every { locationManager.removeUpdates(any<LocationListener>()) } just Runs

        provider = AndroidLocationProvider()
        provider.initialize(context)
    }

    @After
    fun tearDown() {
        unmockkAll()
    }

    @Test
    fun `single request registers one listener and delivers location events`() {
        provider.requestLocationUpdates(
            intervalMs = 5000L,
            fastestIntervalMs = 3000L,
            priority = Priority.PRIORITY_HIGH_ACCURACY,
            distanceFilter = 0f,
            callback = updateCallback
        )

        // Verify requestLocationUpdates was called exactly once on the location manager
        verify(exactly = 1) {
            locationManager.requestLocationUpdates(
                any<String>(),
                any<Long>(),
                any<Float>(),
                any<LocationListener>(),
                any<Looper>()
            )
        }

        // Simulate a location update through the captured listener
        val location = mockk<Location>(relaxed = true)
        every { location.latitude } returns -23.55052
        every { location.longitude } returns -46.63331

        listenerSlot.captured.onLocationChanged(location)

        // Verify the update callback received the location
        verify(exactly = 1) { updateCallback.onLocationUpdate(location) }
    }

    @Test
    fun `consecutive requests remove previous listener before registering new one`() {
        // First request
        provider.requestLocationUpdates(
            intervalMs = 5000L,
            fastestIntervalMs = 3000L,
            priority = Priority.PRIORITY_HIGH_ACCURACY,
            distanceFilter = 0f,
            callback = updateCallback
        )

        val firstListener = listenerSlot.captured

        // Second request - should remove the first listener before registering
        provider.requestLocationUpdates(
            intervalMs = 10000L,
            fastestIntervalMs = 5000L,
            priority = Priority.PRIORITY_BALANCED_POWER_ACCURACY,
            distanceFilter = 10f,
            callback = updateCallback
        )

        // Verify the first listener was removed before the second registration
        verify(exactly = 1) { locationManager.removeUpdates(firstListener) }

        // Verify requestLocationUpdates was called twice total
        verify(exactly = 2) {
            locationManager.requestLocationUpdates(
                any<String>(),
                any<Long>(),
                any<Float>(),
                any<LocationListener>(),
                any<Looper>()
            )
        }

        // Simulate location through the second (current) listener
        val secondListener = listenerSlot.captured
        val location = mockk<Location>(relaxed = true)

        secondListener.onLocationChanged(location)

        // Only one call to onLocationUpdate - from the second listener
        verify(exactly = 1) { updateCallback.onLocationUpdate(location) }

        // The old and new listeners must be different instances
        assert(firstListener !== secondListener) {
            "Second request must create a new LocationListener instance"
        }
    }

    @Test
    fun `N consecutive requests leave only last listener - removeUpdates called N-1 times`() {
        val capturedListeners = mutableListOf<LocationListener>()

        // Override to capture all listeners sequentially
        every {
            locationManager.requestLocationUpdates(
                any<String>(),
                any<Long>(),
                any<Float>(),
                capture(listenerSlot),
                any<Looper>()
            )
        } answers {
            capturedListeners.add(listenerSlot.captured)
        }

        val n = 3
        repeat(n) {
            provider.requestLocationUpdates(
                intervalMs = 5000L,
                fastestIntervalMs = 3000L,
                priority = Priority.PRIORITY_HIGH_ACCURACY,
                distanceFilter = 0f,
                callback = updateCallback
            )
        }

        // requestLocationUpdates called N times
        verify(exactly = n) {
            locationManager.requestLocationUpdates(
                any<String>(),
                any<Long>(),
                any<Float>(),
                any<LocationListener>(),
                any<Looper>()
            )
        }

        // removeUpdates called N-1 times (first call has null listener, guarded by ?.let)
        verify(exactly = n - 1) {
            locationManager.removeUpdates(any<LocationListener>())
        }

        // Verify each prior listener was removed individually
        assertEquals(n, capturedListeners.size)
        for (i in 0 until n - 1) {
            verify(exactly = 1) { locationManager.removeUpdates(capturedListeners[i]) }
        }
    }

    @Test
    fun `first request with no prior listener is null-safe - no crash`() {
        // On a fresh provider, locationListener is null. The safety net calls
        // removeLocationUpdates() which does `locationListener?.let { ... }` - a no-op.
        // This must not throw any exception.
        provider.requestLocationUpdates(
            intervalMs = 5000L,
            fastestIntervalMs = 3000L,
            priority = Priority.PRIORITY_HIGH_ACCURACY,
            distanceFilter = 0f,
            callback = updateCallback
        )

        // removeUpdates on the location manager should NOT have been called
        // because locationListener was null (the ?.let guard prevented it)
        verify(exactly = 0) {
            locationManager.removeUpdates(any<LocationListener>())
        }

        // But requestLocationUpdates should have been called successfully
        verify(exactly = 1) {
            locationManager.requestLocationUpdates(
                any<String>(),
                any<Long>(),
                any<Float>(),
                any<LocationListener>(),
                any<Looper>()
            )
        }
    }

    @Test
    fun `explicit stop removes listener and prevents further location delivery`() {
        // Register a listener first
        provider.requestLocationUpdates(
            intervalMs = 5000L,
            fastestIntervalMs = 3000L,
            priority = Priority.PRIORITY_HIGH_ACCURACY,
            distanceFilter = 0f,
            callback = updateCallback
        )

        val activeListener = listenerSlot.captured

        // Explicitly stop
        provider.removeLocationUpdates()

        // Verify the listener was removed from the location manager
        verify(exactly = 1) { locationManager.removeUpdates(activeListener) }

        // After removeLocationUpdates(), the provider's internal locationListener is null.
        // Calling removeLocationUpdates again should be a no-op (no second remove call).
        provider.removeLocationUpdates()
        verify(exactly = 1) { locationManager.removeUpdates(any<LocationListener>()) }
    }
}
