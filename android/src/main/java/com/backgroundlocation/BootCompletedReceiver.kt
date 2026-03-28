package com.backgroundlocation

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/**
 * BroadcastReceiver that restores registered geofences after device reboot
 * Geofences registered with GeofencingClient are cleared on reboot,
 * so they must be re-registered from Room persistence
 */
class BootCompletedReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "BootCompletedRx"
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return

        Log.d(TAG, "Boot completed - restoring geofences")

        val pendingResult = goAsync()
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val manager = GeofenceManagerHolder.getInstance(context)
                manager.restoreGeofences()
                Log.d(TAG, "Geofences restored after boot")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to restore geofences after boot", e)
            } finally {
                pendingResult.finish()
            }
        }
    }
}
