package com.backgroundlocation.provider

import android.annotation.SuppressLint
import android.content.Context
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Bundle
import android.os.Looper
import com.google.android.gms.location.Priority

/**
 * Fallback location provider using Android LocationManager
 * For devices without Google Play Services
 */
class AndroidLocationProvider : LocationProvider {

    private var context: Context? = null
    private var locationManager: LocationManager? = null
    private var locationListener: LocationListener? = null
    private var updateCallback: LocationUpdateCallback? = null

    // Parameters of the last requestLocationUpdates() call, re-applied by restoreLocationUpdates()
    private data class FullRequest(val provider: String, val intervalMs: Long, val distanceFilter: Float)

    private var fullRequest: FullRequest? = null
    private var reduced = false

    override fun initialize(context: Context) {
        this.context = context
        this.locationManager = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
    }

    @SuppressLint("MissingPermission")
    override fun requestLocationUpdates(
        intervalMs: Long,
        fastestIntervalMs: Long,
        priority: Int,
        distanceFilter: Float,
        callback: LocationUpdateCallback
    ) {
        // SAFETY NET: Remove any existing listener before registering a new one.
        // Mirrors FusedLocationProvider safety net for provider-level deduplication.
        if (locationListener != null) {
            android.util.Log.d("AndroidLocationProvider", "Removing existing listener before re-registration")
        }
        removeLocationUpdates()

        this.updateCallback = callback

        val request = FullRequest(providerFor(priority), intervalMs, distanceFilter)
        fullRequest = request
        reduced = false
        register(request.provider, request.intervalMs, request.distanceFilter, callback)
    }

    override fun reduceLocationUpdates(profile: ReducedLocationProfile) {
        val callback = updateCallback ?: return
        if (reduced || fullRequest == null || locationListener == null) return

        unregisterListener()
        // Existing priority mapping: PRIORITY_LOW_POWER becomes PASSIVE_PROVIDER
        register(providerFor(profile.priority), profile.intervalMs, profile.minDistanceM, callback)
        reduced = true
    }

    override fun restoreLocationUpdates() {
        val callback = updateCallback ?: return
        val request = fullRequest ?: return
        if (!reduced || locationListener == null) return

        unregisterListener()
        register(request.provider, request.intervalMs, request.distanceFilter, callback)
        reduced = false
    }

    override fun isReduced(): Boolean = reduced

    private fun providerFor(priority: Int): String = when (priority) {
        Priority.PRIORITY_HIGH_ACCURACY -> LocationManager.GPS_PROVIDER
        Priority.PRIORITY_BALANCED_POWER_ACCURACY -> LocationManager.NETWORK_PROVIDER
        else -> LocationManager.PASSIVE_PROVIDER
    }

    @SuppressLint("MissingPermission")
    private fun register(
        provider: String,
        intervalMs: Long,
        distanceFilter: Float,
        callback: LocationUpdateCallback
    ) {
        val newListener = object : LocationListener {
            override fun onLocationChanged(location: Location) {
                callback.onLocationUpdate(location)
            }

            override fun onProviderEnabled(provider: String) {
                callback.onLocationAvailabilityChanged(true)
            }

            override fun onProviderDisabled(provider: String) {
                callback.onLocationAvailabilityChanged(false)
            }

            @Deprecated("Deprecated in API 29")
            override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {
                // Deprecated but required for older APIs
            }
        }
        locationListener = newListener

        try {
            locationManager?.requestLocationUpdates(
                provider,
                intervalMs,
                distanceFilter,
                newListener,
                Looper.getMainLooper()
            )
        } catch (e: Exception) {
            callback.onError(e)
        }
    }

    override fun removeLocationUpdates() {
        unregisterListener()
        fullRequest = null
        reduced = false
    }

    private fun unregisterListener() {
        locationListener?.let {
            locationManager?.removeUpdates(it)
        }
        locationListener = null
    }

    @SuppressLint("MissingPermission")
    override fun getLastLocation(callback: (Location?) -> Unit) {
        val location = locationManager?.getLastKnownLocation(LocationManager.GPS_PROVIDER)
            ?: locationManager?.getLastKnownLocation(LocationManager.NETWORK_PROVIDER)
        callback(location)
    }

    override fun isAvailable(): Boolean {
        return locationManager?.isProviderEnabled(LocationManager.GPS_PROVIDER) == true ||
               locationManager?.isProviderEnabled(LocationManager.NETWORK_PROVIDER) == true
    }

    override fun cleanup() {
        removeLocationUpdates()
        locationManager = null
        context = null
    }
}
