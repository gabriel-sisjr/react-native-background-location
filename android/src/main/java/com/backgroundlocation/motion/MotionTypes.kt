package com.backgroundlocation.motion

import org.json.JSONObject

/**
 * Motion activity reported to JavaScript. The names are the wire values of the
 * TypeScript `MotionActivityType` enum.
 */
internal enum class MotionActivityType { STATIONARY, WALKING, RUNNING, CYCLING, AUTOMOTIVE, UNKNOWN }

/** Confidence reported with each motion activity (TypeScript `MotionConfidence`). */
internal enum class MotionConfidence { LOW, MEDIUM, HIGH }

/** Motion activity detection status of a session (TypeScript `MotionDetectionStatus`). */
internal enum class MotionDetectionStatus { OFF, RUNNING, UNAVAILABLE, PERMISSION_NOT_GRANTED }

/** Status of the reduction of location updates (TypeScript `MotionReductionStatus`). */
internal enum class MotionReductionStatus { DISABLED, NOT_APPLICABLE, UNAVAILABLE, MONITORING, REDUCED }

/** Motion permission status and its wire string (TypeScript `MotionPermissionStatus`). */
internal enum class MotionPermissionStatus(val wireValue: String) {
  GRANTED("granted"),
  DENIED("denied"),
  UNDETERMINED("undetermined"),
  UNAVAILABLE("unavailable")
}

/** Classifier result as seen by the reduction gate. */
internal enum class MotionInputClass { STILL_HIGH, STILL_MEDIUM, MOVEMENT, VEHICLE }

/** One Activity Recognition `DetectedActivity`, reduced to its type constant and 0-100 confidence. */
internal data class DetectedActivityInput(val type: Int, val confidence: Int)

/**
 * One Activity Recognition transition event, reduced to plain values.
 *
 * @property timestampMs Wall-clock time of the transition in milliseconds since epoch.
 */
internal data class TransitionInput(
  val activityType: Int,
  val transitionType: Int,
  val timestampMs: Long
)

/** A normalized motion activity: the payload of an `onMotionActivity` event without its trip. */
internal data class MotionSample(
  val activity: MotionActivityType,
  val confidence: MotionConfidence,
  val timestampMs: Long
)

/**
 * Classifier output.
 *
 * @property sample Raw activity to report, or `null` when the input must not be reported
 * (transition EXIT events).
 * @property input Class fed to the reduction gate.
 */
internal data class MotionClassification(
  val sample: MotionSample?,
  val input: MotionInputClass
)

/** A raw `onMotionActivity` event of a tracking session. */
internal data class MotionActivityEvent(
  val tripId: String,
  val activity: MotionActivityType,
  val confidence: MotionConfidence,
  val timestampMs: Long
)

/** Work routed from [MotionActivityReceiver] to the active [MotionSession]. */
internal sealed interface MotionDelivery {
  /** A periodic Activity Recognition sample. */
  data class Sample(
    val mostProbable: DetectedActivityInput,
    val probable: List<DetectedActivityInput>,
    val timestampMs: Long
  ) : MotionDelivery

  /** One or more Activity Recognition transitions. */
  data class Transitions(val events: List<TransitionInput>) : MotionDelivery

  /** A gate timer expired; [token] identifies the arming it belongs to. */
  data class Timer(val kind: MotionGate.TimerKind, val token: Long) : MotionDelivery
}

/** Warning types and the exact warning messages of the motion activity feature. */
internal object MotionWarnings {
  const val TYPE_LOCATION_REDUCED = "MOTION_LOCATION_REDUCED"
  const val TYPE_LOCATION_RESTORED = "MOTION_LOCATION_RESTORED"
  const val TYPE_ACTIVITY_UNAVAILABLE = "MOTION_ACTIVITY_UNAVAILABLE"
  const val TYPE_PERMISSION_NOT_GRANTED = "MOTION_PERMISSION_NOT_GRANTED"

  const val PLAY_SERVICES_UNAVAILABLE =
    "Motion activity needs Google Play services, which is not available. Location tracking continues at full accuracy."
  const val PLATFORM_PERMISSION_NOT_GRANTED =
    "ACTIVITY_RECOGNITION permission is not granted. Call requestMotionPermission() before startTracking(). Location tracking continues at full accuracy."
  const val PLAY_SERVICES_PERMISSION_NOT_DECLARED =
    "com.google.android.gms.permission.ACTIVITY_RECOGNITION is not declared in AndroidManifest.xml. Location tracking continues at full accuracy."
  const val PERMISSION_REVOKED =
    "Motion activity permission was revoked. Location tracking continues at full accuracy."

  const val LOCATION_REDUCED = "Device stationary; location updates reduced to save battery."
  const val RESTORED_MOTION = "Movement detected; full-accuracy location updates restored."
  const val RESTORED_DISPLACEMENT =
    "Device moved while updates were reduced; full-accuracy location updates restored."
  const val RESTORED_DETECTION_LOST = "Motion activity stopped; full-accuracy location updates restored."
  const val RESTORED_SESSION_RESTART = "Tracking restarted; full-accuracy location updates restored."

  /** Detail of [couldNotStart] when a gate timer could not be armed. */
  const val DETAIL_ALARM_MANAGER = "AlarmManager"

  /**
   * Message for a registration that could not start; [detail] is `status <code>`, a class
   * name or [DETAIL_ALARM_MANAGER].
   */
  fun couldNotStart(detail: String): String =
    "Motion activity could not start ($detail). Location tracking continues at full accuracy."

  /** Message of a `MOTION_LOCATION_RESTORED` warning for [reason]. */
  fun restored(reason: MotionGate.RestoreReason): String = when (reason) {
    MotionGate.RestoreReason.MOTION -> RESTORED_MOTION
    MotionGate.RestoreReason.DISPLACEMENT -> RESTORED_DISPLACEMENT
    MotionGate.RestoreReason.DETECTION_LOST -> RESTORED_DETECTION_LOST
    MotionGate.RestoreReason.SESSION_RESTART -> RESTORED_SESSION_RESTART
  }
}

/**
 * State returned by `getMotionActivityState()`.
 *
 * Serialized as `{"tripId":string|null,"detection":..,"reduction":..,"lastActivity":{..}|null}`.
 */
internal data class MotionStateSnapshot(
  val tripId: String?,
  val detection: MotionDetectionStatus,
  val reduction: MotionReductionStatus,
  val lastActivity: MotionActivityEvent?
) {
  fun toJsonString(): String {
    val last = lastActivity?.let { event ->
      JSONObject()
        .put("tripId", event.tripId)
        .put("activity", event.activity.name)
        .put("confidence", event.confidence.name)
        .put("timestamp", event.timestampMs)
    }
    return JSONObject()
      .put("tripId", tripId ?: JSONObject.NULL)
      .put("detection", detection.name)
      .put("reduction", reduction.name)
      .put("lastActivity", last ?: JSONObject.NULL)
      .toString()
  }

  companion object {
    /** State when no tracking session has motion activity enabled. */
    val OFF = MotionStateSnapshot(
      tripId = null,
      detection = MotionDetectionStatus.OFF,
      reduction = MotionReductionStatus.DISABLED,
      lastActivity = null
    )

    /** Serialized [OFF] state, available without touching `org.json`. */
    const val OFF_JSON =
      "{\"tripId\":null,\"detection\":\"OFF\",\"reduction\":\"DISABLED\",\"lastActivity\":null}"
  }
}
