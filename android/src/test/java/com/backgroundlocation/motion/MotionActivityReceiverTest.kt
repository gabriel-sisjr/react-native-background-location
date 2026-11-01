package com.backgroundlocation.motion

import android.content.Context
import android.content.Intent
import android.os.SystemClock
import androidx.test.core.app.ApplicationProvider
import com.google.android.gms.common.internal.safeparcel.SafeParcelableSerializer
import com.google.android.gms.location.ActivityRecognitionResult
import com.google.android.gms.location.ActivityTransition
import com.google.android.gms.location.ActivityTransitionEvent
import com.google.android.gms.location.ActivityTransitionResult
import com.google.android.gms.location.DetectedActivity
import java.time.Duration
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.shadows.ShadowSystemClock

/**
 * Intent parsing of [MotionActivityReceiver], with results serialized the way Play services
 * delivers them and timer extras as the alarm intents carry them.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class MotionActivityReceiverTest {

  private val context: Context = ApplicationProvider.getApplicationContext()

  private fun intentFor(action: String?): Intent =
    Intent(context, MotionActivityReceiver::class.java).setAction(action)

  @Test
  fun `intents with another action or without an action are ignored`() {
    assertNull(MotionActivityReceiver.parse(intentFor("com.backgroundlocation.action.SOMETHING_ELSE")))
    assertNull(MotionActivityReceiver.parse(intentFor(null)))
  }

  @Test
  fun `a samples intent without a recognition result is ignored`() {
    assertNull(MotionActivityReceiver.parse(intentFor(MotionPendingIntents.ACTION_SAMPLES)))
  }

  @Test
  fun `a samples intent yields the most probable activity, every probable activity and the result time`() {
    val result = ActivityRecognitionResult(
      listOf(
        DetectedActivity(DetectedActivity.STILL, 80),
        DetectedActivity(DetectedActivity.IN_VEHICLE, 15)
      ),
      SAMPLE_TIME_MS,
      SAMPLE_ELAPSED_REALTIME_MS
    )
    val intent = intentFor(MotionPendingIntents.ACTION_SAMPLES)
    SafeParcelableSerializer.serializeToIntentExtra(result, intent, EXTRA_ACTIVITY_RESULT)

    assertEquals(
      MotionDelivery.Sample(
        mostProbable = DetectedActivityInput(DetectedActivity.STILL, 80),
        probable = listOf(
          DetectedActivityInput(DetectedActivity.STILL, 80),
          DetectedActivityInput(DetectedActivity.IN_VEHICLE, 15)
        ),
        timestampMs = SAMPLE_TIME_MS
      ),
      MotionActivityReceiver.parse(intent)
    )
  }

  @Test
  fun `a transitions intent maps every event and dates it from the elapsed realtime clock`() {
    // The paused test clock starts near zero: move it so the events lie after boot
    ShadowSystemClock.advanceBy(Duration.ofHours(1))
    val nowElapsedNanos = SystemClock.elapsedRealtimeNanos()
    val result = ActivityTransitionResult(
      listOf(
        ActivityTransitionEvent(
          DetectedActivity.IN_VEHICLE,
          ActivityTransition.ACTIVITY_TRANSITION_EXIT,
          nowElapsedNanos - 5_000_000_000L
        ),
        ActivityTransitionEvent(
          DetectedActivity.STILL,
          ActivityTransition.ACTIVITY_TRANSITION_ENTER,
          nowElapsedNanos - 2_000_000_000L
        )
      )
    )
    val intent = intentFor(MotionPendingIntents.ACTION_TRANSITIONS)
    SafeParcelableSerializer.serializeToIntentExtra(result, intent, EXTRA_TRANSITION_RESULT)

    val before = System.currentTimeMillis()
    val delivery = MotionActivityReceiver.parse(intent) as MotionDelivery.Transitions
    val after = System.currentTimeMillis()

    assertEquals(
      listOf(
        DetectedActivity.IN_VEHICLE to ActivityTransition.ACTIVITY_TRANSITION_EXIT,
        DetectedActivity.STILL to ActivityTransition.ACTIVITY_TRANSITION_ENTER
      ),
      delivery.events.map { it.activityType to it.transitionType }
    )
    val (exit, enter) = delivery.events
    assertTrue(exit.timestampMs in (before - 5_000L - CLOCK_SLACK_MS)..(after - 5_000L))
    assertTrue(enter.timestampMs in (before - 2_000L - CLOCK_SLACK_MS)..(after - 2_000L))
  }

  @Test
  fun `a transitions intent without a result or without events is ignored`() {
    assertNull(MotionActivityReceiver.parse(intentFor(MotionPendingIntents.ACTION_TRANSITIONS)))

    val empty = intentFor(MotionPendingIntents.ACTION_TRANSITIONS)
    SafeParcelableSerializer.serializeToIntentExtra(
      ActivityTransitionResult(emptyList()),
      empty,
      EXTRA_TRANSITION_RESULT
    )
    assertNull(MotionActivityReceiver.parse(empty))
  }

  @Test
  fun `a timer intent yields its kind and token`() {
    val intent = intentFor(MotionPendingIntents.ACTION_TIMER)
      .putExtra(MotionPendingIntents.EXTRA_TIMER_KIND, MotionGate.TimerKind.PROBE.name)
      .putExtra(MotionPendingIntents.EXTRA_TIMER_TOKEN, 42L)

    assertEquals(MotionDelivery.Timer(MotionGate.TimerKind.PROBE, 42L), MotionActivityReceiver.parse(intent))
  }

  @Test
  fun `a timer intent without a token, without a kind or with an unknown kind is ignored`() {
    val withoutToken = intentFor(MotionPendingIntents.ACTION_TIMER)
      .putExtra(MotionPendingIntents.EXTRA_TIMER_KIND, MotionGate.TimerKind.DWELL.name)
    val withoutKind = intentFor(MotionPendingIntents.ACTION_TIMER)
      .putExtra(MotionPendingIntents.EXTRA_TIMER_TOKEN, 42L)
    val unknownKind = intentFor(MotionPendingIntents.ACTION_TIMER)
      .putExtra(MotionPendingIntents.EXTRA_TIMER_KIND, "UNKNOWN_TIMER")
      .putExtra(MotionPendingIntents.EXTRA_TIMER_TOKEN, 42L)

    for (intent in listOf(withoutToken, withoutKind, unknownKind)) {
      assertNull(MotionActivityReceiver.parse(intent))
    }
  }

  private companion object {
    /** Extra keys Play services writes its results under (read by `hasResult` / `extractResult`). */
    const val EXTRA_ACTIVITY_RESULT = "com.google.android.location.internal.EXTRA_ACTIVITY_RESULT"
    const val EXTRA_TRANSITION_RESULT = "com.google.android.location.internal.EXTRA_ACTIVITY_TRANSITION_RESULT"

    const val SAMPLE_TIME_MS = 1_700_000_000_000L
    const val SAMPLE_ELAPSED_REALTIME_MS = 5_000L

    /** Tolerance for the elapsed realtime clock moving between building and parsing the intent. */
    const val CLOCK_SLACK_MS = 1_000L
  }
}
