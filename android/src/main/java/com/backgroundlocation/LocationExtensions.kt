package com.backgroundlocation

import android.location.Location
import android.os.Build

/**
 * Checks if a location is from a mock provider.
 * Uses [Location.isMock] on API 31+ and falls back to
 * [Location.isFromMockProvider] on older APIs.
 */
internal fun Location.isMockLocation(): Boolean {
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        isMock
    } else {
        @Suppress("DEPRECATION")
        isFromMockProvider
    }
}
