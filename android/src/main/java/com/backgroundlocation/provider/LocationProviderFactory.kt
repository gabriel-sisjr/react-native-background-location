package com.backgroundlocation.provider

import android.content.Context

/**
 * Factory for creating appropriate location provider
 */
object LocationProviderFactory {

    /**
     * Creates the best available location provider for this device
     */
    fun create(context: Context): LocationProvider {
        val fusedProvider = FusedLocationProvider()
        fusedProvider.initialize(context)

        if (fusedProvider.isAvailable()) {
            android.util.Log.d("LocationProviderFactory", "Using Fused Location Provider (Google Play Services)")
            return fusedProvider
        }

        // Fallback to Android LocationManager
        android.util.Log.d("LocationProviderFactory", "Google Play Services unavailable, using Android LocationManager")
        val androidProvider = AndroidLocationProvider()
        androidProvider.initialize(context)
        return androidProvider
    }

    /**
     * Creates a specific provider type
     */
    fun create(context: Context, type: ProviderType): LocationProvider {
        val provider = when (type) {
            ProviderType.FUSED -> FusedLocationProvider()
            ProviderType.ANDROID -> AndroidLocationProvider()
        }
        provider.initialize(context)
        return provider
    }
}

enum class ProviderType {
    FUSED,
    ANDROID
}
