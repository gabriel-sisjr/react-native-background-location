import Foundation

// One test per truth-table row of the reduction gate (same IDs as the Android tests).

private typealias G = MotionGate

/// Metres per degree of latitude for the radius the gate's haversine uses.
private let metersPerDegree = 6_371_000.0 * Double.pi / 180

private let home = G.Fix(latitude: 48.8566, longitude: 2.3522, accuracyMeters: 10, rawAccuracyMeters: 10, kind: .full)

/// A fix `meters` north of `home`. The raw accuracy defaults to `accuracy` (no distance filter).
private func fixNorth(meters: Double, accuracy: Double, raw: Double? = nil, kind: G.FixKind = .full) -> G.Fix {
  return G.Fix(
    latitude: home.latitude + meters / metersPerDegree,
    longitude: home.longitude,
    accuracyMeters: accuracy,
    rawAccuracyMeters: raw ?? accuracy,
    kind: kind
  )
}

private func state(
  _ mode: G.Mode,
  vehicleRecent: Bool = false,
  dwellDone: Bool = false,
  anchor: G.Fix? = nil,
  lastFullFix: G.Fix? = nil
) -> G.State {
  return G.State(mode: mode, vehicleRecent: vehicleRecent, dwellDone: dwellDone, anchor: anchor, lastFullFix: lastFullFix)
}

private let monitoringState = state(.monitoring, lastFullFix: home)
private let candidateState = state(.candidate, anchor: home, lastFullFix: home)
private let reducedState = state(.reduced, dwellDone: true, anchor: home, lastFullFix: home)
private let probingState = state(.probing, dwellDone: true, anchor: home, lastFullFix: home)
private let activeStates = [monitoringState, candidateState, reducedState, probingState]

private let reduceEffects: [G.Effect] = [.flushStorage, .applyReducedProfile, .startTimer(.maxReduced), .emitReduced]

private func restoredEffects(_ reason: G.RestoreReason) -> [G.Effect] {
  return [.applyFullProfile, .cancelTimer(.maxReduced), .emitRestored(reason)]
}

/// Number of warning effects in a decision.
private func warningCount(_ effects: [G.Effect]) -> Int {
  return effects.filter { effect in
    switch effect {
    case .emitReduced, .emitRestored:
      return true
    default:
      return false
    }
  }.count
}

func test_G01() {
  let decision = G.start()
  harness.expectEqual(decision.state, state(.monitoring, vehicleRecent: true))
  harness.expectEqual(decision.effects, [.startTimer(.cooldown)])
}

func test_G02() {
  for current in activeStates + [G.State.off] {
    let decision = G.decide(current, .stop)
    harness.expectEqual(decision.state, G.State.off, "from \(current.mode.rawValue)")
    harness.expectEqual(decision.effects, [.cancelAllTimers], "from \(current.mode.rawValue)")
  }
}

func test_G03() {
  for current in [monitoringState, candidateState] {
    let decision = G.decide(current, .restart)
    harness.expectEqual(decision.state, G.start().state, "from \(current.mode.rawValue)")
    harness.expectEqual(decision.effects, [.cancelAllTimers, .startTimer(.cooldown)], "from \(current.mode.rawValue)")
  }
}

func test_G04() {
  let fromReduced = G.decide(reducedState, .restart)
  harness.expectEqual(fromReduced.state, G.start().state)
  harness.expectEqual(
    fromReduced.effects,
    [.applyFullProfile, .cancelAllTimers, .emitRestored(.sessionRestart), .startTimer(.cooldown)]
  )
  let fromProbing = G.decide(probingState, .restart)
  harness.expectEqual(fromProbing.state, G.start().state)
  harness.expectEqual(fromProbing.effects, [.cancelAllTimers, .emitRestored(.sessionRestart), .startTimer(.cooldown)])
}

func test_G05() {
  for current in [monitoringState, candidateState] {
    let decision = G.decide(current, .detectionLost)
    harness.expectEqual(decision.state, G.State.off, "from \(current.mode.rawValue)")
    harness.expectEqual(decision.effects, [.cancelAllTimers], "from \(current.mode.rawValue)")
  }
}

func test_G06() {
  let fromReduced = G.decide(reducedState, .detectionLost)
  harness.expectEqual(fromReduced.state, G.State.off)
  harness.expectEqual(fromReduced.effects, [.applyFullProfile, .cancelAllTimers, .emitRestored(.detectionLost)])
  let fromProbing = G.decide(probingState, .detectionLost)
  harness.expectEqual(fromProbing.state, G.State.off)
  harness.expectEqual(fromProbing.effects, [.cancelAllTimers, .emitRestored(.detectionLost)])
}

func test_G07() {
  for current in activeStates {
    let decision = G.decide(current, .vehicle)
    harness.expect(decision.state.vehicleRecent, "vehicleRecent set from \(current.mode.rawValue)")
    harness.expectEqual(decision.effects.last, G.Effect.startTimer(.cooldown), "from \(current.mode.rawValue)")
    harness.expectEqual(decision.effects.filter { $0 == .startTimer(.cooldown) }.count, 1, "from \(current.mode.rawValue)")
  }
}

func test_G08() {
  let nonCandidates = [
    state(.monitoring, vehicleRecent: true, lastFullFix: home),
    state(.reduced, vehicleRecent: true, dwellDone: true, anchor: home, lastFullFix: home),
    state(.probing, vehicleRecent: true, dwellDone: true, anchor: home, lastFullFix: home),
  ]
  for current in nonCandidates {
    var expected = current
    expected.vehicleRecent = false
    let decision = G.decide(current, .timer(.cooldown))
    harness.expectEqual(decision.state, expected, "from \(current.mode.rawValue)")
    harness.expectEqual(decision.effects, [], "from \(current.mode.rawValue)")
  }

  // In CANDIDATE the cooldown expiry also tries to reduce.
  let dwelling = G.decide(state(.candidate, vehicleRecent: true, anchor: home, lastFullFix: home), .timer(.cooldown))
  harness.expectEqual(dwelling.state, state(.candidate, anchor: home, lastFullFix: home))
  harness.expectEqual(dwelling.effects, [])
  let dwellDone = state(.candidate, vehicleRecent: true, dwellDone: true, anchor: home, lastFullFix: home)
  let reduces = G.decide(dwellDone, .timer(.cooldown))
  harness.expectEqual(reduces.state, state(.reduced, dwellDone: true, anchor: home, lastFullFix: home))
  harness.expectEqual(reduces.effects, reduceEffects)
}

func test_G09() {
  let mismatched: [(G.State, G.TimerKind)] = [
    (monitoringState, .dwell),
    (monitoringState, .maxReduced),
    (monitoringState, .probe),
    (candidateState, .maxReduced),
    (candidateState, .probe),
    (reducedState, .dwell),
    (reducedState, .probe),
    (probingState, .dwell),
    (probingState, .maxReduced),
    (G.State.off, .dwell),
    (G.State.off, .cooldown),
    (G.State.off, .maxReduced),
    (G.State.off, .probe),
  ]
  for (current, kind) in mismatched {
    let decision = G.decide(current, .timer(kind))
    harness.expectEqual(decision.state, current, "\(kind.rawValue) in \(current.mode.rawValue)")
    harness.expectEqual(decision.effects, [], "\(kind.rawValue) in \(current.mode.rawValue)")
  }
}

func test_G10() {
  let decision = G.decide(monitoringState, .stillHigh)
  harness.expectEqual(decision.state, state(.candidate, anchor: home, lastFullFix: home))
  harness.expectEqual(decision.effects, [.startTimer(.dwell)])

  // Without a full fix yet the anchor stays empty until one arrives.
  let withoutFix = G.decide(state(.monitoring), .stillHigh)
  harness.expectEqual(withoutFix.state, state(.candidate))
  harness.expectEqual(withoutFix.effects, [.startTimer(.dwell)])
}

func test_G11() {
  for input in [G.Input.stillMedium, .movement] {
    let decision = G.decide(monitoringState, input)
    harness.expectEqual(decision.state, monitoringState, "\(input)")
    harness.expectEqual(decision.effects, [], "\(input)")
  }
}

func test_G12() {
  let decision = G.decide(monitoringState, .vehicle)
  harness.expectEqual(decision.state, state(.monitoring, vehicleRecent: true, lastFullFix: home))
  harness.expectEqual(decision.effects, [.startTimer(.cooldown)])
}

func test_G13() {
  let fix = fixNorth(meters: 30, accuracy: 8)
  let decision = G.decide(monitoringState, .fix(fix))
  harness.expectEqual(decision.state, state(.monitoring, lastFullFix: fix))
  harness.expectEqual(decision.effects, [])
}

func test_G14() {
  let keepAlive = fixNorth(meters: 5_000, accuracy: 3_000, kind: .keepAlive)
  let decision = G.decide(monitoringState, .fix(keepAlive))
  harness.expectEqual(decision.state, monitoringState)
  harness.expectEqual(decision.effects, [])
}

func test_G15() {
  let decision = G.decide(candidateState, .stillHigh)
  harness.expectEqual(decision.state, candidateState)
  harness.expectEqual(decision.effects, [])
}

func test_G16() {
  for input in [G.Input.stillMedium, .movement] {
    let decision = G.decide(candidateState, input)
    harness.expectEqual(decision.state, state(.monitoring, lastFullFix: home), "\(input)")
    harness.expectEqual(decision.effects, [.cancelTimer(.dwell)], "\(input)")
  }
}

func test_G17() {
  let decision = G.decide(candidateState, .vehicle)
  harness.expectEqual(decision.state, state(.monitoring, vehicleRecent: true, lastFullFix: home))
  harness.expectEqual(decision.effects, [.cancelTimer(.dwell), .startTimer(.cooldown)])
}

func test_G18() {
  let far = fixNorth(meters: 500, accuracy: 10)
  let decision = G.decide(candidateState, .fix(far))
  harness.expectEqual(decision.state, state(.monitoring, lastFullFix: far))
  harness.expectEqual(decision.effects, [.cancelTimer(.dwell)])
}

func test_G19() {
  let first = fixNorth(meters: 20, accuracy: 12)
  let waiting = G.decide(state(.candidate), .fix(first))
  harness.expectEqual(waiting.state, state(.candidate, anchor: first, lastFullFix: first))
  harness.expectEqual(waiting.effects, [])

  // With the dwell done and no vehicle evidence, the new anchor completes tryReduce.
  let ready = G.decide(state(.candidate, dwellDone: true), .fix(first))
  harness.expectEqual(ready.state, state(.reduced, dwellDone: true, anchor: first, lastFullFix: first))
  harness.expectEqual(ready.effects, reduceEffects)
}

func test_G20() {
  let near = fixNorth(meters: 50, accuracy: 10)
  let decision = G.decide(candidateState, .fix(near))
  harness.expectEqual(decision.state, state(.candidate, anchor: home, lastFullFix: near))
  harness.expectEqual(decision.effects, [])
}

func test_G21() {
  let blocked = G.decide(state(.candidate, vehicleRecent: true, anchor: home, lastFullFix: home), .timer(.dwell))
  harness.expectEqual(blocked.state, state(.candidate, vehicleRecent: true, dwellDone: true, anchor: home, lastFullFix: home))
  harness.expectEqual(blocked.effects, [])

  let reduces = G.decide(candidateState, .timer(.dwell))
  harness.expectEqual(reduces.state.mode, G.Mode.reduced)
  harness.expect(reduces.state.dwellDone, "dwellDone set by TIMER(DWELL)")
}

func test_G22() {
  let decision = G.decide(candidateState, .timer(.dwell))
  harness.expectEqual(decision.state, state(.reduced, dwellDone: true, anchor: home, lastFullFix: home))
  harness.expectEqual(decision.effects, [.flushStorage, .applyReducedProfile, .startTimer(.maxReduced), .emitReduced])
}

func test_G23() {
  // Blocked by recent vehicle evidence: waits for TIMER(COOLDOWN).
  let byVehicle = G.decide(state(.candidate, vehicleRecent: true, anchor: home, lastFullFix: home), .timer(.dwell))
  harness.expectEqual(byVehicle.state.mode, G.Mode.candidate)
  harness.expectEqual(byVehicle.effects, [])
  let afterCooldown = G.decide(byVehicle.state, .timer(.cooldown))
  harness.expectEqual(afterCooldown.state.mode, G.Mode.reduced)
  harness.expectEqual(afterCooldown.effects, reduceEffects)

  // Blocked by a missing anchor: waits for a FULL fix.
  let byAnchor = G.decide(state(.candidate), .timer(.dwell))
  harness.expectEqual(byAnchor.state, state(.candidate, dwellDone: true))
  harness.expectEqual(byAnchor.effects, [])
  let fix = fixNorth(meters: 10, accuracy: 15)
  let afterFix = G.decide(byAnchor.state, .fix(fix))
  harness.expectEqual(afterFix.state, state(.reduced, dwellDone: true, anchor: fix, lastFullFix: fix))
  harness.expectEqual(afterFix.effects, reduceEffects)
}

func test_G24() {
  for input in [G.Input.stillHigh, .stillMedium] {
    let decision = G.decide(reducedState, input)
    harness.expectEqual(decision.state, reducedState, "\(input)")
    harness.expectEqual(decision.effects, [], "\(input)")
  }
}

func test_G25() {
  let decision = G.decide(reducedState, .movement)
  harness.expectEqual(decision.state, state(.monitoring, lastFullFix: home))
  harness.expectEqual(decision.effects, restoredEffects(.motion))
}

func test_G26() {
  let decision = G.decide(reducedState, .vehicle)
  harness.expectEqual(decision.state, state(.monitoring, vehicleRecent: true, lastFullFix: home))
  harness.expectEqual(decision.effects, restoredEffects(.motion) + [.startTimer(.cooldown)])
}

func test_G27() {
  let keepAlive = fixNorth(meters: 5_000, accuracy: 3_000, kind: .keepAlive)
  let decision = G.decide(reducedState, .fix(keepAlive))
  harness.expectEqual(decision.state, state(.monitoring, lastFullFix: home))
  harness.expectEqual(decision.effects, restoredEffects(.displacement))
}

func test_G28() {
  // Inside the combined error circles: 2 km away with a 3 km keep-alive accuracy.
  let keepAlive = fixNorth(meters: 2_000, accuracy: 3_000, kind: .keepAlive)
  let coarse = G.decide(reducedState, .fix(keepAlive))
  harness.expectEqual(coarse.state, reducedState)
  harness.expectEqual(coarse.effects, [])

  // Below the 100 m floor even with precise fixes.
  let close = fixNorth(meters: 90, accuracy: 5, kind: .keepAlive)
  let precise = G.decide(reducedState, .fix(close))
  harness.expectEqual(precise.state, reducedState)
  harness.expectEqual(precise.effects, [])
}

func test_G29() {
  let decision = G.decide(reducedState, .timer(.maxReduced))
  harness.expectEqual(decision.state, state(.probing, dwellDone: true, anchor: home, lastFullFix: home))
  harness.expectEqual(decision.effects, [.applyFullProfile, .startTimer(.probe)])
  harness.expectEqual(warningCount(decision.effects), 0)
}

func test_G30() {
  for input in [G.Input.stillHigh, .stillMedium] {
    let decision = G.decide(probingState, input)
    harness.expectEqual(decision.state, probingState, "\(input)")
    harness.expectEqual(decision.effects, [], "\(input)")
  }
}

func test_G31() {
  let movement = G.decide(probingState, .movement)
  harness.expectEqual(movement.state, state(.monitoring, lastFullFix: home))
  harness.expectEqual(movement.effects, [.cancelTimer(.probe), .emitRestored(.motion)])

  let vehicle = G.decide(probingState, .vehicle)
  harness.expectEqual(vehicle.state, state(.monitoring, vehicleRecent: true, lastFullFix: home))
  harness.expectEqual(vehicle.effects, [.cancelTimer(.probe), .emitRestored(.motion), .startTimer(.cooldown)])
}

func test_G32() {
  let full = fixNorth(meters: 400, accuracy: 10)
  let byFull = G.decide(probingState, .fix(full))
  harness.expectEqual(byFull.state, state(.monitoring, lastFullFix: full))
  harness.expectEqual(byFull.effects, [.cancelTimer(.probe), .emitRestored(.displacement)])

  let keepAlive = fixNorth(meters: 5_000, accuracy: 3_000, kind: .keepAlive)
  let byKeepAlive = G.decide(probingState, .fix(keepAlive))
  harness.expectEqual(byKeepAlive.state, state(.monitoring, lastFullFix: home))
  harness.expectEqual(byKeepAlive.effects, [.cancelTimer(.probe), .emitRestored(.displacement)])
}

func test_G33() {
  let probeFix = fixNorth(meters: 30, accuracy: 20)
  let decision = G.decide(probingState, .fix(probeFix))
  harness.expectEqual(decision.state, state(.reduced, dwellDone: true, anchor: probeFix, lastFullFix: probeFix))
  harness.expectEqual(
    decision.effects,
    [.flushStorage, .applyReducedProfile, .cancelTimer(.probe), .startTimer(.maxReduced)]
  )
  harness.expectEqual(warningCount(decision.effects), 0)

  // The accuracy limit is inclusive.
  let edge = fixNorth(meters: 30, accuracy: 100)
  harness.expectEqual(G.decide(probingState, .fix(edge)).state.mode, G.Mode.reduced)
}

func test_G34() {
  let coarse = fixNorth(meters: 30, accuracy: 150)
  let byCoarse = G.decide(probingState, .fix(coarse))
  harness.expectEqual(byCoarse.state, state(.probing, dwellDone: true, anchor: home, lastFullFix: coarse))
  harness.expectEqual(byCoarse.effects, [])

  let keepAlive = fixNorth(meters: 1_000, accuracy: 3_000, kind: .keepAlive)
  let byKeepAlive = G.decide(probingState, .fix(keepAlive))
  harness.expectEqual(byKeepAlive.state, probingState)
  harness.expectEqual(byKeepAlive.effects, [])
}

func test_G35() {
  let decision = G.decide(probingState, .timer(.probe))
  harness.expectEqual(decision.state, reducedState)
  harness.expectEqual(decision.effects, [.applyReducedProfile, .startTimer(.maxReduced)])
  harness.expectEqual(warningCount(decision.effects), 0)
}

func test_G36() {
  harness.expect(!G.reductionApplies(requested: true, foregroundOnly: true, accuracy: "HIGH_ACCURACY"), "foregroundOnly")
  harness.expect(!G.reductionApplies(requested: true, foregroundOnly: false, accuracy: "PASSIVE"), "PASSIVE")
  harness.expect(!G.reductionApplies(requested: true, foregroundOnly: false, accuracy: "NO_POWER"), "NO_POWER")
  harness.expect(!G.reductionApplies(requested: false, foregroundOnly: false, accuracy: nil), "not requested")
  harness.expect(G.reductionApplies(requested: true, foregroundOnly: false, accuracy: nil), "default accuracy")
  harness.expect(G.reductionApplies(requested: true, foregroundOnly: false, accuracy: "BALANCED_POWER_ACCURACY"), "balanced")

  harness.expectEqual(G.reductionStatus(requested: false, foregroundOnly: false, accuracy: nil, gateMode: nil), .disabled)
  harness.expectEqual(G.reductionStatus(requested: true, foregroundOnly: true, accuracy: nil, gateMode: nil), .notApplicable)
  harness.expectEqual(
    G.reductionStatus(requested: true, foregroundOnly: false, accuracy: "PASSIVE", gateMode: nil),
    .notApplicable
  )
  harness.expectEqual(
    G.reductionStatus(requested: true, foregroundOnly: false, accuracy: "NO_POWER", gateMode: nil),
    .notApplicable
  )
  harness.expectEqual(G.reductionStatus(requested: true, foregroundOnly: false, accuracy: nil, gateMode: nil), .unavailable)
  harness.expectEqual(G.reductionStatus(requested: true, foregroundOnly: false, accuracy: nil, gateMode: .off), .unavailable)
  harness.expectEqual(
    G.reductionStatus(requested: true, foregroundOnly: false, accuracy: nil, gateMode: .monitoring),
    .monitoring
  )
  harness.expectEqual(
    G.reductionStatus(requested: true, foregroundOnly: false, accuracy: nil, gateMode: .candidate),
    .monitoring
  )
  harness.expectEqual(G.reductionStatus(requested: true, foregroundOnly: false, accuracy: nil, gateMode: .reduced), .reduced)
  harness.expectEqual(G.reductionStatus(requested: true, foregroundOnly: false, accuracy: nil, gateMode: .probing), .reduced)
}

func test_G37() {
  var decision = G.start()
  var warnings = warningCount(decision.effects)
  let steps: [(G.Input, G.Mode)] = [
    (.fix(home), .monitoring),
    (.stillHigh, .candidate),
    (.timer(.cooldown), .candidate),
    (.timer(.dwell), .reduced),
    (.timer(.maxReduced), .probing),
    (.timer(.probe), .reduced),
    (.timer(.maxReduced), .probing),
    (.timer(.probe), .reduced),
  ]
  for (input, expectedMode) in steps {
    decision = G.decide(decision.state, input)
    warnings += warningCount(decision.effects)
    harness.expectEqual(decision.state.mode, expectedMode, "after \(input)")
  }
  harness.expectEqual(warnings, 1, "only the first reduction is visible")
}

// Decisions the truth table leaves open, pinned to the same behaviour on both platforms.

func test_parity_candidateIgnoresKeepAliveFix() {
  let near = fixNorth(meters: 50, accuracy: 3_000, kind: .keepAlive)
  let far = fixNorth(meters: 5_000, accuracy: 3_000, kind: .keepAlive)
  for fix in [near, far] {
    let decision = G.decide(candidateState, .fix(fix))
    harness.expectEqual(decision.state, candidateState, "\(fix)")
    harness.expectEqual(decision.effects, [], "\(fix)")
  }
  // A keep-alive fix never becomes the anchor either.
  let withoutAnchor = G.decide(state(.candidate, dwellDone: true), .fix(near))
  harness.expectEqual(withoutAnchor.state, state(.candidate, dwellDone: true))
  harness.expectEqual(withoutAnchor.effects, [])
}

func test_parity_restartFromOff() {
  let decision = G.decide(G.State.off, .restart)
  harness.expectEqual(decision.state, G.start().state)
  harness.expectEqual(decision.effects, [.cancelAllTimers, .startTimer(.cooldown)])
  harness.expectEqual(warningCount(decision.effects), 0)
}

func test_parity_reducedFixRules() {
  // Moved: a FULL fix also refreshes lastFullFix (as in PROBING).
  let full = fixNorth(meters: 400, accuracy: 10)
  let moved = G.decide(reducedState, .fix(full))
  harness.expectEqual(moved.state, state(.monitoring, lastFullFix: full))
  harness.expectEqual(moved.effects, restoredEffects(.displacement))

  // Not moved: the state is left completely untouched, whatever the fix kind.
  for fix in [fixNorth(meters: 30, accuracy: 10), fixNorth(meters: 30, accuracy: 3_000, kind: .keepAlive)] {
    let unchanged = G.decide(reducedState, .fix(fix))
    harness.expectEqual(unchanged.state, reducedState, "\(fix)")
    harness.expectEqual(unchanged.effects, [], "\(fix)")
  }
}

func test_parity_movedUsesStrictComparisonAndEarthRadius() {
  // Haversine with R = 6 371 000 m: one degree of latitude along a meridian.
  let equator = G.Fix(latitude: 0, longitude: 0, accuracyMeters: 0, rawAccuracyMeters: 0, kind: .full)
  let oneDegreeNorth = G.Fix(latitude: 1, longitude: 0, accuracyMeters: 0, rawAccuracyMeters: 0, kind: .full)
  let expected = 6_371_000.0 * Double.pi / 180
  harness.expect(abs(G.distanceMeters(from: equator, to: oneDegreeNorth) - expected) < 1e-6, "one degree is R * pi / 180")

  // A displacement equal to the combined accuracy is not movement; just above it is.
  let anchor = G.Fix(latitude: home.latitude, longitude: home.longitude, accuracyMeters: 0, rawAccuracyMeters: 0, kind: .full)
  let target = fixNorth(meters: 250, accuracy: 0)
  let distance = G.distanceMeters(from: anchor, to: target)
  let atThreshold = G.Fix(
    latitude: target.latitude,
    longitude: target.longitude,
    accuracyMeters: distance,
    rawAccuracyMeters: distance,
    kind: .full
  )
  let justInside = G.Fix(
    latitude: target.latitude,
    longitude: target.longitude,
    accuracyMeters: distance.nextDown,
    rawAccuracyMeters: distance.nextDown,
    kind: .full
  )
  harness.expect(!G.moved(from: anchor, to: atThreshold), "distance equal to the threshold")
  harness.expect(G.moved(from: anchor, to: justInside), "distance just above the threshold")

  // The 100 m floor applies when the combined accuracy is smaller.
  harness.expect(!G.moved(from: home, to: fixNorth(meters: 99, accuracy: 0)), "below the floor")
  harness.expect(G.moved(from: home, to: fixNorth(meters: 101, accuracy: 0)), "above the floor")
  harness.expect(!G.moved(from: nil, to: target), "no anchor")
}

// The accuracy a FULL fix carries into the gate (the same formula on both platforms).

func test_fullFixAccuracy_addsTheDistanceFilter() {
  harness.expectEqual(G.fullFixAccuracy(10, 150), 160)
  harness.expectEqual(G.fullFixAccuracy(12.5, 50), 62.5)
  harness.expectEqual(G.fullFixAccuracy(30, 0), 30, "no distance filter")
  harness.expectEqual(G.fullFixAccuracy(30, -1), 30, "a negative distance filter adds nothing")
  harness.expectEqual(G.fullFixAccuracy(-1, 150), 150, "a negative accuracy counts as 0")
  harness.expectEqual(G.fullFixAccuracy(-1, -1), 0)
}

func test_fullFixAccuracy_keepAliveWithinTheDistanceFilterDoesNotRestore() {
  // Distance filter 150 m: the 10 m anchor may lag up to 150 m behind the device.
  let anchor = G.Fix(
    latitude: home.latitude,
    longitude: home.longitude,
    accuracyMeters: G.fullFixAccuracy(10, 150),
    rawAccuracyMeters: 10,
    kind: .full
  )
  let reduced = state(.reduced, dwellDone: true, anchor: anchor, lastFullFix: anchor)
  let keepAlive = fixNorth(meters: 150, accuracy: 30, kind: .keepAlive)
  harness.expect(!G.moved(from: anchor, to: keepAlive), "150 m is inside max(100, 160 + 30)")
  let decision = G.decide(reduced, .fix(keepAlive))
  harness.expectEqual(decision.state, reduced)
  harness.expectEqual(decision.effects, [])

  // Without the distance filter the same fix lies outside both error circles and restores.
  let bareAnchor = G.Fix(latitude: home.latitude, longitude: home.longitude, accuracyMeters: 10, rawAccuracyMeters: 10, kind: .full)
  let bare = G.decide(state(.reduced, dwellDone: true, anchor: bareAnchor, lastFullFix: bareAnchor), .fix(keepAlive))
  harness.expectEqual(bare.state, state(.monitoring, lastFullFix: bareAnchor))
  harness.expectEqual(bare.effects, restoredEffects(.displacement))
}

// Probe quality is judged on the raw accuracy, while the anchor keeps the inflated one.

func test_probeQuality_rawAccuracyWithinTheLimitReturnsToReduced() {
  // Distance filter 150 m: raw 10 m gives a displacement uncertainty of 160 m.
  let probeFix = fixNorth(meters: 30, accuracy: G.fullFixAccuracy(10, 150), raw: 10)
  harness.expect(!G.moved(from: probingState.anchor, to: probeFix), "30 m is not movement")
  let decision = G.decide(probingState, .fix(probeFix))
  harness.expectEqual(decision.state, state(.reduced, dwellDone: true, anchor: probeFix, lastFullFix: probeFix))
  harness.expectEqual(decision.state.anchor?.accuracyMeters, 160, "the anchor keeps the inflated accuracy")
  harness.expectEqual(
    decision.effects,
    [.flushStorage, .applyReducedProfile, .cancelTimer(.probe), .startTimer(.maxReduced)]
  )
  harness.expectEqual(warningCount(decision.effects), 0)
}

func test_probeQuality_coarseRawAccuracyKeepsProbing() {
  let coarse = fixNorth(meters: 30, accuracy: G.fullFixAccuracy(120, 150), raw: 120)
  harness.expect(!G.moved(from: probingState.anchor, to: coarse), "30 m is not movement")
  let decision = G.decide(probingState, .fix(coarse))
  harness.expectEqual(decision.state, state(.probing, dwellDone: true, anchor: home, lastFullFix: coarse))
  harness.expectEqual(decision.effects, [])
}

let motionGateTests: [TestCase] = [
  ("test_G01", test_G01),
  ("test_G02", test_G02),
  ("test_G03", test_G03),
  ("test_G04", test_G04),
  ("test_G05", test_G05),
  ("test_G06", test_G06),
  ("test_G07", test_G07),
  ("test_G08", test_G08),
  ("test_G09", test_G09),
  ("test_G10", test_G10),
  ("test_G11", test_G11),
  ("test_G12", test_G12),
  ("test_G13", test_G13),
  ("test_G14", test_G14),
  ("test_G15", test_G15),
  ("test_G16", test_G16),
  ("test_G17", test_G17),
  ("test_G18", test_G18),
  ("test_G19", test_G19),
  ("test_G20", test_G20),
  ("test_G21", test_G21),
  ("test_G22", test_G22),
  ("test_G23", test_G23),
  ("test_G24", test_G24),
  ("test_G25", test_G25),
  ("test_G26", test_G26),
  ("test_G27", test_G27),
  ("test_G28", test_G28),
  ("test_G29", test_G29),
  ("test_G30", test_G30),
  ("test_G31", test_G31),
  ("test_G32", test_G32),
  ("test_G33", test_G33),
  ("test_G34", test_G34),
  ("test_G35", test_G35),
  ("test_G36", test_G36),
  ("test_G37", test_G37),
  ("test_parity_candidateIgnoresKeepAliveFix", test_parity_candidateIgnoresKeepAliveFix),
  ("test_parity_restartFromOff", test_parity_restartFromOff),
  ("test_parity_reducedFixRules", test_parity_reducedFixRules),
  ("test_parity_movedUsesStrictComparisonAndEarthRadius", test_parity_movedUsesStrictComparisonAndEarthRadius),
  ("test_fullFixAccuracy_addsTheDistanceFilter", test_fullFixAccuracy_addsTheDistanceFilter),
  (
    "test_fullFixAccuracy_keepAliveWithinTheDistanceFilterDoesNotRestore",
    test_fullFixAccuracy_keepAliveWithinTheDistanceFilterDoesNotRestore
  ),
  ("test_probeQuality_rawAccuracyWithinTheLimitReturnsToReduced", test_probeQuality_rawAccuracyWithinTheLimitReturnsToReduced),
  ("test_probeQuality_coarseRawAccuracyKeepsProbing", test_probeQuality_coarseRawAccuracyKeepsProbing),
]
