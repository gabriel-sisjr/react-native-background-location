package com.backgroundlocation.motion

import com.google.android.gms.location.ActivityTransition
import com.google.android.gms.location.DetectedActivity
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class MotionClassifierTest {

  private fun activity(type: Int, confidence: Int) = DetectedActivityInput(type, confidence)

  private fun sample(type: Int, confidence: Int, vararg others: DetectedActivityInput): MotionClassification {
    val mostProbable = activity(type, confidence)
    return MotionClassifier.classifySample(mostProbable, listOf(mostProbable) + others, SAMPLE_TIME_MS)
  }

  private fun transition(activityType: Int, transitionType: Int) =
    MotionClassifier.classifyTransition(TransitionInput(activityType, transitionType, TRANSITION_TIME_MS))

  @Test
  fun `maps every DetectedActivity type of the most probable activity`() {
    val expected = mapOf(
      DetectedActivity.IN_VEHICLE to MotionActivityType.AUTOMOTIVE,
      DetectedActivity.ON_BICYCLE to MotionActivityType.CYCLING,
      DetectedActivity.RUNNING to MotionActivityType.RUNNING,
      DetectedActivity.WALKING to MotionActivityType.WALKING,
      DetectedActivity.ON_FOOT to MotionActivityType.WALKING,
      DetectedActivity.STILL to MotionActivityType.STATIONARY,
      DetectedActivity.UNKNOWN to MotionActivityType.UNKNOWN,
      DetectedActivity.TILTING to MotionActivityType.UNKNOWN,
      UNLISTED_TYPE to MotionActivityType.UNKNOWN
    )
    for ((type, activity) in expected) {
      assertEquals("type $type", activity, sample(type, 90).sample?.activity)
    }
  }

  @Test
  fun `on foot is running only when the running confidence beats walking`() {
    assertEquals(
      MotionActivityType.RUNNING,
      sample(DetectedActivity.ON_FOOT, 80, activity(DetectedActivity.RUNNING, 60), activity(DetectedActivity.WALKING, 20))
        .sample?.activity
    )
    assertEquals(
      MotionActivityType.WALKING,
      sample(DetectedActivity.ON_FOOT, 80, activity(DetectedActivity.RUNNING, 20), activity(DetectedActivity.WALKING, 60))
        .sample?.activity
    )
    // A tie goes to walking
    assertEquals(
      MotionActivityType.WALKING,
      sample(DetectedActivity.ON_FOOT, 80, activity(DetectedActivity.RUNNING, 40), activity(DetectedActivity.WALKING, 40))
        .sample?.activity
    )
    assertEquals(MotionActivityType.WALKING, sample(DetectedActivity.ON_FOOT, 80).sample?.activity)
  }

  @Test
  fun `confidence buckets at 0, 49, 50, 74, 75 and 100`() {
    val expected = mapOf(
      0 to MotionConfidence.LOW,
      49 to MotionConfidence.LOW,
      50 to MotionConfidence.MEDIUM,
      74 to MotionConfidence.MEDIUM,
      75 to MotionConfidence.HIGH,
      100 to MotionConfidence.HIGH
    )
    for ((value, confidence) in expected) {
      assertEquals("confidence $value", confidence, MotionClassifier.confidenceOf(value))
      assertEquals("sample confidence $value", confidence, sample(DetectedActivity.WALKING, value).sample?.confidence)
    }
  }

  @Test
  fun `samples are classified for the gate by activity and confidence`() {
    assertEquals(MotionInputClass.STILL_HIGH, sample(DetectedActivity.STILL, 75).input)
    assertEquals(MotionInputClass.STILL_MEDIUM, sample(DetectedActivity.STILL, 74).input)
    assertEquals(MotionInputClass.MOVEMENT, sample(DetectedActivity.STILL, 49).input)
    assertEquals(MotionInputClass.MOVEMENT, sample(DetectedActivity.WALKING, 95).input)
    assertEquals(MotionInputClass.MOVEMENT, sample(DetectedActivity.RUNNING, 30).input)
    assertEquals(MotionInputClass.MOVEMENT, sample(DetectedActivity.ON_BICYCLE, 60).input)
    assertEquals(MotionInputClass.MOVEMENT, sample(DetectedActivity.UNKNOWN, 95).input)
    assertEquals(MotionInputClass.MOVEMENT, sample(DetectedActivity.TILTING, 95).input)
    assertEquals(MotionInputClass.VEHICLE, sample(DetectedActivity.IN_VEHICLE, 20).input)
  }

  @Test
  fun `probable in-vehicle at 50 is vehicle evidence and at 49 is not`() {
    val atFifty = sample(DetectedActivity.STILL, 90, activity(DetectedActivity.IN_VEHICLE, 50))
    assertEquals(MotionInputClass.VEHICLE, atFifty.input)
    // The raw event still reports the most probable activity
    assertEquals(MotionActivityType.STATIONARY, atFifty.sample?.activity)
    assertEquals(MotionConfidence.HIGH, atFifty.sample?.confidence)

    val atFortyNine = sample(DetectedActivity.STILL, 90, activity(DetectedActivity.IN_VEHICLE, 49))
    assertEquals(MotionInputClass.STILL_HIGH, atFortyNine.input)
  }

  @Test
  fun `samples keep the Activity Recognition time`() {
    assertEquals(SAMPLE_TIME_MS, sample(DetectedActivity.STILL, 90).sample?.timestampMs)
  }

  @Test
  fun `each registered transition maps to its gate class and raw event`() {
    val enter = ActivityTransition.ACTIVITY_TRANSITION_ENTER
    val exit = ActivityTransition.ACTIVITY_TRANSITION_EXIT
    val expected = listOf(
      Triple(DetectedActivity.STILL to enter, MotionInputClass.STILL_HIGH, MotionActivityType.STATIONARY),
      Triple(DetectedActivity.STILL to exit, MotionInputClass.MOVEMENT, null),
      Triple(DetectedActivity.IN_VEHICLE to enter, MotionInputClass.VEHICLE, MotionActivityType.AUTOMOTIVE),
      Triple(DetectedActivity.IN_VEHICLE to exit, MotionInputClass.VEHICLE, null),
      Triple(DetectedActivity.ON_BICYCLE to enter, MotionInputClass.MOVEMENT, MotionActivityType.CYCLING),
      Triple(DetectedActivity.WALKING to enter, MotionInputClass.MOVEMENT, MotionActivityType.WALKING),
      Triple(DetectedActivity.RUNNING to enter, MotionInputClass.MOVEMENT, MotionActivityType.RUNNING)
    )
    for ((registered, inputClass, activity) in expected) {
      val classification = transition(registered.first, registered.second)
      assertEquals("class of $registered", inputClass, classification?.input)
      assertEquals("activity of $registered", activity, classification?.sample?.activity)
      if (activity != null) {
        assertEquals(MotionConfidence.HIGH, classification?.sample?.confidence)
        assertEquals(TRANSITION_TIME_MS, classification?.sample?.timestampMs)
      }
    }
  }

  @Test
  fun `enter still is high-confidence stillness`() {
    val classification = transition(DetectedActivity.STILL, ActivityTransition.ACTIVITY_TRANSITION_ENTER)
    assertEquals(MotionInputClass.STILL_HIGH, classification?.input)
    assertEquals(MotionSample(MotionActivityType.STATIONARY, MotionConfidence.HIGH, TRANSITION_TIME_MS), classification?.sample)
  }

  @Test
  fun `exit transitions are never reported as raw events`() {
    assertNull(transition(DetectedActivity.STILL, ActivityTransition.ACTIVITY_TRANSITION_EXIT)?.sample)
    assertNull(transition(DetectedActivity.IN_VEHICLE, ActivityTransition.ACTIVITY_TRANSITION_EXIT)?.sample)
  }

  @Test
  fun `transitions that were not registered are ignored`() {
    assertNull(transition(DetectedActivity.WALKING, ActivityTransition.ACTIVITY_TRANSITION_EXIT))
    assertNull(transition(DetectedActivity.ON_BICYCLE, ActivityTransition.ACTIVITY_TRANSITION_EXIT))
    assertNull(transition(DetectedActivity.TILTING, ActivityTransition.ACTIVITY_TRANSITION_ENTER))
  }

  @Test
  fun `transition timestamps convert elapsed realtime to wall-clock time`() {
    // The event happened 2 s before "now"
    assertEquals(
      1_700_000_000_000L - 2_000L,
      MotionClassifier.transitionTimestampMs(
        nowMs = 1_700_000_000_000L,
        nowElapsedRealtimeNanos = 5_000_000_000L,
        eventElapsedRealtimeNanos = 3_000_000_000L
      )
    )
  }

  private companion object {
    const val SAMPLE_TIME_MS = 1_700_000_000_000L
    const val TRANSITION_TIME_MS = 1_700_000_100_000L
    const val UNLISTED_TYPE = 99
  }
}
