package com.backgroundlocation.motion

import com.backgroundlocation.LocationAccuracy
import kotlin.math.asin
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin
import kotlin.math.sqrt

/**
 * Pure decision function of the opt-in reduction of location updates while stationary.
 *
 * It owns no clock, timer or platform object. The caller feeds classifier results,
 * classified location fixes, timer expirations and lifecycle events, then runs the
 * returned effects in list order (after a FULL fix has been recorded). Every session
 * starts at [start]; the state is never persisted.
 *
 * Reduction is a degradation, never a stop: REDUCED keeps a low-power request alive,
 * PROBING forces one full-accuracy fix after the maximum reduced duration, and any
 * movement, vehicle evidence or displacement restores full accuracy.
 */
internal object MotionGate {
  /** Minimum displacement that counts as movement, whatever the reported accuracies. */
  const val MIN_MOVEMENT_M = 100.0

  /** Worst raw accuracy a probe fix may have to send the gate back to REDUCED. */
  const val PROBE_MAX_ACCURACY_M = 100.0

  /** Duration of the PROBE timer. */
  const val PROBE_TIMEOUT_MS = 120_000L

  private const val EARTH_RADIUS_M = 6_371_000.0

  enum class Mode { OFF, MONITORING, CANDIDATE, REDUCED, PROBING }

  /** FULL fixes come from the full-accuracy request; KEEPALIVE fixes only keep the app alive. */
  enum class FixKind { FULL, KEEPALIVE }

  enum class TimerKind { DWELL, COOLDOWN, MAX_REDUCED, PROBE }

  enum class RestoreReason { MOTION, DISPLACEMENT, DETECTION_LOST, SESSION_RESTART }

  /** Whether a trip can have a gate at all. */
  enum class Applicability { NOT_REQUESTED, NOT_APPLICABLE, APPLICABLE }

  /**
   * A classified location fix.
   *
   * @property accuracyM Uncertainty used by [moved]: for a FULL fix its own accuracy widened by
   * the trip's distance filter ([fullFixAccuracy]), for a KEEPALIVE fix its own accuracy.
   * @property rawAccuracyM The fix's own horizontal accuracy, never widened. It decides whether
   * a probe fix is accurate enough. Defaults to [accuracyM] (no distance filter).
   */
  data class GateFix(
    val lat: Double,
    val lon: Double,
    val accuracyM: Double,
    val kind: FixKind,
    val rawAccuracyM: Double = accuracyM
  )

  data class State(
    val mode: Mode,
    val vehicleRecent: Boolean = false,
    val dwellDone: Boolean = false,
    val anchor: GateFix? = null,
    val lastFullFix: GateFix? = null
  )

  sealed interface Input {
    /** STATIONARY with HIGH confidence and no vehicle evidence; transition ENTER STILL. */
    data object StillHigh : Input

    /** STATIONARY with MEDIUM confidence and no vehicle evidence. */
    data object StillMedium : Input

    /** Walking, running, cycling, UNKNOWN, low-confidence STATIONARY, EXIT STILL. */
    data object Movement : Input

    /** Any vehicle evidence. */
    data object Vehicle : Input

    data class Fix(val fix: GateFix) : Input

    data class Timer(val kind: TimerKind) : Input

    data object Restart : Input

    data object DetectionLost : Input

    data object Stop : Input
  }

  sealed interface Effect {
    /** Starts the timer, replacing an armed timer of the same kind. */
    data class StartTimer(val kind: TimerKind) : Effect

    data class CancelTimer(val kind: TimerKind) : Effect

    data object CancelAllTimers : Effect

    data object FlushStorage : Effect

    data object ApplyReducedProfile : Effect

    data object ApplyFullProfile : Effect

    data object EmitReduced : Effect

    data class EmitRestored(val reason: RestoreReason) : Effect
  }

  data class Decision(val state: State, val effects: List<Effect>)

  /** First decision of every session: no reduction during the first cooldown. */
  fun start(): Decision = Decision(
    State(mode = Mode.MONITORING, vehicleRecent = true),
    listOf(Effect.StartTimer(TimerKind.COOLDOWN))
  )

  /**
   * A trip has a gate only when the reduction was requested and the trip is neither
   * `foregroundOnly` nor running at `PASSIVE` / `NO_POWER` accuracy.
   */
  fun applicability(
    reductionRequested: Boolean,
    foregroundOnly: Boolean,
    accuracy: LocationAccuracy
  ): Applicability = when {
    !reductionRequested -> Applicability.NOT_REQUESTED
    foregroundOnly || accuracy == LocationAccuracy.PASSIVE || accuracy == LocationAccuracy.NO_POWER ->
      Applicability.NOT_APPLICABLE
    else -> Applicability.APPLICABLE
  }

  /** Maps a classifier result to its gate input. */
  fun inputOf(inputClass: MotionInputClass): Input = when (inputClass) {
    MotionInputClass.STILL_HIGH -> Input.StillHigh
    MotionInputClass.STILL_MEDIUM -> Input.StillMedium
    MotionInputClass.MOVEMENT -> Input.Movement
    MotionInputClass.VEHICLE -> Input.Vehicle
  }

  /**
   * Uncertainty of a FULL fix for [moved]: its own accuracy plus the trip's distance filter.
   * With a distance filter the last delivered fix can lie up to that distance short of where the
   * device stopped, so the error circle has to cover it. Negative and NaN values count as 0; an
   * unknown accuracy (infinity) stays infinite.
   */
  fun fullFixAccuracy(accuracyM: Double, distanceFilterM: Double): Double =
    nonNegative(accuracyM) + nonNegative(distanceFilterM)

  /** True when the error circles of [anchor] and [fix] no longer overlap (and they are 100 m+ apart). */
  fun moved(anchor: GateFix?, fix: GateFix): Boolean =
    anchor != null && distanceM(anchor, fix) > max(MIN_MOVEMENT_M, anchor.accuracyM + fix.accuracyM)

  /** Haversine distance in metres. */
  fun distanceM(a: GateFix, b: GateFix): Double {
    val dLat = Math.toRadians(b.lat - a.lat)
    val dLon = Math.toRadians(b.lon - a.lon)
    val h = sin(dLat / 2) * sin(dLat / 2) +
      cos(Math.toRadians(a.lat)) * cos(Math.toRadians(b.lat)) * sin(dLon / 2) * sin(dLon / 2)
    return 2 * EARTH_RADIUS_M * asin(min(1.0, sqrt(h)))
  }

  fun decide(state: State, input: Input): Decision = when (input) {
    Input.Stop -> Decision(State(mode = Mode.OFF), listOf(Effect.CancelAllTimers))
    Input.Restart -> restart(state)
    else -> if (state.mode == Mode.OFF) unchanged(state) else decideActive(state, input)
  }

  private fun decideActive(state: State, input: Input): Decision = when (input) {
    Input.DetectionLost -> detectionLost(state)
    Input.Vehicle -> vehicle(state)
    Input.StillHigh -> stillHigh(state)
    Input.StillMedium -> stillMedium(state)
    Input.Movement -> movement(state)
    is Input.Fix -> fix(state, input.fix)
    is Input.Timer -> timer(state, input.kind)
    Input.Restart, Input.Stop -> unchanged(state)
  }

  private fun restart(state: State): Decision {
    val fresh = start()
    val effects = buildList<Effect> {
      when (state.mode) {
        Mode.REDUCED -> {
          add(Effect.ApplyFullProfile)
          add(Effect.CancelAllTimers)
          add(Effect.EmitRestored(RestoreReason.SESSION_RESTART))
        }
        Mode.PROBING -> {
          add(Effect.CancelAllTimers)
          add(Effect.EmitRestored(RestoreReason.SESSION_RESTART))
        }
        else -> add(Effect.CancelAllTimers)
      }
      addAll(fresh.effects)
    }
    return Decision(fresh.state, effects)
  }

  private fun detectionLost(state: State): Decision {
    val effects = when (state.mode) {
      Mode.REDUCED -> listOf(
        Effect.ApplyFullProfile,
        Effect.CancelAllTimers,
        Effect.EmitRestored(RestoreReason.DETECTION_LOST)
      )
      Mode.PROBING -> listOf(Effect.CancelAllTimers, Effect.EmitRestored(RestoreReason.DETECTION_LOST))
      else -> listOf(Effect.CancelAllTimers)
    }
    return Decision(State(mode = Mode.OFF), effects)
  }

  private fun vehicle(state: State): Decision {
    val base = when (state.mode) {
      Mode.CANDIDATE -> Decision(monitoring(state), listOf(Effect.CancelTimer(TimerKind.DWELL)))
      Mode.REDUCED -> restore(state, RestoreReason.MOTION)
      Mode.PROBING -> Decision(
        monitoring(state),
        listOf(Effect.CancelTimer(TimerKind.PROBE), Effect.EmitRestored(RestoreReason.MOTION))
      )
      else -> unchanged(state)
    }
    // Every vehicle evidence (re)starts the cooldown, whatever the mode.
    return Decision(
      base.state.copy(vehicleRecent = true),
      base.effects + Effect.StartTimer(TimerKind.COOLDOWN)
    )
  }

  private fun stillHigh(state: State): Decision = when (state.mode) {
    Mode.MONITORING -> Decision(
      state.copy(mode = Mode.CANDIDATE, dwellDone = false, anchor = state.lastFullFix),
      listOf(Effect.StartTimer(TimerKind.DWELL))
    )
    // CANDIDATE keeps dwelling; REDUCED and PROBING stay put.
    else -> unchanged(state)
  }

  private fun stillMedium(state: State): Decision = when (state.mode) {
    Mode.CANDIDATE -> Decision(monitoring(state), listOf(Effect.CancelTimer(TimerKind.DWELL)))
    else -> unchanged(state)
  }

  private fun movement(state: State): Decision = when (state.mode) {
    Mode.CANDIDATE -> Decision(monitoring(state), listOf(Effect.CancelTimer(TimerKind.DWELL)))
    Mode.REDUCED -> restore(state, RestoreReason.MOTION)
    Mode.PROBING -> Decision(
      monitoring(state),
      listOf(Effect.CancelTimer(TimerKind.PROBE), Effect.EmitRestored(RestoreReason.MOTION))
    )
    else -> unchanged(state)
  }

  private fun fix(state: State, fix: GateFix): Decision {
    val full = fix.kind == FixKind.FULL
    return when (state.mode) {
      Mode.MONITORING -> if (full) Decision(state.copy(lastFullFix = fix), emptyList()) else unchanged(state)
      Mode.CANDIDATE -> when {
        // A keep-alive fix predates the last full-accuracy restore: no evidence for the dwell.
        !full -> unchanged(state)
        state.anchor == null -> tryReduce(state.copy(anchor = fix, lastFullFix = fix))
        moved(state.anchor, fix) -> Decision(
          monitoring(state).copy(lastFullFix = fix),
          listOf(Effect.CancelTimer(TimerKind.DWELL))
        )
        else -> Decision(state.copy(lastFullFix = fix), emptyList())
      }
      Mode.REDUCED -> if (moved(state.anchor, fix)) {
        // Safety net when the classifier stops reporting while the device moves.
        val restored = restore(state, RestoreReason.DISPLACEMENT)
        if (full) restored.copy(state = restored.state.copy(lastFullFix = fix)) else restored
      } else {
        unchanged(state)
      }
      Mode.PROBING -> when {
        moved(state.anchor, fix) -> {
          val next = monitoring(state)
          Decision(
            if (full) next.copy(lastFullFix = fix) else next,
            listOf(Effect.CancelTimer(TimerKind.PROBE), Effect.EmitRestored(RestoreReason.DISPLACEMENT))
          )
        }
        // The forced fix: recorded by the caller, then back to the low-power request. Its quality
        // is judged on its own accuracy; the anchor keeps the widened error circle.
        full && fix.rawAccuracyM <= PROBE_MAX_ACCURACY_M -> Decision(
          state.copy(mode = Mode.REDUCED, anchor = fix, lastFullFix = fix),
          listOf(
            Effect.FlushStorage,
            Effect.ApplyReducedProfile,
            Effect.CancelTimer(TimerKind.PROBE),
            Effect.StartTimer(TimerKind.MAX_REDUCED)
          )
        )
        full -> Decision(state.copy(lastFullFix = fix), emptyList())
        else -> unchanged(state)
      }
      Mode.OFF -> unchanged(state)
    }
  }

  private fun timer(state: State, kind: TimerKind): Decision = when (kind) {
    TimerKind.COOLDOWN -> {
      val cleared = state.copy(vehicleRecent = false)
      if (state.mode == Mode.CANDIDATE) tryReduce(cleared) else Decision(cleared, emptyList())
    }
    TimerKind.DWELL ->
      if (state.mode == Mode.CANDIDATE) tryReduce(state.copy(dwellDone = true)) else unchanged(state)
    TimerKind.MAX_REDUCED ->
      if (state.mode == Mode.REDUCED) {
        Decision(
          state.copy(mode = Mode.PROBING),
          listOf(Effect.ApplyFullProfile, Effect.StartTimer(TimerKind.PROBE))
        )
      } else {
        unchanged(state)
      }
    TimerKind.PROBE ->
      if (state.mode == Mode.PROBING) {
        Decision(
          state.copy(mode = Mode.REDUCED),
          listOf(Effect.ApplyReducedProfile, Effect.StartTimer(TimerKind.MAX_REDUCED))
        )
      } else {
        unchanged(state)
      }
  }

  private fun tryReduce(state: State): Decision =
    if (state.dwellDone && !state.vehicleRecent && state.anchor != null) {
      Decision(
        state.copy(mode = Mode.REDUCED),
        listOf(
          Effect.FlushStorage,
          Effect.ApplyReducedProfile,
          Effect.StartTimer(TimerKind.MAX_REDUCED),
          Effect.EmitReduced
        )
      )
    } else {
      Decision(state, emptyList())
    }

  private fun restore(state: State, reason: RestoreReason): Decision = Decision(
    monitoring(state),
    listOf(Effect.ApplyFullProfile, Effect.CancelTimer(TimerKind.MAX_REDUCED), Effect.EmitRestored(reason))
  )

  private fun monitoring(state: State): State =
    state.copy(mode = Mode.MONITORING, dwellDone = false, anchor = null)

  private fun unchanged(state: State): Decision = Decision(state, emptyList())

  private fun nonNegative(value: Double): Double = if (value > 0.0) value else 0.0
}
