package com.backgroundlocation.motion

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config

/**
 * Real PendingIntent creation and `FLAG_NO_CREATE` lookup on both sides of Android 12, where
 * the mutability flag becomes part of the intent identity. A lookup that does not repeat the
 * creation's mutability finds nothing, which would leave stale registrations behind.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [30, 31])
class MotionPendingIntentsRoundTripTest {

  private val context: Context = ApplicationProvider.getApplicationContext()

  @Test
  fun `a samples intent is found by its lookup until it is cancelled`() {
    assertNull(MotionPendingIntents.samples(context, lookupOnly = true))

    val created = requireNotNull(MotionPendingIntents.samples(context, lookupOnly = false))

    assertEquals(created, MotionPendingIntents.samples(context, lookupOnly = true))
    created.cancel()
    assertNull(MotionPendingIntents.samples(context, lookupOnly = true))
  }

  @Test
  fun `a transitions intent is found by its lookup until it is cancelled`() {
    assertNull(MotionPendingIntents.transitions(context, lookupOnly = true))

    val created = requireNotNull(MotionPendingIntents.transitions(context, lookupOnly = false))

    assertEquals(created, MotionPendingIntents.transitions(context, lookupOnly = true))
    created.cancel()
    assertNull(MotionPendingIntents.transitions(context, lookupOnly = true))
  }

  @Test
  fun `activity recognition intents stay mutable and an immutable lookup does not find them`() {
    val samples = requireNotNull(MotionPendingIntents.samples(context, lookupOnly = false))
    val transitions = requireNotNull(MotionPendingIntents.transitions(context, lookupOnly = false))

    assertFalse(shadowOf(samples).isImmutable)
    assertFalse(shadowOf(transitions).isImmutable)
    assertNull(
      PendingIntent.getBroadcast(
        context,
        MotionPendingIntents.REQUEST_CODE_SAMPLES,
        receiverIntent(MotionPendingIntents.ACTION_SAMPLES),
        PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
      )
    )
  }

  @Test
  fun `timer intents are immutable and found by their lookup until they are cancelled`() {
    for (kind in MotionGate.TimerKind.entries) {
      assertNull(MotionPendingIntents.timer(context, kind, token = null, lookupOnly = true))

      val created = requireNotNull(MotionPendingIntents.timer(context, kind, token = 7L, lookupOnly = false))

      assertTrue(shadowOf(created).isImmutable)
      assertEquals(created, MotionPendingIntents.timer(context, kind, token = null, lookupOnly = true))
      created.cancel()
      assertNull(MotionPendingIntents.timer(context, kind, token = null, lookupOnly = true))
    }
  }

  @Test
  fun `a mutable lookup does not find an immutable timer intent`() {
    requireNotNull(MotionPendingIntents.timer(context, MotionGate.TimerKind.DWELL, token = 7L, lookupOnly = false))

    assertNull(
      PendingIntent.getBroadcast(
        context,
        MotionPendingIntents.timerRequestCode(MotionGate.TimerKind.DWELL),
        receiverIntent(MotionPendingIntents.ACTION_TIMER),
        PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_MUTABLE
      )
    )
  }

  private fun receiverIntent(action: String): Intent =
    Intent(context, MotionActivityReceiver::class.java).setAction(action)
}
