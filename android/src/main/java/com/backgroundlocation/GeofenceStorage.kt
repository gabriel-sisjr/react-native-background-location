package com.backgroundlocation

import android.content.Context
import com.backgroundlocation.database.GeofenceEntity
import com.backgroundlocation.database.GeofenceTransitionEntity
import com.backgroundlocation.database.LocationDatabase
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel

/**
 * Handles persistent storage of geofence regions and transition events using Room Database
 * Thread-safe implementation with coroutines
 */
class GeofenceStorage(context: Context) {

    private val database = LocationDatabase.getInstance(context)
    private val geofenceDao = database.geofenceDao()
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    suspend fun saveGeofence(entity: GeofenceEntity) {
        geofenceDao.insertGeofence(entity)
    }

    suspend fun saveGeofences(entities: List<GeofenceEntity>) {
        geofenceDao.insertGeofences(entities)
    }

    suspend fun removeGeofence(identifier: String): Int {
        return geofenceDao.deleteGeofence(identifier)
    }

    suspend fun removeGeofences(identifiers: List<String>): Int {
        return geofenceDao.deleteGeofences(identifiers)
    }

    suspend fun removeAllGeofences(): Int {
        return geofenceDao.deleteAllGeofences()
    }

    suspend fun getActiveGeofences(): List<GeofenceEntity> {
        return geofenceDao.getAllGeofences()
    }

    suspend fun getGeofenceByIdentifier(identifier: String): GeofenceEntity? {
        return geofenceDao.getGeofenceByIdentifier(identifier)
    }

    suspend fun getGeofenceCount(): Int {
        return geofenceDao.getGeofenceCount()
    }

    suspend fun saveTransition(transition: GeofenceTransitionEntity): Long {
        return geofenceDao.insertTransition(transition)
    }

    suspend fun getTransitions(geofenceId: String?): List<GeofenceTransitionEntity> {
        return if (geofenceId != null) {
            geofenceDao.getTransitionsByGeofenceId(geofenceId)
        } else {
            geofenceDao.getAllTransitions()
        }
    }

    suspend fun clearTransitions(geofenceId: String?): Int {
        return if (geofenceId != null) {
            geofenceDao.deleteTransitionsByGeofenceId(geofenceId)
        } else {
            geofenceDao.deleteAllTransitions()
        }
    }

    fun cleanup() {
        scope.cancel()
    }
}
