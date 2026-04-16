package com.backgroundlocation

import android.content.Context

/**
 * Singleton holder for GeofenceManager
 * Provides access from system BroadcastReceivers (e.g., GeofenceBroadcastReceiver, BootCompletedReceiver) and other components
 * that don't have access to the React Native module
 */
object GeofenceManagerHolder {

    @Volatile
    private var instance: GeofenceManager? = null

    fun getInstance(context: Context): GeofenceManager {
        return instance ?: synchronized(this) {
            instance ?: GeofenceManager(context.applicationContext).also { instance = it }
        }
    }

    fun setInstance(manager: GeofenceManager) {
        synchronized(this) {
            instance = manager
        }
    }

    fun clearInstance() {
        synchronized(this) {
            instance?.cleanup()
            instance = null
        }
    }
}
