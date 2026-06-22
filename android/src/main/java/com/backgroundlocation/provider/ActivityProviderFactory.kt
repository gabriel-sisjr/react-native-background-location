package com.backgroundlocation.provider

import android.content.Context

/**
 * Factory for creating the appropriate activity recognition provider
 */
object ActivityProviderFactory {

    /**
     * Creates the ActivityRecognitionProvider for managing activity transitions and updates
     */
    fun create(context: Context): ActivityProvider {
        val provider = ActivityRecognitionProvider()
        provider.initialize(context)

        if (provider.isAvailable()) {
            android.util.Log.d("ActivityProviderFactory", "Google Play Services available, using ActivityRecognitionProvider")
        } else {
            android.util.Log.w("ActivityProviderFactory", "Google Play Services unavailable. Activity recognition may not work.")
        }
        
        return provider
    }
}
