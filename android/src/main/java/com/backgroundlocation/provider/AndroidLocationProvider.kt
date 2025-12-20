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

    override fun initialize(context: Context) {
        this.context = context
        this.locationManager = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
    }

    @SuppressLint("MissingPermission")
    override fun requestLocationUpdates(
        intervalMs: Long,
        fastestIntervalMs: Long,
        priority: Int,
        callback: LocationUpdateCallback
    ) {
        this.updateCallback = callback

        val provider = when (priority) {
            Priority.PRIORITY_HIGH_ACCURACY -> LocationManager.GPS_PROVIDER
            Priority.PRIORITY_BALANCED_POWER_ACCURACY -> LocationManager.NETWORK_PROVIDER
            else -> LocationManager.PASSIVE_PROVIDER
        }

        locationListener = object : LocationListener {
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

        try {
            locationManager?.requestLocationUpdates(
                provider,
                intervalMs,
                0f, // No minimum distance
                locationListener!!,
                Looper.getMainLooper()
            )
        } catch (e: Exception) {
            callback.onError(e)
        }
    }

    override fun removeLocationUpdates() {
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
