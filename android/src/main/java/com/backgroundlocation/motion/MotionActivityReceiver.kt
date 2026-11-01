package com.backgroundlocation.motion

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.SystemClock
import com.backgroundlocation.LocationService
import com.google.android.gms.location.ActivityRecognitionResult
import com.google.android.gms.location.ActivityTransitionResult

/**
 * Manifest-registered, non-exported receiver for Activity Recognition samples and
 * transitions and for the gate timer alarms. Runs on the main thread.
 *
 * Deliveries go to the active `LocationService` session, which re-checks the stop flag
 * and token. Without an active session, or once a stop token is set, leftover
 * registrations and alarms are removed and the delivery is dropped.
 */
class MotionActivityReceiver : BroadcastReceiver() {

  override fun onReceive(context: Context, intent: Intent?) {
    val delivery = intent?.let { parse(it) } ?: return
    dispatch(
      delivery = delivery,
      session = LocationService.activeMotionSession(),
      stopTokenSet = LocationService.isStopTokenSet(context),
      removeStale = { MotionPendingIntents.removeStale(context) }
    )
  }

  internal companion object {
    /** Routes a parsed delivery. */
    fun dispatch(
      delivery: MotionDelivery,
      session: MotionSession?,
      stopTokenSet: Boolean,
      removeStale: () -> Unit
    ) {
      if (session == null || stopTokenSet) {
        removeStale()
        return
      }
      session.deliver(delivery)
    }

    /** Extracts a delivery from [intent]; wrong actions and intents without a result yield `null`. */
    fun parse(intent: Intent): MotionDelivery? = when (intent.action) {
      MotionPendingIntents.ACTION_SAMPLES -> parseSample(intent)
      MotionPendingIntents.ACTION_TRANSITIONS -> parseTransitions(intent)
      MotionPendingIntents.ACTION_TIMER -> parseTimer(intent)
      else -> null
    }

    private fun parseSample(intent: Intent): MotionDelivery? {
      if (!ActivityRecognitionResult.hasResult(intent)) return null
      val result = ActivityRecognitionResult.extractResult(intent) ?: return null
      val mostProbable = result.mostProbableActivity ?: return null
      return MotionDelivery.Sample(
        mostProbable = DetectedActivityInput(mostProbable.type, mostProbable.confidence),
        probable = result.probableActivities.map { DetectedActivityInput(it.type, it.confidence) },
        timestampMs = result.time
      )
    }

    private fun parseTransitions(intent: Intent): MotionDelivery? {
      if (!ActivityTransitionResult.hasResult(intent)) return null
      val result = ActivityTransitionResult.extractResult(intent) ?: return null
      val nowMs = System.currentTimeMillis()
      val nowElapsedNanos = SystemClock.elapsedRealtimeNanos()
      val events = result.transitionEvents.map { event ->
        TransitionInput(
          activityType = event.activityType,
          transitionType = event.transitionType,
          timestampMs = MotionClassifier.transitionTimestampMs(nowMs, nowElapsedNanos, event.elapsedRealTimeNanos)
        )
      }
      return if (events.isEmpty()) null else MotionDelivery.Transitions(events)
    }

    private fun parseTimer(intent: Intent): MotionDelivery? {
      val kind = MotionPendingIntents.timerKindOf(intent.getStringExtra(MotionPendingIntents.EXTRA_TIMER_KIND))
        ?: return null
      if (!intent.hasExtra(MotionPendingIntents.EXTRA_TIMER_TOKEN)) return null
      return MotionDelivery.Timer(kind, intent.getLongExtra(MotionPendingIntents.EXTRA_TIMER_TOKEN, 0L))
    }
  }
}
