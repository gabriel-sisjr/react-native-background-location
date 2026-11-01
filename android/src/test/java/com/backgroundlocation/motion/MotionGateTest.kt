package com.backgroundlocation.motion

import com.backgroundlocation.LocationAccuracy
import com.backgroundlocation.motion.MotionGate.Applicability
import com.backgroundlocation.motion.MotionGate.Decision
import com.backgroundlocation.motion.MotionGate.Effect
import com.backgroundlocation.motion.MotionGate.FixKind
import com.backgroundlocation.motion.MotionGate.GateFix
import com.backgroundlocation.motion.MotionGate.Input
import com.backgroundlocation.motion.MotionGate.Mode
import com.backgroundlocation.motion.MotionGate.RestoreReason
import com.backgroundlocation.motion.MotionGate.State
import com.backgroundlocation.motion.MotionGate.TimerKind
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Truth table of the reduction gate: one test per row, same IDs on both platforms.
 */
class MotionGateTest {

  // On the equator 0.0005 degrees of latitude is about 56 m and 0.01 degrees about 1.1 km.
  private val anchorFix = GateFix(lat = 0.0, lon = 0.0, accuracyM = 10.0, kind = FixKind.FULL)
  private val nearFull = GateFix(lat = 0.0005, lon = 0.0, accuracyM = 10.0, kind = FixKind.FULL)
  private val farFull = GateFix(lat = 0.01, lon = 0.0, accuracyM = 10.0, kind = FixKind.FULL)
  private val nearKeepAlive = GateFix(lat = 0.0005, lon = 0.0, accuracyM = 40.0, kind = FixKind.KEEPALIVE)
  private val farKeepAlive = GateFix(lat = 0.01, lon = 0.0, accuracyM = 300.0, kind = FixKind.KEEPALIVE)

  private val reduceEffects = listOf(
    Effect.FlushStorage,
    Effect.ApplyReducedProfile,
    Effect.StartTimer(TimerKind.MAX_REDUCED),
    Effect.EmitReduced
  )

  private fun monitoring(vehicleRecent: Boolean = false) =
    State(mode = Mode.MONITORING, vehicleRecent = vehicleRecent, lastFullFix = anchorFix)

  private fun candidate(
    dwellDone: Boolean = true,
    vehicleRecent: Boolean = false,
    anchor: GateFix? = anchorFix
  ) = State(
    mode = Mode.CANDIDATE,
    vehicleRecent = vehicleRecent,
    dwellDone = dwellDone,
    anchor = anchor,
    lastFullFix = anchor
  )

  private fun reduced(vehicleRecent: Boolean = false) = State(
    mode = Mode.REDUCED,
    vehicleRecent = vehicleRecent,
    dwellDone = true,
    anchor = anchorFix,
    lastFullFix = anchorFix
  )

  private fun probing(vehicleRecent: Boolean = false) = reduced(vehicleRecent).copy(mode = Mode.PROBING)

  private fun stateIn(mode: Mode): State = when (mode) {
    Mode.OFF -> State(mode = Mode.OFF)
    Mode.MONITORING -> monitoring()
    Mode.CANDIDATE -> candidate()
    Mode.REDUCED -> reduced()
    Mode.PROBING -> probing()
  }

  private fun decide(state: State, input: Input): Decision = MotionGate.decide(state, input)

  private fun assertUnchanged(state: State, input: Input) {
    assertEquals("$input in ${state.mode}", Decision(state, emptyList()), decide(state, input))
  }

  private fun restoredMonitoring(state: State) = state.copy(mode = Mode.MONITORING, dwellDone = false, anchor = null)

  @Test
  fun `G01 start monitors with the vehicle cooldown running`() {
    val decision = MotionGate.start()

    assertEquals(State(mode = Mode.MONITORING, vehicleRecent = true), decision.state)
    assertEquals(listOf(Effect.StartTimer(TimerKind.COOLDOWN)), decision.effects)
  }

  @Test
  fun `G02 stop turns any state off and cancels every timer`() {
    for (mode in Mode.entries) {
      val decision = decide(stateIn(mode), Input.Stop)

      assertEquals(State(mode = Mode.OFF), decision.state)
      assertEquals(listOf(Effect.CancelAllTimers), decision.effects)
    }
  }

  @Test
  fun `G03 restart from monitoring or candidate starts over without a warning`() {
    for (state in listOf(monitoring(), candidate())) {
      val decision = decide(state, Input.Restart)

      assertEquals(MotionGate.start().state, decision.state)
      assertEquals(listOf(Effect.CancelAllTimers, Effect.StartTimer(TimerKind.COOLDOWN)), decision.effects)
    }
  }

  @Test
  fun `G04 restart while reduced or probing restores full accuracy and warns once`() {
    val fromReduced = decide(reduced(), Input.Restart)
    assertEquals(MotionGate.start().state, fromReduced.state)
    assertEquals(
      listOf(
        Effect.ApplyFullProfile,
        Effect.CancelAllTimers,
        Effect.EmitRestored(RestoreReason.SESSION_RESTART),
        Effect.StartTimer(TimerKind.COOLDOWN)
      ),
      fromReduced.effects
    )

    val fromProbing = decide(probing(), Input.Restart)
    assertEquals(MotionGate.start().state, fromProbing.state)
    assertEquals(
      listOf(
        Effect.CancelAllTimers,
        Effect.EmitRestored(RestoreReason.SESSION_RESTART),
        Effect.StartTimer(TimerKind.COOLDOWN)
      ),
      fromProbing.effects
    )
  }

  @Test
  fun `G05 detection lost while monitoring or candidate turns the gate off silently`() {
    for (state in listOf(monitoring(), candidate())) {
      assertEquals(
        Decision(State(mode = Mode.OFF), listOf(Effect.CancelAllTimers)),
        decide(state, Input.DetectionLost)
      )
    }
  }

  @Test
  fun `G06 detection lost while reduced or probing restores full accuracy before turning off`() {
    assertEquals(
      Decision(
        State(mode = Mode.OFF),
        listOf(
          Effect.ApplyFullProfile,
          Effect.CancelAllTimers,
          Effect.EmitRestored(RestoreReason.DETECTION_LOST)
        )
      ),
      decide(reduced(), Input.DetectionLost)
    )
    assertEquals(
      Decision(
        State(mode = Mode.OFF),
        listOf(Effect.CancelAllTimers, Effect.EmitRestored(RestoreReason.DETECTION_LOST))
      ),
      decide(probing(), Input.DetectionLost)
    )
  }

  @Test
  fun `G07 vehicle evidence in any active mode marks the vehicle recent and restarts the cooldown`() {
    for (mode in listOf(Mode.MONITORING, Mode.CANDIDATE, Mode.REDUCED, Mode.PROBING)) {
      val decision = decide(stateIn(mode), Input.Vehicle)

      assertTrue("vehicleRecent in $mode", decision.state.vehicleRecent)
      assertEquals("last effect in $mode", Effect.StartTimer(TimerKind.COOLDOWN), decision.effects.last())
    }
  }

  @Test
  fun `G08 cooldown expiry clears the vehicle flag and lets a ready candidate reduce`() {
    for (state in listOf(monitoring(vehicleRecent = true), reduced(vehicleRecent = true), probing(vehicleRecent = true))) {
      assertEquals(
        Decision(state.copy(vehicleRecent = false), emptyList()),
        decide(state, Input.Timer(TimerKind.COOLDOWN))
      )
    }

    val waiting = candidate(dwellDone = false, vehicleRecent = true)
    assertEquals(
      Decision(waiting.copy(vehicleRecent = false), emptyList()),
      decide(waiting, Input.Timer(TimerKind.COOLDOWN))
    )

    val ready = candidate(dwellDone = true, vehicleRecent = true)
    assertEquals(
      Decision(ready.copy(mode = Mode.REDUCED, vehicleRecent = false), reduceEffects),
      decide(ready, Input.Timer(TimerKind.COOLDOWN))
    )
  }

  @Test
  fun `G09 a timer that does not belong to the mode is ignored`() {
    val mismatched = listOf(
      monitoring() to TimerKind.DWELL,
      reduced() to TimerKind.DWELL,
      probing() to TimerKind.DWELL,
      monitoring() to TimerKind.MAX_REDUCED,
      candidate() to TimerKind.MAX_REDUCED,
      probing() to TimerKind.MAX_REDUCED,
      monitoring() to TimerKind.PROBE,
      candidate() to TimerKind.PROBE,
      reduced() to TimerKind.PROBE
    )
    for ((state, kind) in mismatched) {
      assertUnchanged(state, Input.Timer(kind))
    }
  }

  @Test
  fun `G10 monitoring becomes a candidate on high-confidence stillness anchored at the last full fix`() {
    val decision = decide(monitoring(), Input.StillHigh)

    assertEquals(
      State(mode = Mode.CANDIDATE, dwellDone = false, anchor = anchorFix, lastFullFix = anchorFix),
      decision.state
    )
    assertEquals(listOf(Effect.StartTimer(TimerKind.DWELL)), decision.effects)
  }

  @Test
  fun `G11 monitoring ignores medium-confidence stillness and movement`() {
    assertUnchanged(monitoring(), Input.StillMedium)
    assertUnchanged(monitoring(), Input.Movement)
  }

  @Test
  fun `G12 monitoring only restarts the cooldown on vehicle evidence`() {
    assertEquals(
      Decision(monitoring(vehicleRecent = true), listOf(Effect.StartTimer(TimerKind.COOLDOWN))),
      decide(monitoring(), Input.Vehicle)
    )
  }

  @Test
  fun `G13 monitoring records a full fix as the last full fix`() {
    assertEquals(
      Decision(monitoring().copy(lastFullFix = nearFull), emptyList()),
      decide(monitoring(), Input.Fix(nearFull))
    )
  }

  @Test
  fun `G14 monitoring ignores keep-alive fixes`() {
    assertUnchanged(monitoring(), Input.Fix(nearKeepAlive))
    assertUnchanged(monitoring(), Input.Fix(farKeepAlive))
  }

  @Test
  fun `G15 candidate keeps dwelling on repeated high-confidence stillness`() {
    assertUnchanged(candidate(dwellDone = false), Input.StillHigh)
    assertUnchanged(candidate(dwellDone = true, vehicleRecent = true), Input.StillHigh)
  }

  @Test
  fun `G16 candidate falls back to monitoring on medium stillness or movement`() {
    for (input in listOf(Input.StillMedium, Input.Movement)) {
      assertEquals(
        Decision(restoredMonitoring(candidate()), listOf(Effect.CancelTimer(TimerKind.DWELL))),
        decide(candidate(), input)
      )
    }
  }

  @Test
  fun `G17 candidate falls back to monitoring at a red light with vehicle evidence`() {
    assertEquals(
      Decision(
        restoredMonitoring(candidate()).copy(vehicleRecent = true),
        listOf(Effect.CancelTimer(TimerKind.DWELL), Effect.StartTimer(TimerKind.COOLDOWN))
      ),
      decide(candidate(), Input.Vehicle)
    )
  }

  @Test
  fun `G18 candidate falls back to monitoring when a full fix moved away from the anchor`() {
    assertEquals(
      Decision(
        restoredMonitoring(candidate()).copy(lastFullFix = farFull),
        listOf(Effect.CancelTimer(TimerKind.DWELL))
      ),
      decide(candidate(), Input.Fix(farFull))
    )
  }

  @Test
  fun `G19 candidate without an anchor takes the full fix as anchor and tries to reduce`() {
    val dwelling = candidate(dwellDone = false, anchor = null)
    assertEquals(
      Decision(dwelling.copy(anchor = nearFull, lastFullFix = nearFull), emptyList()),
      decide(dwelling, Input.Fix(nearFull))
    )

    val ready = candidate(dwellDone = true, anchor = null)
    assertEquals(
      Decision(ready.copy(mode = Mode.REDUCED, anchor = nearFull, lastFullFix = nearFull), reduceEffects),
      decide(ready, Input.Fix(nearFull))
    )
  }

  @Test
  fun `G20 candidate keeps its anchor when a full fix did not move`() {
    val state = candidate(dwellDone = false)
    assertEquals(
      Decision(state.copy(lastFullFix = nearFull), emptyList()),
      decide(state, Input.Fix(nearFull))
    )
  }

  @Test
  fun `G21 dwell expiry marks the dwell done and tries to reduce`() {
    val blocked = candidate(dwellDone = false, vehicleRecent = true)
    assertEquals(
      Decision(blocked.copy(dwellDone = true), emptyList()),
      decide(blocked, Input.Timer(TimerKind.DWELL))
    )
  }

  @Test
  fun `G22 candidate reduces after dwell and cooldown with an anchor`() {
    val ready = candidate(dwellDone = false, vehicleRecent = false)

    assertEquals(
      Decision(ready.copy(mode = Mode.REDUCED, dwellDone = true), reduceEffects),
      decide(ready, Input.Timer(TimerKind.DWELL))
    )
  }

  @Test
  fun `G23 a blocked reduction waits for the cooldown or a full fix`() {
    val vehicleBlocked = decide(candidate(dwellDone = false, vehicleRecent = true), Input.Timer(TimerKind.DWELL))
    assertEquals(Mode.CANDIDATE, vehicleBlocked.state.mode)
    assertTrue(vehicleBlocked.effects.isEmpty())
    assertEquals(Mode.REDUCED, decide(vehicleBlocked.state, Input.Timer(TimerKind.COOLDOWN)).state.mode)

    val anchorBlocked = decide(candidate(dwellDone = false, anchor = null), Input.Timer(TimerKind.DWELL))
    assertEquals(Mode.CANDIDATE, anchorBlocked.state.mode)
    assertTrue(anchorBlocked.effects.isEmpty())
    assertEquals(Mode.REDUCED, decide(anchorBlocked.state, Input.Fix(nearFull)).state.mode)
  }

  @Test
  fun `G24 reduced stays reduced on stillness`() {
    assertUnchanged(reduced(), Input.StillHigh)
    assertUnchanged(reduced(), Input.StillMedium)
  }

  @Test
  fun `G25 reduced restores full accuracy on movement`() {
    assertEquals(
      Decision(
        restoredMonitoring(reduced()),
        listOf(
          Effect.ApplyFullProfile,
          Effect.CancelTimer(TimerKind.MAX_REDUCED),
          Effect.EmitRestored(RestoreReason.MOTION)
        )
      ),
      decide(reduced(), Input.Movement)
    )
  }

  @Test
  fun `G26 reduced restores full accuracy on vehicle evidence of any confidence`() {
    assertEquals(
      Decision(
        restoredMonitoring(reduced()).copy(vehicleRecent = true),
        listOf(
          Effect.ApplyFullProfile,
          Effect.CancelTimer(TimerKind.MAX_REDUCED),
          Effect.EmitRestored(RestoreReason.MOTION),
          Effect.StartTimer(TimerKind.COOLDOWN)
        )
      ),
      decide(reduced(), Input.Vehicle)
    )
  }

  @Test
  fun `G27 reduced restores full accuracy when any fix moved away from the anchor`() {
    val restoreEffects = listOf(
      Effect.ApplyFullProfile,
      Effect.CancelTimer(TimerKind.MAX_REDUCED),
      Effect.EmitRestored(RestoreReason.DISPLACEMENT)
    )
    assertEquals(
      Decision(restoredMonitoring(reduced()), restoreEffects),
      decide(reduced(), Input.Fix(farKeepAlive))
    )
    assertEquals(
      Decision(restoredMonitoring(reduced()).copy(lastFullFix = farFull), restoreEffects),
      decide(reduced(), Input.Fix(farFull))
    )
  }

  @Test
  fun `G28 reduced ignores fixes whose error circles still overlap the anchor`() {
    assertUnchanged(reduced(), Input.Fix(nearKeepAlive))
    // About 330 m away but with a 400 m error circle: not a displacement
    assertUnchanged(reduced(), Input.Fix(GateFix(lat = 0.003, lon = 0.0, accuracyM = 400.0, kind = FixKind.KEEPALIVE)))
  }

  @Test
  fun `G29 max reduced duration starts a silent full-accuracy probe`() {
    assertEquals(
      Decision(
        reduced().copy(mode = Mode.PROBING),
        listOf(Effect.ApplyFullProfile, Effect.StartTimer(TimerKind.PROBE))
      ),
      decide(reduced(), Input.Timer(TimerKind.MAX_REDUCED))
    )
  }

  @Test
  fun `G30 probing stays probing on stillness`() {
    assertUnchanged(probing(), Input.StillHigh)
    assertUnchanged(probing(), Input.StillMedium)
  }

  @Test
  fun `G31 probing restores full accuracy on movement or vehicle evidence`() {
    assertEquals(
      Decision(
        restoredMonitoring(probing()),
        listOf(Effect.CancelTimer(TimerKind.PROBE), Effect.EmitRestored(RestoreReason.MOTION))
      ),
      decide(probing(), Input.Movement)
    )
    assertEquals(
      Decision(
        restoredMonitoring(probing()).copy(vehicleRecent = true),
        listOf(
          Effect.CancelTimer(TimerKind.PROBE),
          Effect.EmitRestored(RestoreReason.MOTION),
          Effect.StartTimer(TimerKind.COOLDOWN)
        )
      ),
      decide(probing(), Input.Vehicle)
    )
  }

  @Test
  fun `G32 probing restores full accuracy when any fix moved away`() {
    val effects = listOf(Effect.CancelTimer(TimerKind.PROBE), Effect.EmitRestored(RestoreReason.DISPLACEMENT))
    assertEquals(
      Decision(restoredMonitoring(probing()), effects),
      decide(probing(), Input.Fix(farKeepAlive))
    )
    assertEquals(
      Decision(restoredMonitoring(probing()).copy(lastFullFix = farFull), effects),
      decide(probing(), Input.Fix(farFull))
    )
  }

  @Test
  fun `G33 an accurate probe fix that did not move returns to reduced without a warning`() {
    val probeEffects = listOf(
      Effect.FlushStorage,
      Effect.ApplyReducedProfile,
      Effect.CancelTimer(TimerKind.PROBE),
      Effect.StartTimer(TimerKind.MAX_REDUCED)
    )
    assertEquals(
      Decision(probing().copy(mode = Mode.REDUCED, anchor = nearFull, lastFullFix = nearFull), probeEffects),
      decide(probing(), Input.Fix(nearFull))
    )

    val boundary = nearFull.copy(
      accuracyM = MotionGate.PROBE_MAX_ACCURACY_M,
      rawAccuracyM = MotionGate.PROBE_MAX_ACCURACY_M
    )
    assertEquals(
      Decision(probing().copy(mode = Mode.REDUCED, anchor = boundary, lastFullFix = boundary), probeEffects),
      decide(probing(), Input.Fix(boundary))
    )
  }

  @Test
  fun `G34 probing keeps waiting on an inaccurate full fix or a keep-alive fix`() {
    val inaccurate = nearFull.copy(accuracyM = 100.5, rawAccuracyM = 100.5)
    assertEquals(
      Decision(probing().copy(lastFullFix = inaccurate), emptyList()),
      decide(probing(), Input.Fix(inaccurate))
    )
    assertUnchanged(probing(), Input.Fix(nearKeepAlive))
  }

  @Test
  fun `G35 probe timeout returns to reduced without a fix and without a warning`() {
    assertEquals(
      Decision(
        probing().copy(mode = Mode.REDUCED),
        listOf(Effect.ApplyReducedProfile, Effect.StartTimer(TimerKind.MAX_REDUCED))
      ),
      decide(probing(), Input.Timer(TimerKind.PROBE))
    )
  }

  @Test
  fun `G36 foreground-only, passive, no-power or unrequested trips get no gate`() {
    assertEquals(
      Applicability.NOT_REQUESTED,
      MotionGate.applicability(reductionRequested = false, foregroundOnly = false, accuracy = LocationAccuracy.HIGH_ACCURACY)
    )
    assertEquals(
      Applicability.NOT_APPLICABLE,
      MotionGate.applicability(reductionRequested = true, foregroundOnly = true, accuracy = LocationAccuracy.HIGH_ACCURACY)
    )
    assertEquals(
      Applicability.NOT_APPLICABLE,
      MotionGate.applicability(reductionRequested = true, foregroundOnly = false, accuracy = LocationAccuracy.PASSIVE)
    )
    assertEquals(
      Applicability.NOT_APPLICABLE,
      MotionGate.applicability(reductionRequested = true, foregroundOnly = false, accuracy = LocationAccuracy.NO_POWER)
    )
    for (accuracy in listOf(
      LocationAccuracy.HIGH_ACCURACY,
      LocationAccuracy.BALANCED_POWER_ACCURACY,
      LocationAccuracy.LOW_POWER
    )) {
      assertEquals(
        Applicability.APPLICABLE,
        MotionGate.applicability(reductionRequested = true, foregroundOnly = false, accuracy = accuracy)
      )
    }
  }

  @Test
  fun `G37 timers alone bound the reduction cycle without classifier input`() {
    var decision = decide(candidate(dwellDone = false), Input.Timer(TimerKind.DWELL))
    assertEquals(Mode.REDUCED, decision.state.mode)

    decision = decide(decision.state, Input.Timer(TimerKind.MAX_REDUCED))
    assertEquals(Mode.PROBING, decision.state.mode)

    decision = decide(decision.state, Input.Timer(TimerKind.PROBE))
    assertEquals(Mode.REDUCED, decision.state.mode)
    assertEquals(listOf(Effect.ApplyReducedProfile, Effect.StartTimer(TimerKind.MAX_REDUCED)), decision.effects)

    decision = decide(decision.state, Input.Timer(TimerKind.MAX_REDUCED))
    assertEquals(Mode.PROBING, decision.state.mode)
  }

  @Test
  fun `moved requires the error circles to stop overlapping and at least 100 m`() {
    assertFalse(MotionGate.moved(null, farFull))
    assertFalse(MotionGate.moved(anchorFix, nearFull))
    assertTrue(MotionGate.moved(anchorFix, farFull))
    // About 111 m apart with 10 m circles: movement
    assertTrue(MotionGate.moved(anchorFix, GateFix(lat = 0.001, lon = 0.0, accuracyM = 10.0, kind = FixKind.FULL)))
    // Same distance with a 150 m circle: overlap, no movement
    assertFalse(MotionGate.moved(anchorFix, GateFix(lat = 0.001, lon = 0.0, accuracyM = 150.0, kind = FixKind.FULL)))
  }

  @Test
  fun `off gate ignores every input except stop and restart`() {
    val off = State(mode = Mode.OFF)
    for (input in listOf(
      Input.StillHigh,
      Input.StillMedium,
      Input.Movement,
      Input.Vehicle,
      Input.Fix(farFull),
      Input.Timer(TimerKind.COOLDOWN),
      Input.DetectionLost
    )) {
      assertUnchanged(off, input)
    }
    assertEquals(MotionGate.start().state, decide(off, Input.Restart).state)
  }

  @Test
  fun `only visible transitions emit a warning`() {
    val warningsPerDecision = listOf(
      decide(candidate(dwellDone = false), Input.Timer(TimerKind.DWELL)),
      decide(reduced(), Input.Movement),
      decide(reduced(), Input.Timer(TimerKind.MAX_REDUCED)),
      decide(probing(), Input.Fix(nearFull)),
      decide(probing(), Input.Timer(TimerKind.PROBE))
    ).map { decision -> decision.effects.count { it is Effect.EmitReduced || it is Effect.EmitRestored } }

    assertEquals(listOf(1, 1, 0, 0, 0), warningsPerDecision)
  }

  @Test
  fun `full fix accuracy widens the fix accuracy by the distance filter`() {
    assertEquals(160.0, MotionGate.fullFixAccuracy(10.0, 150.0), 0.0)
    assertEquals(10.0, MotionGate.fullFixAccuracy(10.0, 0.0), 0.0)
  }

  @Test
  fun `full fix accuracy counts negative or NaN values as zero and keeps an unknown accuracy infinite`() {
    assertEquals(10.0, MotionGate.fullFixAccuracy(10.0, -5.0), 0.0)
    assertEquals(10.0, MotionGate.fullFixAccuracy(10.0, Double.NaN), 0.0)
    assertEquals(150.0, MotionGate.fullFixAccuracy(-1.0, 150.0), 0.0)
    assertEquals(150.0, MotionGate.fullFixAccuracy(Double.NaN, 150.0), 0.0)
    assertEquals(Double.POSITIVE_INFINITY, MotionGate.fullFixAccuracy(Double.POSITIVE_INFINITY, 150.0), 0.0)
  }

  @Test
  fun `a keep-alive fix within the distance filter of the anchor does not restore full accuracy`() {
    // The last full fix before parking can lie up to the distance filter short of the parking spot
    val anchor = anchorFix.copy(accuracyM = MotionGate.fullFixAccuracy(10.0, 150.0), rawAccuracyM = 10.0)
    val parked = reduced().copy(anchor = anchor, lastFullFix = anchor)
    val keepAlive = GateFix(lat = latitudeNorthOf(150.0), lon = 0.0, accuracyM = 30.0, kind = FixKind.KEEPALIVE)
    assertEquals(150.0, MotionGate.distanceM(anchor, keepAlive), 0.001)

    assertUnchanged(parked, Input.Fix(keepAlive))
  }

  @Test
  fun `without a distance filter the same keep-alive fix is a displacement`() {
    val anchor = anchorFix.copy(accuracyM = MotionGate.fullFixAccuracy(10.0, 0.0), rawAccuracyM = 10.0)
    val parked = reduced().copy(anchor = anchor, lastFullFix = anchor)
    val keepAlive = GateFix(lat = latitudeNorthOf(150.0), lon = 0.0, accuracyM = 30.0, kind = FixKind.KEEPALIVE)

    assertEquals(
      Decision(
        restoredMonitoring(parked),
        listOf(
          Effect.ApplyFullProfile,
          Effect.CancelTimer(TimerKind.MAX_REDUCED),
          Effect.EmitRestored(RestoreReason.DISPLACEMENT)
        )
      ),
      decide(parked, Input.Fix(keepAlive))
    )
  }

  @Test
  fun `a probe fix accurate on its own returns to reduced although the distance filter widens its circle`() {
    val widened = MotionGate.fullFixAccuracy(10.0, 150.0)
    val anchor = anchorFix.copy(accuracyM = widened, rawAccuracyM = 10.0)
    val state = probing().copy(anchor = anchor, lastFullFix = anchor)
    val probeFix = nearFull.copy(accuracyM = widened, rawAccuracyM = 10.0)

    val decision = decide(state, Input.Fix(probeFix))

    assertEquals(
      Decision(
        state.copy(mode = Mode.REDUCED, anchor = probeFix, lastFullFix = probeFix),
        listOf(
          Effect.FlushStorage,
          Effect.ApplyReducedProfile,
          Effect.CancelTimer(TimerKind.PROBE),
          Effect.StartTimer(TimerKind.MAX_REDUCED)
        )
      ),
      decision
    )
    // The new anchor keeps the widened error circle
    assertEquals(160.0, requireNotNull(decision.state.anchor).accuracyM, 0.0)
  }

  @Test
  fun `a probe fix whose own accuracy is worse than 100 m keeps probing`() {
    val anchor = anchorFix.copy(accuracyM = MotionGate.fullFixAccuracy(10.0, 150.0), rawAccuracyM = 10.0)
    val state = probing().copy(anchor = anchor, lastFullFix = anchor)
    val probeFix = nearFull.copy(accuracyM = MotionGate.fullFixAccuracy(120.0, 150.0), rawAccuracyM = 120.0)

    assertEquals(Decision(state.copy(lastFullFix = probeFix), emptyList()), decide(state, Input.Fix(probeFix)))
  }

  /** Latitude [metres] north of the origin on its meridian, where the haversine distance is exact. */
  private fun latitudeNorthOf(metres: Double): Double = Math.toDegrees(metres / EARTH_RADIUS_M)

  private companion object {
    const val EARTH_RADIUS_M = 6_371_000.0
  }
}
