package com.backgroundlocation.processor

import android.location.Location

/**
 * Interface for processing locations before storage
 * Allows custom filtering, transformation, and side effects
 */
interface LocationProcessor {

    /**
     * Called for each location before storage
     * Return false to skip storing this location
     */
    fun shouldStore(location: Location): Boolean = true

    /**
     * Transform location before storage
     * Can modify accuracy, add metadata, etc.
     */
    fun process(location: Location): Location = location

    /**
     * Called when a batch of locations is about to be stored
     * Useful for analytics or batch operations
     */
    fun onLocationBatch(locations: List<Location>) {}
}

/**
 * Default processor that stores all locations unchanged
 */
class DefaultLocationProcessor : LocationProcessor
