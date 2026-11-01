package com.backgroundlocation.provider

import android.annotation.SuppressLint
import android.content.Context
import android.location.Location
import android.os.Looper
import com.google.android.gms.common.GoogleApiAvailability
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.location.*

/**
 * Location provider using Google Play Services Fused Location
 */
class FusedLocationProvider : LocationProvider {

    private var context: Context? = null
    private var fusedLocationClient: FusedLocationProviderClient? = null
    private var locationCallback: LocationCallback? = null
    private var updateCallback: LocationUpdateCallback? = null

    // Request of the last requestLocationUpdates() call, re-applied by restoreLocationUpdates()
    private var fullRequest: LocationRequest? = null
    private var reduced = false

    override fun initialize(context: Context) {
        this.context = context
        this.fusedLocationClient = LocationServices.getFusedLocationProviderClient(context)
    }

    @SuppressLint("MissingPermission")
    override fun requestLocationUpdates(
        intervalMs: Long,
        fastestIntervalMs: Long,
        priority: Int,
        distanceFilter: Float,
        callback: LocationUpdateCallback
    ) {
        // SAFETY NET: Remove any existing callback before registering a new one.
        // Prevents duplicate callbacks if requestLocationUpdates() is called multiple times
        // (e.g., when LocationService.onStartCommand() is re-invoked via recovery path).
        if (locationCallback != null) {
            android.util.Log.d("FusedLocationProvider", "Removing existing callback before re-registration")
        }
        removeLocationUpdates()

        this.updateCallback = callback

        val locationRequest = LocationRequest.Builder(priority, intervalMs)
            .setMinUpdateIntervalMillis(fastestIntervalMs)
            .apply {
                if (distanceFilter > 0f) {
                    setMinUpdateDistanceMeters(distanceFilter)
                }
            }
            .build()

        fullRequest = locationRequest
        reduced = false
        register(locationRequest, callback)
    }

    override fun reduceLocationUpdates(profile: ReducedLocationProfile) {
        val callback = updateCallback ?: return
        if (reduced || fullRequest == null || locationCallback == null) return

        val reducedRequest = LocationRequest.Builder(profile.priority, profile.intervalMs)
            .setMinUpdateIntervalMillis(profile.fastestIntervalMs)
            .apply {
                if (profile.minDistanceM > 0f) {
                    setMinUpdateDistanceMeters(profile.minDistanceM)
                }
            }
            .build()

        unregisterCallback()
        register(reducedRequest, callback)
        reduced = true
    }

    override fun restoreLocationUpdates() {
        val callback = updateCallback ?: return
        val request = fullRequest ?: return
        if (!reduced || locationCallback == null) return

        unregisterCallback()
        register(request, callback)
        reduced = false
    }

    override fun isReduced(): Boolean = reduced

    override fun removeLocationUpdates() {
        unregisterCallback()
        fullRequest = null
        reduced = false
    }

    @SuppressLint("MissingPermission")
    private fun register(locationRequest: LocationRequest, callback: LocationUpdateCallback) {
        val newCallback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                if (result.locations.size == 1) {
                    callback.onLocationUpdate(result.locations.first())
                } else if (result.locations.isNotEmpty()) {
                    callback.onLocationBatch(result.locations)
                }
            }

            override fun onLocationAvailability(availability: LocationAvailability) {
                callback.onLocationAvailabilityChanged(availability.isLocationAvailable)
            }
        }
        locationCallback = newCallback

        fusedLocationClient?.requestLocationUpdates(
            locationRequest,
            newCallback,
            Looper.getMainLooper()
        )
    }

    private fun unregisterCallback() {
        locationCallback?.let {
            fusedLocationClient?.removeLocationUpdates(it)
        }
        locationCallback = null
    }

    @SuppressLint("MissingPermission")
    override fun getLastLocation(callback: (Location?) -> Unit) {
        fusedLocationClient?.lastLocation
            ?.addOnSuccessListener { location -> callback(location) }
            ?.addOnFailureListener { callback(null) }
    }

    override fun isAvailable(): Boolean {
        val ctx = context ?: return false
        val availability = GoogleApiAvailability.getInstance()
        return availability.isGooglePlayServicesAvailable(ctx) == ConnectionResult.SUCCESS
    }

    override fun cleanup() {
        removeLocationUpdates()
        fusedLocationClient = null
        context = null
    }
}
