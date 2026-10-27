package com.backgroundlocation.provider

import android.content.Context
import android.location.Location

/**
 * Abstract interface for location providers
 * Allows swapping between Fused (Google) and Android LocationManager
 */
interface LocationProvider {

    /**
     * Initialize the provider with context
     */
    fun initialize(context: Context)

    /**
     * Request location updates with given parameters
     */
    fun requestLocationUpdates(
        intervalMs: Long,
        fastestIntervalMs: Long,
        priority: Int,
        distanceFilter: Float,
        callback: LocationUpdateCallback
    )

    /**
     * Stop location updates
     */
    fun removeLocationUpdates()

    /**
     * Switches the active request to [profile] (a reduction, never a stop) and keeps the
     * same callback. No-op without an active request or while already reduced.
     */
    fun reduceLocationUpdates(profile: ReducedLocationProfile)

    /**
     * Re-applies the parameters of the last [requestLocationUpdates] call.
     * No-op unless the request is currently reduced.
     */
    fun restoreLocationUpdates()

    /**
     * True while the active request runs with a [ReducedLocationProfile]
     */
    fun isReduced(): Boolean

    /**
     * Get last known location (may be null)
     */
    fun getLastLocation(callback: (Location?) -> Unit)

    /**
     * Check if this provider is available on the device
     */
    fun isAvailable(): Boolean

    /**
     * Cleanup resources
     */
    fun cleanup()
}

/**
 * Callback interface for location updates
 */
interface LocationUpdateCallback {
    fun onLocationUpdate(location: Location)
    fun onLocationBatch(locations: List<Location>)
    fun onLocationAvailabilityChanged(available: Boolean)
    fun onError(error: Exception)
}
