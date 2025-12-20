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

    override fun initialize(context: Context) {
        this.context = context
        this.fusedLocationClient = LocationServices.getFusedLocationProviderClient(context)
    }

    @SuppressLint("MissingPermission")
    override fun requestLocationUpdates(
        intervalMs: Long,
        fastestIntervalMs: Long,
        priority: Int,
        callback: LocationUpdateCallback
    ) {
        this.updateCallback = callback

        val locationRequest = LocationRequest.Builder(priority, intervalMs)
            .setMinUpdateIntervalMillis(fastestIntervalMs)
            .build()

        locationCallback = object : LocationCallback() {
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

        fusedLocationClient?.requestLocationUpdates(
            locationRequest,
            locationCallback!!,
            Looper.getMainLooper()
        )
    }

    override fun removeLocationUpdates() {
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
