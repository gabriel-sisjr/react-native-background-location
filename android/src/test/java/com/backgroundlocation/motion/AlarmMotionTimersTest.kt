package com.backgroundlocation.motion

import android.app.AlarmManager
import android.content.Context
import android.content.ContextWrapper
import android.os.SystemClock
import androidx.test.core.app.ApplicationProvider
import com.backgroundlocation.TrackingOptions
import com.backgroundlocation.motion.MotionGate.FixKind
import com.backgroundlocation.motion.MotionGate.TimerKind
import com.google.android.gms.location.DetectedActivity
import io.mockk.every
import io.mockk.mockk
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import org.robolectric.shadows.ShadowAlarmManager

/**
 * Gate timers backed by real (shadowed) `AlarmManager` alarms and PendingIntents, read back the
 * way [MotionActivityReceiver] parses them.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class AlarmMotionTimersTest {

  private val context: Context = ApplicationProvider.getApplicationContext()
  private val alarmManager: AlarmManager = context.getSystemService(AlarmManager::class.java)
  private val timers = AlarmMotionTimers(context)

  private fun scheduledAlarms(): List<ShadowAlarmManager.ScheduledAlarm> = shadowOf(alarmManager).scheduledAlarms

  /** The delivery the receiver parses from the alarm scheduled for [kind]. */
  private fun scheduledDelivery(kind: TimerKind): MotionDelivery.Timer {
    val alarm = scheduledAlarms().single { alarm ->
      shadowOf(alarm.operation).savedIntent.getStringExtra(MotionPendingIntents.EXTRA_TIMER_KIND) == kind.name
    }
    return MotionActivityReceiver.parse(shadowOf(alarm.operation).savedIntent) as MotionDelivery.Timer
  }

  @Test
  fun `arming schedules one inexact allow-while-idle alarm to the receiver with the kind and token`() {
    val armedAt = SystemClock.elapsedRealtime()

    assertTrue(timers.start(TimerKind.DWELL, 60_000L, 42L))

    val alarm = scheduledAlarms().single()
    assertEquals(AlarmManager.ELAPSED_REALTIME_WAKEUP, alarm.type)
    assertEquals(armedAt + 60_000L, alarm.triggerAtTime)
    assertTrue(alarm.isAllowWhileIdle)
    val intent = shadowOf(alarm.operation).savedIntent
    assertEquals(MotionActivityReceiver::class.java.name, intent.component?.className)
    assertEquals(MotionDelivery.Timer(TimerKind.DWELL, 42L), MotionActivityReceiver.parse(intent))
  }

  @Test
  fun `re-arming a kind replaces its alarm and carries the new token`() {
    assertTrue(timers.start(TimerKind.COOLDOWN, 600_000L, 1L))
    assertTrue(timers.start(TimerKind.COOLDOWN, 120_000L, 2L))

    assertEquals(1, scheduledAlarms().size)
    assertEquals(MotionDelivery.Timer(TimerKind.COOLDOWN, 2L), scheduledDelivery(TimerKind.COOLDOWN))
  }

  @Test
  fun `cancel removes one kind and cancelAll removes every alarm and intent`() {
    for (kind in TimerKind.entries) {
      assertTrue(timers.start(kind, 60_000L, 1L))
    }
    assertEquals(TimerKind.entries.size, scheduledAlarms().size)

    timers.cancel(TimerKind.DWELL)

    assertEquals(TimerKind.entries.size - 1, scheduledAlarms().size)
    assertNull(MotionPendingIntents.timer(context, TimerKind.DWELL, token = null, lookupOnly = true))

    timers.cancelAll()

    assertTrue(scheduledAlarms().isEmpty())
    for (kind in TimerKind.entries) {
      assertNull(MotionPendingIntents.timer(context, kind, token = null, lookupOnly = true))
    }
  }

  @Test
  fun `stale cleanup cancels timer alarms left by an earlier session`() {
    for (kind in TimerKind.entries) {
      assertTrue(timers.start(kind, 60_000L, 1L))
    }

    MotionPendingIntents.removeStale(context)

    assertTrue(scheduledAlarms().isEmpty())
    for (kind in TimerKind.entries) {
      assertNull(MotionPendingIntents.timer(context, kind, token = null, lookupOnly = true))
    }
  }

  @Test
  fun `arming reports failure without an AlarmManager`() {
    val withoutAlarms = contextWithAlarmService(null)

    assertFalse(AlarmMotionTimers(withoutAlarms).start(TimerKind.DWELL, 60_000L, 1L))
  }

  @Test
  fun `arming reports failure when the AlarmManager rejects the alarm`() {
    val rejecting = mockk<AlarmManager>()
    every { rejecting.setAndAllowWhileIdle(any(), any(), any()) } throws IllegalStateException("too many alarms")

    assertFalse(AlarmMotionTimers(contextWithAlarmService(rejecting)).start(TimerKind.MAX_REDUCED, 60_000L, 1L))
  }

  @Test
  fun `an alarm from a replaced arming is ignored and the live one is acted upon`() {
    val session = MotionSession(
      platform = GrantedPlatform,
      clientFactory = { IdleRecognitionClient },
      timers = timers,
      host = SilentHost,
      sink = SilentSink,
      removeStale = {},
      isStopRequested = { false },
      elapsedRealtimeNanos = { SystemClock.elapsedRealtimeNanos() }
    )
    session.start("trip-alarms", TrackingOptions(motion = MotionOptions(reduceWhenStationary = true)))
    val replaced = scheduledDelivery(TimerKind.COOLDOWN)

    // Vehicle evidence restarts the cooldown: its alarm now carries a new token
    session.deliver(sampleOf(DetectedActivity.IN_VEHICLE, 90))
    val live = scheduledDelivery(TimerKind.COOLDOWN)
    assertNotEquals(replaced.token, live.token)

    // Stillness with an anchor and an expired dwell: only the cooldown still blocks the reduction
    session.onFix(0.0, 0.0, 10.0, FixKind.FULL)
    session.deliver(sampleOf(DetectedActivity.STILL, 95))
    session.deliver(scheduledDelivery(TimerKind.DWELL))
    assertEquals(MotionGate.Mode.CANDIDATE, session.gateMode)

    session.deliver(replaced)
    assertEquals(MotionGate.Mode.CANDIDATE, session.gateMode)

    session.deliver(live)
    assertEquals(MotionGate.Mode.REDUCED, session.gateMode)
  }

  /** The application context, except that `ALARM_SERVICE` resolves to [alarmService]. */
  private fun contextWithAlarmService(alarmService: AlarmManager?): Context = object : ContextWrapper(context) {
    override fun getSystemService(name: String): Any? =
      if (name == Context.ALARM_SERVICE) alarmService else super.getSystemService(name)
  }

  private fun sampleOf(type: Int, confidence: Int): MotionDelivery.Sample {
    val activity = DetectedActivityInput(type, confidence)
    return MotionDelivery.Sample(activity, listOf(activity), timestampMs = 1_000L)
  }

  private object GrantedPlatform : MotionPlatform {
    override val sdkInt: Int = 34

    override fun isPlayServicesAvailable(): Boolean = true

    override fun isGranted(permission: String): Boolean = true
  }

  private object IdleRecognitionClient : MotionRecognitionClient {
    override fun requestActivityUpdates(intervalMs: Long, onFailure: (Exception) -> Unit) = Unit

    override fun requestTransitionUpdates(onFailure: (Exception) -> Unit) = Unit

    override fun removeActivityUpdates() = Unit

    override fun removeTransitionUpdates() = Unit
  }

  private object SilentHost : MotionHost {
    override fun applyReducedProfile() = Unit

    override fun applyFullProfile() = Unit

    override fun flushStorage() = Unit

    override fun showReducedNotification(text: String) = Unit

    override fun showBaseNotification() = Unit
  }

  private object SilentSink : MotionEventSink {
    override fun emitMotionActivity(event: MotionActivityEvent) = Unit

    override fun emitWarning(tripId: String, type: String, message: String) = Unit

    override fun publishState(snapshot: MotionStateSnapshot) = Unit
  }
}
