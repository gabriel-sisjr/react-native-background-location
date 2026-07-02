package com.backgroundlocation

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.google.android.gms.location.ActivityRecognitionResult
import com.google.android.gms.location.DetectedActivity

/**
 * BroadcastReceiver for handling Activity Recognition updates.
 */
class ActivityReceiver : BroadcastReceiver() {

  companion object {
    const val ACTION_PROCESS_ACTIVITY_UPDATES = "com.backgroundlocation.ACTION_PROCESS_ACTIVITY_UPDATES"
  }

  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != ACTION_PROCESS_ACTIVITY_UPDATES) return

    // Handle Continuous Updates
    if (ActivityRecognitionResult.hasResult(intent)) {
      val result = ActivityRecognitionResult.extractResult(intent)
      result?.mostProbableActivity?.let { activity ->
        android.util.Log.d("ActivityReceiver", "Received Activity Update: ${getActivityString(activity.type)} (${activity.confidence}%)")
        LocationService.handleActivityStateChanged(activity.type, activity.confidence)
      }
      return
    }
  }

  private fun getActivityString(type: Int): String {
    return when (type) {
      DetectedActivity.IN_VEHICLE -> "IN_VEHICLE"
      DetectedActivity.ON_BICYCLE -> "ON_BICYCLE"
      DetectedActivity.ON_FOOT -> "ON_FOOT"
      DetectedActivity.RUNNING -> "RUNNING"
      DetectedActivity.STILL -> "STILL"
      DetectedActivity.TILTING -> "TILTING"
      DetectedActivity.UNKNOWN -> "UNKNOWN"
      DetectedActivity.WALKING -> "WALKING"
      else -> "UNKNOWN ($type)"
    }
  }
}
