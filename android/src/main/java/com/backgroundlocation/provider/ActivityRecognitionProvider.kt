package com.backgroundlocation.provider

import android.Manifest
import android.annotation.SuppressLint
import android.app.PendingIntent
import android.content.Context
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability
import com.google.android.gms.location.ActivityRecognition
import com.google.android.gms.location.ActivityRecognitionClient

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
    val ctx = context ?: return
    
    // Check if ACTIVITY_RECOGNITION permission is granted
    if (ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACTIVITY_RECOGNITION) != PackageManager.PERMISSION_GRANTED) {
      android.util.Log.w("ActivityRecognitionProvider", "ACTIVITY_RECOGNITION permission not granted. Activity recognition will not work. Please request this permission at runtime before enabling activity tracking.")
      return
    }
    
    activityRecognitionClient?.requestActivityUpdates(intervalMs, pendingIntent)
      ?.addOnSuccessListener {
        android.util.Log.d("ActivityRecognitionProvider", "Successfully registered for continuous activity updates")
      }
      ?.addOnFailureListener { e ->
        android.util.Log.e("ActivityRecognitionProvider", "Failed to register for continuous activity updates", e)
      }
  }

  @SuppressLint("MissingPermission")
  override fun removeActivityUpdates(pendingIntent: PendingIntent) {
    activityRecognitionClient?.removeActivityUpdates(pendingIntent)
      ?.addOnSuccessListener {
        android.util.Log.d("ActivityRecognitionProvider", "Successfully removed continuous activity updates")
      }
      ?.addOnFailureListener { e ->
        android.util.Log.e("ActivityRecognitionProvider", "Failed to remove continuous activity updates", e)
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
