package com.backgroundlocation.motion

import android.app.PendingIntent
import com.google.android.gms.location.ActivityTransition
import com.google.android.gms.location.DetectedActivity
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test

class MotionPendingIntentsTest {

  @Test
  fun `API 30 creation updates the current intent without a mutability flag`() {
    assertEquals(PendingIntent.FLAG_UPDATE_CURRENT, MotionPendingIntents.flags(30, lookupOnly = false))
  }

  @Test
  fun `API 30 lookup never creates an intent`() {
    assertEquals(PendingIntent.FLAG_NO_CREATE, MotionPendingIntents.flags(30, lookupOnly = true))
  }

  @Test
  fun `API 31 creation is mutable so Play services can add the result`() {
    assertEquals(
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE,
      MotionPendingIntents.flags(31, lookupOnly = false)
    )
  }

  @Test
  fun `API 31 lookup keeps the mutability of the created intent`() {
    assertEquals(
      PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_MUTABLE,
      MotionPendingIntents.flags(31, lookupOnly = true)
    )
  }

  @Test
  fun `timer intents are immutable for creation and lookup`() {
    assertEquals(
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      MotionPendingIntents.timerFlags(lookupOnly = false)
    )
    assertEquals(
      PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE,
      MotionPendingIntents.timerFlags(lookupOnly = true)
    )
  }

  @Test
  fun `actions are distinct`() {
    val actions = listOf(
      MotionPendingIntents.ACTION_SAMPLES,
      MotionPendingIntents.ACTION_TRANSITIONS,
      MotionPendingIntents.ACTION_TIMER
    )
    assertEquals("com.backgroundlocation.action.MOTION_SAMPLES", MotionPendingIntents.ACTION_SAMPLES)
    assertEquals("com.backgroundlocation.action.MOTION_TRANSITIONS", MotionPendingIntents.ACTION_TRANSITIONS)
    assertEquals(actions.size, actions.toSet().size)
  }

  @Test
  fun `request codes are distinct`() {
    val codes = listOf(MotionPendingIntents.REQUEST_CODE_SAMPLES, MotionPendingIntents.REQUEST_CODE_TRANSITIONS) +
      MotionGate.TimerKind.entries.map(MotionPendingIntents::timerRequestCode)

    assertEquals(9101, MotionPendingIntents.REQUEST_CODE_SAMPLES)
    assertEquals(9102, MotionPendingIntents.REQUEST_CODE_TRANSITIONS)
    assertEquals(codes.size, codes.toSet().size)
  }

  @Test
  fun `timer kinds round-trip through their intent extra`() {
    for (kind in MotionGate.TimerKind.entries) {
      assertEquals(kind, MotionPendingIntents.timerKindOf(kind.name))
    }
    assertEquals(null, MotionPendingIntents.timerKindOf("UNKNOWN_TIMER"))
    assertEquals(null, MotionPendingIntents.timerKindOf(null))
  }

  @Test
  fun `the transition request is built from the seven registered transitions without duplicates`() {
    val registered = MotionPendingIntents.transitions().map { it.activityType to it.transitionType }

    assertEquals(
      listOf(
        DetectedActivity.STILL to ActivityTransition.ACTIVITY_TRANSITION_ENTER,
        DetectedActivity.STILL to ActivityTransition.ACTIVITY_TRANSITION_EXIT,
        DetectedActivity.IN_VEHICLE to ActivityTransition.ACTIVITY_TRANSITION_ENTER,
        DetectedActivity.IN_VEHICLE to ActivityTransition.ACTIVITY_TRANSITION_EXIT,
        DetectedActivity.ON_BICYCLE to ActivityTransition.ACTIVITY_TRANSITION_ENTER,
        DetectedActivity.WALKING to ActivityTransition.ACTIVITY_TRANSITION_ENTER,
        DetectedActivity.RUNNING to ActivityTransition.ACTIVITY_TRANSITION_ENTER
      ),
      registered
    )
    assertEquals(registered.size, registered.toSet().size)
    // The request constructor rejects duplicated transitions on the client side
    assertNotNull(MotionPendingIntents.transitionRequest())
  }
}
