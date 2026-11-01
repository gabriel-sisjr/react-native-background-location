package com.backgroundlocation.motion

import android.annotation.SuppressLint
import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.SystemClock
import android.util.Log
import com.google.android.gms.location.ActivityRecognition
import com.google.android.gms.location.ActivityRecognitionClient
import com.google.android.gms.location.ActivityTransition
import com.google.android.gms.location.ActivityTransitionRequest
import com.google.android.gms.location.DetectedActivity

/**
 * PendingIntents of the motion activity feature: explicit broadcasts to the non-exported
 * [MotionActivityReceiver].
 *
 * Activity Recognition intents are mutable on Android 12+ because Play services writes the
 * result extras into them. Gate timers use inexact allow-while-idle alarms with immutable
 * intents: listener-based exact alarms need `SCHEDULE_EXACT_ALARM` on Android 12 and 13,
 * and the library declares no alarm permission.
 */
internal object MotionPendingIntents {
  const val ACTION_SAMPLES = "com.backgroundlocation.action.MOTION_SAMPLES"
  const val ACTION_TRANSITIONS = "com.backgroundlocation.action.MOTION_TRANSITIONS"
  const val ACTION_TIMER = "com.backgroundlocation.action.MOTION_TIMER"

  const val REQUEST_CODE_SAMPLES = 9101
  const val REQUEST_CODE_TRANSITIONS = 9102
  const val REQUEST_CODE_TIMER_DWELL = 9103
  const val REQUEST_CODE_TIMER_COOLDOWN = 9104
  const val REQUEST_CODE_TIMER_MAX_REDUCED = 9105
  const val REQUEST_CODE_TIMER_PROBE = 9106

  const val EXTRA_TIMER_KIND = "com.backgroundlocation.extra.MOTION_TIMER_KIND"
  const val EXTRA_TIMER_TOKEN = "com.backgroundlocation.extra.MOTION_TIMER_TOKEN"

  private const val TAG = "MotionPendingIntents"

  /**
   * Flags of the Activity Recognition intents. A lookup uses `FLAG_NO_CREATE` with the same
   * mutability as the creation, so it finds the registered intent without creating one.
   */
  fun flags(sdkInt: Int, lookupOnly: Boolean): Int {
    val base = if (lookupOnly) PendingIntent.FLAG_NO_CREATE else PendingIntent.FLAG_UPDATE_CURRENT
    return if (sdkInt >= Build.VERSION_CODES.S) base or PendingIntent.FLAG_MUTABLE else base
  }

  /** Flags of the timer intents: always immutable, the alarm adds nothing to them. */
  fun timerFlags(lookupOnly: Boolean): Int {
    val base = if (lookupOnly) PendingIntent.FLAG_NO_CREATE else PendingIntent.FLAG_UPDATE_CURRENT
    return base or PendingIntent.FLAG_IMMUTABLE
  }

  /** One request code per timer kind, so each kind is a distinct alarm. */
  fun timerRequestCode(kind: MotionGate.TimerKind): Int = when (kind) {
    MotionGate.TimerKind.DWELL -> REQUEST_CODE_TIMER_DWELL
    MotionGate.TimerKind.COOLDOWN -> REQUEST_CODE_TIMER_COOLDOWN
    MotionGate.TimerKind.MAX_REDUCED -> REQUEST_CODE_TIMER_MAX_REDUCED
    MotionGate.TimerKind.PROBE -> REQUEST_CODE_TIMER_PROBE
  }

  /** Timer kind encoded in a timer intent, or `null` when unknown. */
  fun timerKindOf(name: String?): MotionGate.TimerKind? =
    MotionGate.TimerKind.entries.firstOrNull { it.name == name }

  /** The seven transitions the session registers. */
  fun transitions(): List<ActivityTransition> = listOf(
    transition(DetectedActivity.STILL, ActivityTransition.ACTIVITY_TRANSITION_ENTER),
    transition(DetectedActivity.STILL, ActivityTransition.ACTIVITY_TRANSITION_EXIT),
    transition(DetectedActivity.IN_VEHICLE, ActivityTransition.ACTIVITY_TRANSITION_ENTER),
    transition(DetectedActivity.IN_VEHICLE, ActivityTransition.ACTIVITY_TRANSITION_EXIT),
    transition(DetectedActivity.ON_BICYCLE, ActivityTransition.ACTIVITY_TRANSITION_ENTER),
    transition(DetectedActivity.WALKING, ActivityTransition.ACTIVITY_TRANSITION_ENTER),
    transition(DetectedActivity.RUNNING, ActivityTransition.ACTIVITY_TRANSITION_ENTER)
  )

  /** Transition request for [transitions]. */
  fun transitionRequest(): ActivityTransitionRequest = ActivityTransitionRequest(transitions())

  fun samples(context: Context, lookupOnly: Boolean): PendingIntent? =
    broadcast(context, ACTION_SAMPLES, REQUEST_CODE_SAMPLES, flags(Build.VERSION.SDK_INT, lookupOnly))

  fun transitions(context: Context, lookupOnly: Boolean): PendingIntent? =
    broadcast(context, ACTION_TRANSITIONS, REQUEST_CODE_TRANSITIONS, flags(Build.VERSION.SDK_INT, lookupOnly))

  /** Timer intent for [kind]; [token] is written when creating, ignored for a lookup. */
  fun timer(context: Context, kind: MotionGate.TimerKind, token: Long?, lookupOnly: Boolean): PendingIntent? {
    val intent = Intent(context, MotionActivityReceiver::class.java)
      .setAction(ACTION_TIMER)
      .putExtra(EXTRA_TIMER_KIND, kind.name)
    token?.let { intent.putExtra(EXTRA_TIMER_TOKEN, it) }
    return PendingIntent.getBroadcast(context, timerRequestCode(kind), intent, timerFlags(lookupOnly))
  }

  /**
   * Removes registrations and timer alarms left by an earlier session or process. Only
   * `FLAG_NO_CREATE` lookups run when nothing is left, so no Activity Recognition client
   * is created and Play services is not contacted.
   */
  fun removeStale(context: Context) {
    val samples = samples(context, lookupOnly = true)
    val transitions = transitions(context, lookupOnly = true)
    if (samples != null || transitions != null) {
      val client = try {
        ActivityRecognition.getClient(context)
      } catch (e: Exception) {
        Log.w(TAG, "Activity Recognition client unavailable for stale cleanup", e)
        null
      }
      samples?.let { removeSamples(client, it) }
      transitions?.let { removeTransitions(client, it) }
      Log.d(TAG, "Removed stale motion activity registrations")
    }
    val alarmManager = context.getSystemService(AlarmManager::class.java)
    MotionGate.TimerKind.entries.forEach { kind ->
      timer(context, kind, token = null, lookupOnly = true)?.let { pendingIntent ->
        alarmManager?.cancel(pendingIntent)
        pendingIntent.cancel()
      }
    }
  }

  @SuppressLint("MissingPermission")
  internal fun removeSamples(client: ActivityRecognitionClient?, pendingIntent: PendingIntent) {
    try {
      client?.removeActivityUpdates(pendingIntent)?.addOnFailureListener { error ->
        Log.w(TAG, "Failed to remove motion activity samples", error)
      }
    } catch (e: Exception) {
      Log.w(TAG, "Failed to remove motion activity samples", e)
    }
    pendingIntent.cancel()
  }

  @SuppressLint("MissingPermission")
  internal fun removeTransitions(client: ActivityRecognitionClient?, pendingIntent: PendingIntent) {
    try {
      client?.removeActivityTransitionUpdates(pendingIntent)?.addOnFailureListener { error ->
        Log.w(TAG, "Failed to remove motion activity transitions", error)
      }
    } catch (e: Exception) {
      Log.w(TAG, "Failed to remove motion activity transitions", e)
    }
    pendingIntent.cancel()
  }

  private fun broadcast(context: Context, action: String, requestCode: Int, flags: Int): PendingIntent? {
    val intent = Intent(context, MotionActivityReceiver::class.java).setAction(action)
    return PendingIntent.getBroadcast(context, requestCode, intent, flags)
  }

  private fun transition(activityType: Int, transitionType: Int): ActivityTransition =
    ActivityTransition.Builder()
      .setActivityType(activityType)
      .setActivityTransition(transitionType)
      .build()
}

/**
 * [MotionRecognitionClient] backed by Play services. Created lazily by the session, only
 * after the availability and permission checks passed.
 */
internal class GmsMotionRecognitionClient(private val context: Context) : MotionRecognitionClient {
  private val client: ActivityRecognitionClient = ActivityRecognition.getClient(context)

  @SuppressLint("MissingPermission")
  override fun requestActivityUpdates(intervalMs: Long, onFailure: (Exception) -> Unit) {
    val pendingIntent = MotionPendingIntents.samples(context, lookupOnly = false)
      ?: throw IllegalStateException("Motion activity sample intent unavailable")
    client.requestActivityUpdates(intervalMs, pendingIntent).addOnFailureListener { error -> onFailure(error) }
  }

  @SuppressLint("MissingPermission")
  override fun requestTransitionUpdates(onFailure: (Exception) -> Unit) {
    val pendingIntent = MotionPendingIntents.transitions(context, lookupOnly = false)
      ?: throw IllegalStateException("Motion activity transition intent unavailable")
    client.requestActivityTransitionUpdates(MotionPendingIntents.transitionRequest(), pendingIntent)
      .addOnFailureListener { error -> onFailure(error) }
  }

  override fun removeActivityUpdates() {
    MotionPendingIntents.samples(context, lookupOnly = true)?.let { MotionPendingIntents.removeSamples(client, it) }
  }

  override fun removeTransitionUpdates() {
    MotionPendingIntents.transitions(context, lookupOnly = true)?.let {
      MotionPendingIntents.removeTransitions(client, it)
    }
  }
}

/**
 * [MotionTimers] backed by inexact `setAndAllowWhileIdle` alarms delivered to
 * [MotionActivityReceiver]. No permission is needed. The system may deliver them late
 * (batching; at most about once per 9 minutes in Doze), which only lengthens the bounds
 * the gate relies on. Every arming carries its token, so late deliveries of a cancelled
 * or replaced arming are ignored by the session. An arming that fails is reported, never
 * retried: the session then ends detection.
 */
internal class AlarmMotionTimers(private val context: Context) : MotionTimers {
  private val alarmManager: AlarmManager? = context.getSystemService(AlarmManager::class.java)

  override fun start(kind: MotionGate.TimerKind, durationMs: Long, token: Long): Boolean =
    try {
      val manager = checkNotNull(alarmManager) { "AlarmManager unavailable" }
      val pendingIntent = checkNotNull(MotionPendingIntents.timer(context, kind, token, lookupOnly = false)) {
        "Motion timer intent unavailable"
      }
      manager.setAndAllowWhileIdle(
        AlarmManager.ELAPSED_REALTIME_WAKEUP,
        SystemClock.elapsedRealtime() + durationMs,
        pendingIntent
      )
      true
    } catch (e: Exception) {
      // For example the system limit on pending alarms per app
      Log.e(TAG, "Failed to schedule the motion ${kind.name} timer", e)
      false
    }

  override fun cancel(kind: MotionGate.TimerKind) {
    MotionPendingIntents.timer(context, kind, token = null, lookupOnly = true)?.let { pendingIntent ->
      alarmManager?.cancel(pendingIntent)
      pendingIntent.cancel()
    }
  }

  override fun cancelAll() {
    MotionGate.TimerKind.entries.forEach { kind -> cancel(kind) }
  }

  private companion object {
    const val TAG = "AlarmMotionTimers"
  }
}
