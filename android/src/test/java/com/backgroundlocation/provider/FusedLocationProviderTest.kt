package com.backgroundlocation.provider

import android.content.Context
import android.location.Location
import android.os.Looper
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.Task
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

class FusedLocationProviderTest {

    private lateinit var provider: FusedLocationProvider
    private lateinit var fusedClient: FusedLocationProviderClient
    private lateinit var context: Context
    private lateinit var updateCallback: LocationUpdateCallback

    // Captures the LocationCallback passed to the fused client
    private val callbackSlot = slot<LocationCallback>()

    @Before
    fun setUp() {
        context = mockk(relaxed = true)
        fusedClient = mockk(relaxed = true)
        updateCallback = mockk(relaxed = true)

        // Mock LocationServices.getFusedLocationProviderClient to return our mock client
        mockkStatic(LocationServices::class)
        every { LocationServices.getFusedLocationProviderClient(any<Context>()) } returns fusedClient

        // Mock Looper.getMainLooper() since we are in a local JVM test
        mockkStatic(Looper::class)
        every { Looper.getMainLooper() } returns mockk()

        // Stub requestLocationUpdates to capture the callback
        every {
            fusedClient.requestLocationUpdates(
                any<LocationRequest>(),
                capture(callbackSlot),
                any<Looper>()
            )
        } returns mockk<Task<Void>>(relaxed = true)

        // Stub removeLocationUpdates(LocationCallback)
        every { fusedClient.removeLocationUpdates(any<LocationCallback>()) } returns mockk<Task<Void>>(relaxed = true)

        provider = FusedLocationProvider()
        provider.initialize(context)
    }

    @After
    fun tearDown() {
        unmockkAll()
    }

    @Test
    fun `single request registers one callback and delivers location events`() {
        provider.requestLocationUpdates(
            intervalMs = 5000L,
            fastestIntervalMs = 3000L,
            priority = Priority.PRIORITY_HIGH_ACCURACY,
            distanceFilter = 0f,
            callback = updateCallback
        )

        // Verify requestLocationUpdates was called exactly once on the fused client
        verify(exactly = 1) {
            fusedClient.requestLocationUpdates(
                any<LocationRequest>(),
                any<LocationCallback>(),
                any<Looper>()
            )
        }

        // Simulate a location result through the captured callback
        val location = mockk<Location>(relaxed = true)
        every { location.latitude } returns -23.55052
        every { location.longitude } returns -46.63331

        val locationResult = mockk<LocationResult>()
        every { locationResult.locations } returns listOf(location)

        callbackSlot.captured.onLocationResult(locationResult)

        // Verify the update callback received the location
        verify(exactly = 1) { updateCallback.onLocationUpdate(location) }
    }

    @Test
    fun `consecutive requests remove previous callback before registering new one`() {
        // First request
        provider.requestLocationUpdates(
            intervalMs = 5000L,
            fastestIntervalMs = 3000L,
            priority = Priority.PRIORITY_HIGH_ACCURACY,
            distanceFilter = 0f,
            callback = updateCallback
        )

        val firstCallback = callbackSlot.captured

        // Second request - should remove the first callback before registering
        provider.requestLocationUpdates(
            intervalMs = 10000L,
            fastestIntervalMs = 5000L,
            priority = Priority.PRIORITY_BALANCED_POWER_ACCURACY,
            distanceFilter = 10f,
            callback = updateCallback
        )

        // Verify the first callback was removed before the second registration
        verify(exactly = 1) { fusedClient.removeLocationUpdates(firstCallback) }

        // Verify requestLocationUpdates was called twice total (once per request)
        verify(exactly = 2) {
            fusedClient.requestLocationUpdates(
                any<LocationRequest>(),
                any<LocationCallback>(),
                any<Looper>()
            )
        }

        // Simulate location through the second (current) callback
        val secondCallback = callbackSlot.captured
        val location = mockk<Location>(relaxed = true)
        val locationResult = mockk<LocationResult>()
        every { locationResult.locations } returns listOf(location)

        secondCallback.onLocationResult(locationResult)

        // Only the second callback should deliver events - one call total
        verify(exactly = 1) { updateCallback.onLocationUpdate(location) }

        // The old first callback should NOT deliver events (it was removed)
        // Simulate calling the old callback - since it was removed from the fused client,
        // in real usage it would never fire, but we verify the provider replaced it
        assert(firstCallback !== secondCallback) {
            "Second request must create a new LocationCallback instance"
        }
    }

    @Test
    fun `N consecutive requests leave only last callback - remove called N-1 times`() {
        val capturedCallbacks = mutableListOf<LocationCallback>()

        // Override to capture all callbacks sequentially
        every {
            fusedClient.requestLocationUpdates(
                any<LocationRequest>(),
                capture(callbackSlot),
                any<Looper>()
            )
        } answers {
            capturedCallbacks.add(callbackSlot.captured)
            mockk<Task<Void>>(relaxed = true)
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
            fusedClient.requestLocationUpdates(
                any<LocationRequest>(),
                any<LocationCallback>(),
                any<Looper>()
            )
        }

        // removeLocationUpdates called N-1 times for the previously active callbacks
        // Plus N calls from the safety net (each requestLocationUpdates calls removeLocationUpdates
        // at the start, including the first one where locationCallback is null and it's a no-op).
        // However, the first call has locationCallback == null, so fusedClient.removeLocationUpdates
        // is NOT called (guarded by locationCallback?.let). So N-1 actual remove calls.
        verify(exactly = n - 1) {
            fusedClient.removeLocationUpdates(any<LocationCallback>())
        }

        // Verify each prior callback was removed: callbacks 0 and 1 (not the last one)
        assertEquals(n, capturedCallbacks.size)
        for (i in 0 until n - 1) {
            verify(exactly = 1) { fusedClient.removeLocationUpdates(capturedCallbacks[i]) }
        }
    }

    @Test
    fun `first request with no prior callback is null-safe - no crash`() {
        // On a fresh provider, locationCallback is null. The safety net calls
        // removeLocationUpdates() which does `locationCallback?.let { ... }` - a no-op.
        // This must not throw any exception.
        provider.requestLocationUpdates(
            intervalMs = 5000L,
            fastestIntervalMs = 3000L,
            priority = Priority.PRIORITY_HIGH_ACCURACY,
            distanceFilter = 0f,
            callback = updateCallback
        )

        // removeLocationUpdates on the fused client should NOT have been called
        // because locationCallback was null (the ?.let guard prevented it)
        verify(exactly = 0) {
            fusedClient.removeLocationUpdates(any<LocationCallback>())
        }

        // But requestLocationUpdates should have been called successfully
        verify(exactly = 1) {
            fusedClient.requestLocationUpdates(
                any<LocationRequest>(),
                any<LocationCallback>(),
                any<Looper>()
            )
        }
    }

    @Test
    fun `explicit stop removes callback and prevents further location delivery`() {
        // Register a callback first
        provider.requestLocationUpdates(
            intervalMs = 5000L,
            fastestIntervalMs = 3000L,
            priority = Priority.PRIORITY_HIGH_ACCURACY,
            distanceFilter = 0f,
            callback = updateCallback
        )

        val activeCallback = callbackSlot.captured

        // Explicitly stop
        provider.removeLocationUpdates()

        // Verify the callback was removed from the fused client
        verify(exactly = 1) { fusedClient.removeLocationUpdates(activeCallback) }

        // Simulate a location arriving on the old callback reference (should not happen in
        // production since the fused client unregistered it, but verifies internal state).
        // After removeLocationUpdates(), the provider's internal locationCallback is null.
        // A subsequent requestLocationUpdates would create a fresh callback.
        // We verify by calling removeLocationUpdates again - it should be a no-op (no second remove call).
        provider.removeLocationUpdates()
        verify(exactly = 1) { fusedClient.removeLocationUpdates(any<LocationCallback>()) }
    }
}
