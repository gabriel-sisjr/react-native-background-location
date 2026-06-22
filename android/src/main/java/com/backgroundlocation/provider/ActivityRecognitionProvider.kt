package com.backgroundlocation.provider

import android.annotation.SuppressLint
import android.app.PendingIntent
import android.content.Context
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability
import com.google.android.gms.location.ActivityRecognition
import com.google.android.gms.location.ActivityRecognitionClient
import com.google.android.gms.location.ActivityTransitionRequest

/**
 * Activity provider using Google Play Services ActivityRecognition API.
 */
class ActivityRecognitionProvider : ActivityProvider {

    private var context: Context? = null
    private var activityRecognitionClient: ActivityRecognitionClient? = null

    override fun initialize(context: Context) {
        this.context = context
        this.activityRecognitionClient = ActivityRecognition.getClient(context)
    }

    @SuppressLint("MissingPermission")
    override fun requestActivityUpdates(intervalMs: Long, pendingIntent: PendingIntent) {
        activityRecognitionClient?.requestActivityUpdates(intervalMs, pendingIntent)
            ?.addOnSuccessListener {
                android.util.Log.d("ActivityRecProvider", "Successfully registered for continuous activity updates")
            }
            ?.addOnFailureListener { e ->
                android.util.Log.e("ActivityRecProvider", "Failed to register for continuous activity updates", e)
            }
    }

    @SuppressLint("MissingPermission")
    override fun removeActivityUpdates(pendingIntent: PendingIntent) {
        activityRecognitionClient?.removeActivityUpdates(pendingIntent)
            ?.addOnSuccessListener {
                android.util.Log.d("ActivityRecProvider", "Successfully removed continuous activity updates")
            }
            ?.addOnFailureListener { e ->
                android.util.Log.e("ActivityRecProvider", "Failed to remove continuous activity updates", e)
            }
    }

    @SuppressLint("MissingPermission")
    override fun requestActivityTransitionUpdates(
        request: ActivityTransitionRequest,
        pendingIntent: PendingIntent
    ) {
        activityRecognitionClient?.requestActivityTransitionUpdates(request, pendingIntent)
            ?.addOnSuccessListener {
                android.util.Log.d("ActivityRecProvider", "Successfully registered for activity transition updates")
            }
            ?.addOnFailureListener { e ->
                android.util.Log.e("ActivityRecProvider", "Failed to register for activity transition updates", e)
            }
    }

    @SuppressLint("MissingPermission")
    override fun removeActivityTransitionUpdates(pendingIntent: PendingIntent) {
        activityRecognitionClient?.removeActivityTransitionUpdates(pendingIntent)
            ?.addOnSuccessListener {
                android.util.Log.d("ActivityRecProvider", "Successfully removed activity transition updates")
            }
            ?.addOnFailureListener { e ->
                android.util.Log.e("ActivityRecProvider", "Failed to remove activity transition updates", e)
            }
    }

    override fun isAvailable(): Boolean {
        val ctx = context ?: return false
        val apiAvailability = GoogleApiAvailability.getInstance()
        val resultCode = apiAvailability.isGooglePlayServicesAvailable(ctx)
        return resultCode == ConnectionResult.SUCCESS
    }

    override fun cleanup() {
        this.activityRecognitionClient = null
        this.context = null
    }
}
