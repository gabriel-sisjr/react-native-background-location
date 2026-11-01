package com.backgroundlocation.motion

import android.util.Log
import com.backgroundlocation.BuildConfig
import com.backgroundlocation.LocationEventEmitter
import com.backgroundlocation.TrackingOptions
import com.google.android.gms.common.api.ApiException
import java.util.EnumMap
import java.util.concurrent.atomic.AtomicLong

/** Platform facts a [MotionSession] depends on. */
internal interface MotionPlatform {
  val sdkInt: Int

  fun isPlayServicesAvailable(): Boolean

  fun isGranted(permission: String): Boolean

  /** Debug-build check that the caller runs on the main thread; a no-op by default. */
  fun assertMainThread() {}
}

/**
 * Activity Recognition registrations of a session. Implementations own their
 * PendingIntents. Requests may throw synchronously; asynchronous failures are reported
 * through `onFailure` on the main thread.
 */
internal interface MotionRecognitionClient {
  fun requestActivityUpdates(intervalMs: Long, onFailure: (Exception) -> Unit)

  fun requestTransitionUpdates(onFailure: (Exception) -> Unit)

  fun removeActivityUpdates()

  fun removeTransitionUpdates()
}

/**
 * Gate timers. An expired timer comes back through [MotionSession.deliver] as a
 * [MotionDelivery.Timer] carrying the token it was armed with.
 */
internal interface MotionTimers {
  /**
   * Arms [kind], replacing an armed timer of the same kind. Returns false when the timer could
   * not be armed; the session then ends detection and tracking stays at full accuracy.
   */
  fun start(kind: MotionGate.TimerKind, durationMs: Long, token: Long): Boolean

  fun cancel(kind: MotionGate.TimerKind)

  fun cancelAll()
}

/** Location-pipeline side effects that the host service performs for the gate. */
internal interface MotionHost {
  fun applyReducedProfile()

  fun applyFullProfile()

  fun flushStorage()

  fun showReducedNotification(text: String)

  fun showBaseNotification()
}

/** Session outputs towards JavaScript. */
internal interface MotionEventSink {
  fun emitMotionActivity(event: MotionActivityEvent)

  fun emitWarning(tripId: String, type: String, message: String)

  fun publishState(snapshot: MotionStateSnapshot)
}

/** Default sink: [LocationEventEmitter] events and the [MotionStateStore] snapshot. */
internal object FlowMotionEventSink : MotionEventSink {
  override fun emitMotionActivity(event: MotionActivityEvent) {
    LocationEventEmitter.emitMotionActivity(
      tripId = event.tripId,
      activity = event.activity.name,
      confidence = event.confidence.name,
      timestamp = event.timestampMs
    )
  }

  override fun emitWarning(tripId: String, type: String, message: String) {
    LocationEventEmitter.emitWarning(tripId, type, message)
  }

  override fun publishState(snapshot: MotionStateSnapshot) {
    MotionStateStore.publish(snapshot)
  }
}

/** Latest serialized motion state, published by the service and read by `getMotionActivityState()`. */
internal object MotionStateStore {
  @Volatile
  var json: String = MotionStateSnapshot.OFF_JSON
    private set

  fun publish(snapshot: MotionStateSnapshot) {
    json = if (snapshot == MotionStateSnapshot.OFF) MotionStateSnapshot.OFF_JSON else snapshot.toJsonString()
  }
}

/**
 * Motion activity session of one `LocationService` instance, confined to the main thread.
 *
 * With motion off the session only clears stale registrations, so no Activity
 * Recognition client is ever created. With motion on it checks Play services and the
 * permission, registers periodic samples and transitions, reports de-duplicated
 * `onMotionActivity` events and, when the trip allows it, drives [MotionGate].
 * Every failure degrades to continuous full-accuracy tracking with at most one
 * detection warning per session.
 */
internal class MotionSession(
  private val platform: MotionPlatform,
  private val clientFactory: () -> MotionRecognitionClient,
  private val timers: MotionTimers,
  private val host: MotionHost,
  private val sink: MotionEventSink,
  private val removeStale: () -> Unit,
  private val isStopRequested: () -> Boolean,
  private val elapsedRealtimeNanos: () -> Long
) {
  /** STOP ends silently; RESTART announces the end of a reduction (SESSION_RESTART). */
  enum class StopReason { STOP, RESTART }

  private var active = false
  private var tripId: String? = null
  private var options: MotionOptions? = null
  private var applicability = MotionGate.Applicability.NOT_REQUESTED
  private var detection = MotionDetectionStatus.OFF
  private var gate: MotionGate.State? = null
  private var client: MotionRecognitionClient? = null
  private var detectionWarningSent = false
  private var lastActivity: MotionActivityEvent? = null
  private var fullProfileSinceNanos = 0L
  private var distanceFilterM = 0.0
  private var generation = 0L
  private val armedTimers = EnumMap<MotionGate.TimerKind, Long>(MotionGate.TimerKind::class.java)

  /** True while a session with motion activity enabled exists. */
  val isActive: Boolean
    get() = active

  /** Current gate mode, or `null` when the session has no gate. */
  val gateMode: MotionGate.Mode?
    get() = gate?.mode

  /**
   * Starts a fresh session for [tripId]. Call it after location updates were requested.
   * Never throws: every failure becomes a warning and continuous full-accuracy tracking.
   */
  fun start(tripId: String, trackingOptions: TrackingOptions) {
    platform.assertMainThread()
    stop(StopReason.STOP)
    generation++
    val motion = trackingOptions.motion
    if (motion == null) {
      removeStale()
      sink.publishState(MotionStateSnapshot.OFF)
      return
    }

    active = true
    this.tripId = tripId
    options = motion
    // The distance filter of the full-accuracy request, the source of every FULL fix
    distanceFilterM = trackingOptions.getDistanceFilterOrDefault().toDouble()
    applicability = MotionGate.applicability(
      reductionRequested = motion.reduceWhenStationary,
      foregroundOnly = trackingOptions.getForegroundOnlyOrDefault(),
      accuracy = trackingOptions.getAccuracyOrDefault()
    )
    detectionWarningSent = false
    lastActivity = null
    fullProfileSinceNanos = 0L
    // Alarms armed by an earlier process are never valid for a new session.
    timers.cancelAll()

    if (!platform.isPlayServicesAvailable()) {
      failDetection(
        MotionDetectionStatus.UNAVAILABLE,
        MotionWarnings.TYPE_ACTIVITY_UNAVAILABLE,
        MotionWarnings.PLAY_SERVICES_UNAVAILABLE
      )
      return
    }
    if (!platform.isGranted(MotionPermissions.requiredPermission(platform.sdkInt))) {
      failDetection(
        MotionDetectionStatus.PERMISSION_NOT_GRANTED,
        MotionWarnings.TYPE_PERMISSION_NOT_GRANTED,
        MotionPermissions.notGrantedMessage(platform.sdkInt)
      )
      return
    }

    val registration = generation
    detection = MotionDetectionStatus.RUNNING
    try {
      val created = clientFactory()
      client = created
      created.requestActivityUpdates(motion.sampleIntervalMs) { error -> onRegistrationFailed(registration, error) }
      created.requestTransitionUpdates { error -> onRegistrationFailed(registration, error) }
    } catch (e: Exception) {
      loseDetection(e)
      return
    }
    if (detection != MotionDetectionStatus.RUNNING) return

    if (applicability == MotionGate.Applicability.APPLICABLE) {
      apply(MotionGate.start())
    } else {
      publish()
    }
  }

  /**
   * Ends the session: removes both registrations, cancels every timer and publishes the
   * OFF state. With [StopReason.RESTART] a REDUCED or PROBING gate first restores full
   * accuracy and emits `MOTION_LOCATION_RESTORED` (SESSION_RESTART).
   */
  fun stop(reason: StopReason) {
    platform.assertMainThread()
    if (!active) return
    gate?.let { current ->
      val reduced = current.mode == MotionGate.Mode.REDUCED || current.mode == MotionGate.Mode.PROBING
      val effects = if (reason == StopReason.RESTART && reduced) {
        // The next session starts its own cooldown, so the fresh timer is not armed here.
        MotionGate.decide(current, MotionGate.Input.Restart).effects
          .filterNot { it is MotionGate.Effect.StartTimer }
      } else {
        MotionGate.decide(current, MotionGate.Input.Stop).effects
      }
      runEffects(effects)
    }
    gate = null
    disarmAll()
    teardownRegistrations()
    active = false
    detection = MotionDetectionStatus.OFF
    applicability = MotionGate.Applicability.NOT_REQUESTED
    options = null
    lastActivity = null
    distanceFilterM = 0.0
    tripId = null
    generation++
    sink.publishState(MotionStateSnapshot.OFF)
  }

  /** Routes a receiver delivery. Ignored after a stop request or while detection is not running. */
  fun deliver(delivery: MotionDelivery) {
    platform.assertMainThread()
    if (!active || detection != MotionDetectionStatus.RUNNING || isStopRequested()) return
    when (delivery) {
      is MotionDelivery.Sample -> handle(
        MotionClassifier.classifySample(delivery.mostProbable, delivery.probable, delivery.timestampMs)
      )
      is MotionDelivery.Transitions -> delivery.events.forEach { event ->
        MotionClassifier.classifyTransition(event)?.let(::handle)
      }
      is MotionDelivery.Timer -> onTimer(delivery.kind, delivery.token)
    }
  }

  /**
   * Classifies a location fix for the gate. Returns `null` when the session has no gate,
   * in which case the fix follows the normal pipeline. KEEPALIVE fixes (taken while
   * REDUCED, or older than the last full-accuracy restore) are never stored or emitted.
   */
  fun classifyFix(fixElapsedRealtimeNanos: Long): MotionGate.FixKind? {
    val current = gate ?: return null
    if (!active) return null
    return if (current.mode == MotionGate.Mode.REDUCED || fixElapsedRealtimeNanos < fullProfileSinceNanos) {
      MotionGate.FixKind.KEEPALIVE
    } else {
      MotionGate.FixKind.FULL
    }
  }

  /**
   * Routes one location fix of the host. A KEEPALIVE fix only feeds the gate and is never
   * recorded. Any other fix goes through [record] first; a FULL fix then feeds the gate only
   * once recorded, so the effects it triggers (flush, reduced profile) run after it was
   * buffered. [record] returns the recorded fix, or `null` when it was filtered or dropped.
   */
  inline fun <T : Any> routeFix(
    fix: T,
    fixElapsedRealtimeNanos: Long,
    record: (T) -> T?,
    feed: (T, MotionGate.FixKind) -> Unit
  ) {
    val kind = classifyFix(fixElapsedRealtimeNanos)
    if (kind == MotionGate.FixKind.KEEPALIVE) {
      feed(fix, kind)
      return
    }
    val recorded = record(fix) ?: return
    if (kind == MotionGate.FixKind.FULL) feed(recorded, kind)
  }

  /**
   * Feeds a classified fix to the gate. [rawAccuracyM] is the fix's own horizontal accuracy; the
   * error circle of a FULL fix also covers the trip's distance filter. A FULL fix must already
   * be recorded. No coordinates are logged.
   */
  fun onFix(latitude: Double, longitude: Double, rawAccuracyM: Double, kind: MotionGate.FixKind) {
    platform.assertMainThread()
    if (!active || isStopRequested()) return
    val current = gate ?: return
    val accuracyM = if (kind == MotionGate.FixKind.FULL) {
      MotionGate.fullFixAccuracy(rawAccuracyM, distanceFilterM)
    } else {
      rawAccuracyM
    }
    val fix = MotionGate.GateFix(latitude, longitude, accuracyM, kind, rawAccuracyM)
    apply(MotionGate.decide(current, MotionGate.Input.Fix(fix)))
  }

  /** Current state, as returned by `getMotionActivityState()`. */
  fun snapshot(): MotionStateSnapshot =
    if (!active) {
      MotionStateSnapshot.OFF
    } else {
      MotionStateSnapshot(tripId, detection, reductionStatus(), lastActivity)
    }

  private fun handle(classification: MotionClassification) {
    // A timer that cannot be armed ends detection, possibly in the middle of a transition batch
    if (detection != MotionDetectionStatus.RUNNING) return
    classification.sample?.let(::report)
    gate?.let { apply(MotionGate.decide(it, MotionGate.inputOf(classification.input))) }
  }

  private fun report(sample: MotionSample) {
    val trip = tripId ?: return
    val last = lastActivity
    if (last != null && last.activity == sample.activity && last.confidence == sample.confidence) return
    val event = MotionActivityEvent(trip, sample.activity, sample.confidence, sample.timestampMs)
    lastActivity = event
    if (BuildConfig.DEBUG) {
      Log.d(TAG, "Motion activity ${event.activity} (${event.confidence})")
    }
    sink.emitMotionActivity(event)
    publish()
  }

  private fun onTimer(kind: MotionGate.TimerKind, token: Long) {
    // A cancelled, replaced or foreign arming is never acted upon.
    if (armedTimers[kind] != token) return
    armedTimers.remove(kind)
    val current = gate ?: return
    if (kind == MotionGate.TimerKind.MAX_REDUCED &&
      !platform.isGranted(MotionPermissions.requiredPermission(platform.sdkInt))
    ) {
      loseDetection(SecurityException("Motion activity permission is no longer granted"))
      return
    }
    apply(MotionGate.decide(current, MotionGate.Input.Timer(kind)))
  }

  private fun onRegistrationFailed(registration: Long, error: Exception) {
    if (registration != generation || !active || detection != MotionDetectionStatus.RUNNING) return
    loseDetection(error)
  }

  /** Detection stopped after it started: restore full accuracy first, then report the cause. */
  private fun loseDetection(error: Exception) {
    Log.w(TAG, "Motion activity detection stopped: ${error.javaClass.name}")
    if (error is SecurityException) {
      endDetection(
        MotionDetectionStatus.PERMISSION_NOT_GRANTED,
        MotionWarnings.TYPE_PERMISSION_NOT_GRANTED,
        MotionWarnings.PERMISSION_REVOKED
      )
    } else {
      endDetection(
        MotionDetectionStatus.UNAVAILABLE,
        MotionWarnings.TYPE_ACTIVITY_UNAVAILABLE,
        MotionWarnings.couldNotStart(detailOf(error))
      )
    }
  }

  /** A gate timer could not be armed: without its timers the gate has no bound, so detection ends. */
  private fun loseTimers() {
    Log.w(TAG, "Motion activity detection stopped: a gate timer could not be armed")
    endDetection(
      MotionDetectionStatus.UNAVAILABLE,
      MotionWarnings.TYPE_ACTIVITY_UNAVAILABLE,
      MotionWarnings.couldNotStart(MotionWarnings.DETAIL_ALARM_MANAGER)
    )
  }

  /** Gate input DETECTION_LOST (restores full accuracy first), teardown, then the cause warning. */
  private fun endDetection(status: MotionDetectionStatus, type: String, message: String) {
    gate?.let { runEffects(MotionGate.decide(it, MotionGate.Input.DetectionLost).effects) }
    gate = null
    disarmAll()
    teardownRegistrations()
    failDetection(status, type, message)
  }

  private fun failDetection(status: MotionDetectionStatus, type: String, message: String) {
    detection = status
    if (!detectionWarningSent) {
      detectionWarningSent = true
      warn(type, message)
    }
    publish()
  }

  private fun apply(decision: MotionGate.Decision) {
    val previous = gate?.mode
    gate = decision.state.takeIf { it.mode != MotionGate.Mode.OFF }
    val timersArmed = runEffects(decision.effects)
    if (BuildConfig.DEBUG && previous != gate?.mode) {
      Log.d(TAG, "Reduction gate $previous -> ${gate?.mode}")
    }
    if (!timersArmed) {
      // Only after the whole decision ran, so the gate state matches the applied profile
      loseTimers()
      return
    }
    publish()
  }

  /** Runs [effects] in list order. Returns false when a gate timer could not be armed. */
  private fun runEffects(effects: List<MotionGate.Effect>): Boolean {
    var timersArmed = true
    for (effect in effects) {
      when (effect) {
        is MotionGate.Effect.StartTimer -> if (!arm(effect.kind)) timersArmed = false
        is MotionGate.Effect.CancelTimer -> disarm(effect.kind)
        MotionGate.Effect.CancelAllTimers -> disarmAll()
        MotionGate.Effect.FlushStorage -> host.flushStorage()
        MotionGate.Effect.ApplyReducedProfile -> host.applyReducedProfile()
        MotionGate.Effect.ApplyFullProfile -> {
          fullProfileSinceNanos = elapsedRealtimeNanos()
          host.applyFullProfile()
        }
        MotionGate.Effect.EmitReduced -> {
          warn(MotionWarnings.TYPE_LOCATION_REDUCED, MotionWarnings.LOCATION_REDUCED)
          if (!isStopRequested()) {
            host.showReducedNotification(
              options?.reducedNotificationTextOrDefault ?: MotionOptions.DEFAULT_REDUCED_NOTIFICATION_TEXT
            )
          }
        }
        is MotionGate.Effect.EmitRestored -> {
          warn(MotionWarnings.TYPE_LOCATION_RESTORED, MotionWarnings.restored(effect.reason))
          if (!isStopRequested()) host.showBaseNotification()
        }
      }
    }
    return timersArmed
  }

  /** Arms [kind] with a fresh token. Returns false when the platform could not arm it. */
  private fun arm(kind: MotionGate.TimerKind): Boolean {
    val motion = options ?: return false
    val token = tokens.incrementAndGet()
    armedTimers[kind] = token
    if (timers.start(kind, durationOf(kind, motion), token)) return true
    // No delivery of this kind is acted upon any more
    armedTimers.remove(kind)
    return false
  }

  private fun disarm(kind: MotionGate.TimerKind) {
    if (armedTimers.remove(kind) != null) timers.cancel(kind)
  }

  private fun disarmAll() {
    armedTimers.clear()
    timers.cancelAll()
  }

  private fun teardownRegistrations() {
    val current = client ?: return
    client = null
    try {
      current.removeActivityUpdates()
    } catch (e: Exception) {
      Log.w(TAG, "Failed to remove motion activity samples", e)
    }
    try {
      current.removeTransitionUpdates()
    } catch (e: Exception) {
      Log.w(TAG, "Failed to remove motion activity transitions", e)
    }
  }

  private fun warn(type: String, message: String) {
    val trip = tripId
    if (trip.isNullOrEmpty() || isStopRequested()) return
    sink.emitWarning(trip, type, message)
  }

  private fun publish() {
    sink.publishState(snapshot())
  }

  private fun reductionStatus(): MotionReductionStatus = when {
    applicability == MotionGate.Applicability.NOT_REQUESTED -> MotionReductionStatus.DISABLED
    applicability == MotionGate.Applicability.NOT_APPLICABLE -> MotionReductionStatus.NOT_APPLICABLE
    detection != MotionDetectionStatus.RUNNING -> MotionReductionStatus.UNAVAILABLE
    else -> when (gate?.mode) {
      MotionGate.Mode.REDUCED, MotionGate.Mode.PROBING -> MotionReductionStatus.REDUCED
      MotionGate.Mode.MONITORING, MotionGate.Mode.CANDIDATE -> MotionReductionStatus.MONITORING
      MotionGate.Mode.OFF, null -> MotionReductionStatus.UNAVAILABLE
    }
  }

  private fun durationOf(kind: MotionGate.TimerKind, motion: MotionOptions): Long = when (kind) {
    MotionGate.TimerKind.DWELL -> motion.stationaryDelayMs
    MotionGate.TimerKind.COOLDOWN -> motion.automotiveCooldownMs
    MotionGate.TimerKind.MAX_REDUCED -> motion.maxReducedDurationMs
    MotionGate.TimerKind.PROBE -> MotionGate.PROBE_TIMEOUT_MS
  }

  private fun detailOf(error: Exception): String = when (error) {
    is ApiException -> "status ${error.statusCode}"
    else -> error.javaClass.simpleName.ifEmpty { error.javaClass.name }
  }

  private companion object {
    const val TAG = "MotionSession"

    /** Process-wide arming tokens; seeded from the monotonic clock so a new process never reuses one. */
    val tokens = AtomicLong(System.nanoTime())
  }
}
