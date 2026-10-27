package com.backgroundlocation.motion

import com.google.android.gms.location.ActivityTransition
import com.google.android.gms.location.DetectedActivity

/**
 * Pure normalization of Activity Recognition results into the library's motion model.
 *
 * Inputs are plain values (activity type constants and 0-100 confidences), so the
 * mapping runs without Play services or the Android framework.
 */
internal object MotionClassifier {
  /** Lowest confidence reported as [MotionConfidence.HIGH]. */
  const val HIGH_CONFIDENCE_MIN = 75

  /** Lowest confidence reported as [MotionConfidence.MEDIUM]. */
  const val MEDIUM_CONFIDENCE_MIN = 50

  /** Lowest `IN_VEHICLE` confidence among the probable activities that counts as vehicle evidence. */
  const val VEHICLE_EVIDENCE_MIN = 50

  /** Buckets a 0-100 Activity Recognition confidence. */
  fun confidenceOf(value: Int): MotionConfidence = when {
    value >= HIGH_CONFIDENCE_MIN -> MotionConfidence.HIGH
    value >= MEDIUM_CONFIDENCE_MIN -> MotionConfidence.MEDIUM
    else -> MotionConfidence.LOW
  }

  /**
   * Maps a `DetectedActivity` type. `ON_FOOT` becomes RUNNING only when the probable
   * RUNNING confidence is strictly higher than the WALKING one.
   */
  fun activityOf(type: Int, probable: List<DetectedActivityInput>): MotionActivityType = when (type) {
    DetectedActivity.IN_VEHICLE -> MotionActivityType.AUTOMOTIVE
    DetectedActivity.ON_BICYCLE -> MotionActivityType.CYCLING
    DetectedActivity.RUNNING -> MotionActivityType.RUNNING
    DetectedActivity.WALKING -> MotionActivityType.WALKING
    DetectedActivity.ON_FOOT ->
      if (confidenceFor(DetectedActivity.RUNNING, probable) > confidenceFor(DetectedActivity.WALKING, probable)) {
        MotionActivityType.RUNNING
      } else {
        MotionActivityType.WALKING
      }
    DetectedActivity.STILL -> MotionActivityType.STATIONARY
    // UNKNOWN, TILTING and any type added by a later Play services release
    else -> MotionActivityType.UNKNOWN
  }

  /**
   * Classifies a periodic sample from its most probable activity.
   *
   * Vehicle evidence (the mapped activity is AUTOMOTIVE, or the probable activities
   * hold `IN_VEHICLE` at [VEHICLE_EVIDENCE_MIN] or more) always wins, so a stop at a
   * red light that reads as STILL still counts as driving.
   */
  fun classifySample(
    mostProbable: DetectedActivityInput,
    probable: List<DetectedActivityInput>,
    timestampMs: Long
  ): MotionClassification {
    val activity = activityOf(mostProbable.type, probable)
    val confidence = confidenceOf(mostProbable.confidence)
    val vehicleEvidence = activity == MotionActivityType.AUTOMOTIVE ||
      probable.any { it.type == DetectedActivity.IN_VEHICLE && it.confidence >= VEHICLE_EVIDENCE_MIN }
    val input = when {
      vehicleEvidence -> MotionInputClass.VEHICLE
      activity == MotionActivityType.STATIONARY && confidence == MotionConfidence.HIGH -> MotionInputClass.STILL_HIGH
      activity == MotionActivityType.STATIONARY && confidence == MotionConfidence.MEDIUM -> MotionInputClass.STILL_MEDIUM
      else -> MotionInputClass.MOVEMENT
    }
    return MotionClassification(MotionSample(activity, confidence, timestampMs), input)
  }

  /**
   * Classifies one of the registered transitions. ENTER events are reported with HIGH
   * confidence because the Transition API only fires on committed changes; EXIT events
   * are never reported. Returns `null` for transitions that were not registered.
   */
  fun classifyTransition(event: TransitionInput): MotionClassification? {
    val enter = event.transitionType == ActivityTransition.ACTIVITY_TRANSITION_ENTER
    val exit = event.transitionType == ActivityTransition.ACTIVITY_TRANSITION_EXIT
    return when (event.activityType) {
      DetectedActivity.STILL -> when {
        enter -> reported(MotionActivityType.STATIONARY, event, MotionInputClass.STILL_HIGH)
        exit -> MotionClassification(null, MotionInputClass.MOVEMENT)
        else -> null
      }
      DetectedActivity.IN_VEHICLE -> when {
        enter -> reported(MotionActivityType.AUTOMOTIVE, event, MotionInputClass.VEHICLE)
        exit -> MotionClassification(null, MotionInputClass.VEHICLE)
        else -> null
      }
      DetectedActivity.ON_BICYCLE ->
        if (enter) reported(MotionActivityType.CYCLING, event, MotionInputClass.MOVEMENT) else null
      DetectedActivity.WALKING ->
        if (enter) reported(MotionActivityType.WALKING, event, MotionInputClass.MOVEMENT) else null
      DetectedActivity.RUNNING ->
        if (enter) reported(MotionActivityType.RUNNING, event, MotionInputClass.MOVEMENT) else null
      else -> null
    }
  }

  /**
   * Converts a transition's elapsed-realtime stamp to wall-clock milliseconds:
   * `nowMs - (nowElapsedRealtimeNanos - eventElapsedRealtimeNanos) / 1_000_000`.
   */
  fun transitionTimestampMs(nowMs: Long, nowElapsedRealtimeNanos: Long, eventElapsedRealtimeNanos: Long): Long =
    nowMs - (nowElapsedRealtimeNanos - eventElapsedRealtimeNanos) / 1_000_000

  private fun reported(
    activity: MotionActivityType,
    event: TransitionInput,
    input: MotionInputClass
  ): MotionClassification =
    MotionClassification(MotionSample(activity, MotionConfidence.HIGH, event.timestampMs), input)

  private fun confidenceFor(type: Int, probable: List<DetectedActivityInput>): Int =
    probable.firstOrNull { it.type == type }?.confidence ?: 0
}
