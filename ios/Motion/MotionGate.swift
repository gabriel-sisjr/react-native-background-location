import Foundation

/// Pure decision function for reducing location updates while the device is stationary.
///
/// The gate keeps no clock and performs no side effects. Callers feed it classifier inputs,
/// classified location fixes, timer expirations and lifecycle events, then run the returned
/// effects in list order (after recording the FULL fix that produced the input, if any).
/// The gate state is never persisted: every session starts from `start()`.
enum MotionGate {
  /// Displacement, in metres, that always counts as movement whatever the reported accuracy.
  static let minMovementMeters: Double = 100
  /// Worst raw horizontal accuracy, in metres (distance filter not included), a probe fix may have
  /// to return to the reduced profile.
  static let probeMaxAccuracyMeters: Double = 100
  /// How long a probe waits for a full-accuracy fix, in milliseconds.
  static let probeTimeoutMs = 120_000

  // MARK: - Types

  /// Gate mode. `reduced` and `probing` are both reported as reduced to JavaScript.
  enum Mode: String, Equatable {
    case off = "OFF"
    case monitoring = "MONITORING"
    case candidate = "CANDIDATE"
    case reduced = "REDUCED"
    case probing = "PROBING"
  }

  /// How the caller classified a location fix.
  enum FixKind: Equatable {
    /// Delivered under the trip's own profile; persisted and emitted before the gate sees it.
    case full
    /// Delivered under (or left over from) the reduced profile; only used for displacement.
    case keepAlive
  }

  /// A location fix as the gate needs it: position, two accuracies and classification.
  struct Fix: Equatable {
    let latitude: Double
    let longitude: Double
    /// Uncertainty used by the displacement check: `fullFixAccuracy` for a FULL fix, the raw
    /// accuracy for a keep-alive fix.
    let accuracyMeters: Double
    /// The fix's own horizontal accuracy, never inflated; decides whether a probe fix is good enough.
    let rawAccuracyMeters: Double
    let kind: FixKind
  }

  /// Platform timers driven by the gate's effects.
  enum TimerKind: String, Equatable, CaseIterable {
    case dwell = "DWELL"
    case cooldown = "COOLDOWN"
    case maxReduced = "MAX_REDUCED"
    case probe = "PROBE"
  }

  /// Why full-accuracy updates were restored; selects the warning message.
  enum RestoreReason: String, Equatable {
    case motion = "MOTION"
    case displacement = "DISPLACEMENT"
    case detectionLost = "DETECTION_LOST"
    case sessionRestart = "SESSION_RESTART"
  }

  /// One gate input.
  enum Input: Equatable {
    /// STATIONARY with HIGH confidence and no vehicle evidence.
    case stillHigh
    /// STATIONARY with MEDIUM confidence and no vehicle evidence.
    case stillMedium
    /// Walking, running, cycling, unknown, or STATIONARY with LOW confidence.
    case movement
    /// Any vehicle evidence, at any confidence.
    case vehicle
    /// A location fix classified by the caller.
    case fix(Fix)
    /// A platform timer fired.
    case timer(TimerKind)
    /// The session restarted while the gate was active.
    case restart
    /// Activity detection stopped working (for example, the permission was revoked).
    case detectionLost
    /// The session ended.
    case stop
  }

  /// Side effects requested by a decision, executed by the caller in list order.
  enum Effect: Equatable {
    /// Starts a timer, replacing any running timer of the same kind.
    case startTimer(TimerKind)
    case cancelTimer(TimerKind)
    case cancelAllTimers
    case flushStorage
    case applyReducedProfile
    case applyFullProfile
    case emitReduced
    case emitRestored(RestoreReason)
  }

  /// Gate state. `anchor` and `dwellDone` only matter in CANDIDATE, REDUCED and PROBING.
  struct State: Equatable {
    var mode: Mode
    var vehicleRecent: Bool
    var dwellDone: Bool
    var anchor: Fix?
    var lastFullFix: Fix?

    /// The state of a stopped gate, or of one whose detection was lost.
    static let off = State(mode: .off, vehicleRecent: false, dwellDone: false, anchor: nil, lastFullFix: nil)

    /// The state every session starts in: no reduction until the first cooldown has elapsed.
    static let initial = State(mode: .monitoring, vehicleRecent: true, dwellDone: false, anchor: nil, lastFullFix: nil)
  }

  /// The next state plus the effects to run.
  struct Decision: Equatable {
    let state: State
    let effects: [Effect]
  }

  // MARK: - Entry points

  /// Starts a gate for a new session.
  static func start() -> Decision {
    return Decision(state: .initial, effects: [.startTimer(.cooldown)])
  }

  /// Returns the next state and the effects for `input` received in `state`.
  static func decide(_ state: State, _ input: Input) -> Decision {
    if case .stop = input {
      return Decision(state: .off, effects: [.cancelAllTimers])
    }

    switch state.mode {
    case .off:
      // A restart starts a fresh gate (as in MONITORING); everything else is ignored.
      if case .restart = input {
        return Decision(state: .initial, effects: [.cancelAllTimers, .startTimer(.cooldown)])
      }
      return Decision(state: state, effects: [])
    case .monitoring:
      return decideMonitoring(state, input)
    case .candidate:
      return decideCandidate(state, input)
    case .reduced:
      return decideReduced(state, input)
    case .probing:
      return decideProbing(state, input)
    }
  }

  /// Uncertainty, in metres, that a FULL fix carries into the displacement check (`Fix.accuracyMeters`):
  /// its horizontal accuracy plus the trip's effective distance filter, because the device can move
  /// that far before the next full fix is delivered. Negative values count as 0, so "no distance
  /// filter" (-1) adds nothing. Keep-alive fixes keep their own accuracy, and the probe quality
  /// check always uses the raw accuracy.
  static func fullFixAccuracy(_ accuracyMeters: Double, _ distanceFilterMeters: Double) -> Double {
    return max(0, accuracyMeters) + max(0, distanceFilterMeters)
  }

  /// True when the two error circles do not overlap and the distance exceeds `minMovementMeters`.
  static func moved(from anchor: Fix?, to fix: Fix) -> Bool {
    guard let anchor = anchor else {
      return false
    }
    let threshold = max(minMovementMeters, anchor.accuracyMeters + fix.accuracyMeters)
    return distanceMeters(from: anchor, to: fix) > threshold
  }

  /// Great-circle (haversine) distance in metres.
  static func distanceMeters(from a: Fix, to b: Fix) -> Double {
    let earthRadiusMeters = 6_371_000.0
    let lat1 = a.latitude * .pi / 180
    let lat2 = b.latitude * .pi / 180
    let deltaLat = lat2 - lat1
    let deltaLon = (b.longitude - a.longitude) * .pi / 180
    let sinLat = sin(deltaLat / 2)
    let sinLon = sin(deltaLon / 2)
    let h = sinLat * sinLat + cos(lat1) * cos(lat2) * sinLon * sinLon
    return 2 * earthRadiusMeters * asin(min(1, sqrt(h)))
  }

  // MARK: - Applicability

  /// What JavaScript sees as the reduction status.
  enum ReductionStatus: String, Equatable {
    case disabled = "DISABLED"
    case notApplicable = "NOT_APPLICABLE"
    case unavailable = "UNAVAILABLE"
    case monitoring = "MONITORING"
    case reduced = "REDUCED"
  }

  /// Whether a trip's options allow a gate at all; detection must also have started.
  /// Foreground-only trips and PASSIVE / NO_POWER accuracy never reduce.
  static func reductionApplies(requested: Bool, foregroundOnly: Bool, accuracy: String?) -> Bool {
    return requested && !foregroundOnly && accuracy != "PASSIVE" && accuracy != "NO_POWER"
  }

  /// Maps the session facts onto the reported reduction status.
  /// - Parameter gateMode: the gate's mode, or nil when no gate was created.
  static func reductionStatus(
    requested: Bool,
    foregroundOnly: Bool,
    accuracy: String?,
    gateMode: Mode?
  ) -> ReductionStatus {
    guard requested else {
      return .disabled
    }
    guard reductionApplies(requested: requested, foregroundOnly: foregroundOnly, accuracy: accuracy) else {
      return .notApplicable
    }
    switch gateMode {
    case .monitoring?, .candidate?:
      return .monitoring
    case .reduced?, .probing?:
      return .reduced
    case .off?, nil:
      return .unavailable
    }
  }

  // MARK: - Per-mode rules

  private static func decideMonitoring(_ state: State, _ input: Input) -> Decision {
    var next = state
    switch input {
    case .restart:
      return Decision(state: .initial, effects: [.cancelAllTimers, .startTimer(.cooldown)])
    case .detectionLost:
      return Decision(state: .off, effects: [.cancelAllTimers])
    case .vehicle:
      next.vehicleRecent = true
      return Decision(state: next, effects: [.startTimer(.cooldown)])
    case .timer(.cooldown):
      next.vehicleRecent = false
      return Decision(state: next, effects: [])
    case .timer:
      return Decision(state: state, effects: [])
    case .stillHigh:
      next.mode = .candidate
      next.dwellDone = false
      next.anchor = state.lastFullFix
      return Decision(state: next, effects: [.startTimer(.dwell)])
    case .stillMedium, .movement:
      return Decision(state: state, effects: [])
    case .fix(let fix):
      guard fix.kind == .full else {
        return Decision(state: state, effects: [])
      }
      next.lastFullFix = fix
      return Decision(state: next, effects: [])
    case .stop:
      return Decision(state: .off, effects: [.cancelAllTimers])
    }
  }

  private static func decideCandidate(_ state: State, _ input: Input) -> Decision {
    var next = state
    switch input {
    case .restart:
      return Decision(state: .initial, effects: [.cancelAllTimers, .startTimer(.cooldown)])
    case .detectionLost:
      return Decision(state: .off, effects: [.cancelAllTimers])
    case .vehicle:
      next = toMonitoring(state)
      next.vehicleRecent = true
      return Decision(state: next, effects: [.cancelTimer(.dwell), .startTimer(.cooldown)])
    case .timer(.cooldown):
      next.vehicleRecent = false
      return tryReduce(next)
    case .timer(.dwell):
      next.dwellDone = true
      return tryReduce(next)
    case .timer:
      return Decision(state: state, effects: [])
    case .stillHigh:
      return Decision(state: state, effects: [])
    case .stillMedium, .movement:
      return Decision(state: toMonitoring(state), effects: [.cancelTimer(.dwell)])
    case .fix(let fix):
      guard fix.kind == .full else {
        return Decision(state: state, effects: [])
      }
      guard let anchor = state.anchor else {
        next.anchor = fix
        next.lastFullFix = fix
        return tryReduce(next)
      }
      if moved(from: anchor, to: fix) {
        next = toMonitoring(state)
        next.lastFullFix = fix
        return Decision(state: next, effects: [.cancelTimer(.dwell)])
      }
      next.lastFullFix = fix
      return Decision(state: next, effects: [])
    case .stop:
      return Decision(state: .off, effects: [.cancelAllTimers])
    }
  }

  private static func decideReduced(_ state: State, _ input: Input) -> Decision {
    var next = state
    switch input {
    case .restart:
      return Decision(
        state: .initial,
        effects: [.applyFullProfile, .cancelAllTimers, .emitRestored(.sessionRestart), .startTimer(.cooldown)]
      )
    case .detectionLost:
      return Decision(state: .off, effects: [.applyFullProfile, .cancelAllTimers, .emitRestored(.detectionLost)])
    case .vehicle:
      let restored = restore(state, reason: .motion)
      next = restored.state
      next.vehicleRecent = true
      return Decision(state: next, effects: restored.effects + [.startTimer(.cooldown)])
    case .timer(.cooldown):
      next.vehicleRecent = false
      return Decision(state: next, effects: [])
    case .timer(.maxReduced):
      next.mode = .probing
      return Decision(state: next, effects: [.applyFullProfile, .startTimer(.probe)])
    case .timer:
      return Decision(state: state, effects: [])
    case .stillHigh, .stillMedium:
      return Decision(state: state, effects: [])
    case .movement:
      return restore(state, reason: .motion)
    case .fix(let fix):
      guard moved(from: state.anchor, to: fix) else {
        return Decision(state: state, effects: [])
      }
      let restored = restore(state, reason: .displacement)
      next = restored.state
      if fix.kind == .full {
        next.lastFullFix = fix
      }
      return Decision(state: next, effects: restored.effects)
    case .stop:
      return Decision(state: .off, effects: [.cancelAllTimers])
    }
  }

  private static func decideProbing(_ state: State, _ input: Input) -> Decision {
    var next = state
    switch input {
    case .restart:
      return Decision(
        state: .initial,
        effects: [.cancelAllTimers, .emitRestored(.sessionRestart), .startTimer(.cooldown)]
      )
    case .detectionLost:
      return Decision(state: .off, effects: [.cancelAllTimers, .emitRestored(.detectionLost)])
    case .vehicle:
      next = toMonitoring(state)
      next.vehicleRecent = true
      return Decision(state: next, effects: [.cancelTimer(.probe), .emitRestored(.motion), .startTimer(.cooldown)])
    case .movement:
      return Decision(state: toMonitoring(state), effects: [.cancelTimer(.probe), .emitRestored(.motion)])
    case .stillHigh, .stillMedium:
      return Decision(state: state, effects: [])
    case .timer(.cooldown):
      next.vehicleRecent = false
      return Decision(state: next, effects: [])
    case .timer(.probe):
      next.mode = .reduced
      return Decision(state: next, effects: [.applyReducedProfile, .startTimer(.maxReduced)])
    case .timer:
      return Decision(state: state, effects: [])
    case .fix(let fix):
      if moved(from: state.anchor, to: fix) {
        next = toMonitoring(state)
        if fix.kind == .full {
          next.lastFullFix = fix
        }
        return Decision(state: next, effects: [.cancelTimer(.probe), .emitRestored(.displacement)])
      }
      guard fix.kind == .full else {
        return Decision(state: state, effects: [])
      }
      next.lastFullFix = fix
      // Probe quality is judged on the raw accuracy; the distance filter only widens the anchor.
      guard fix.rawAccuracyMeters <= probeMaxAccuracyMeters else {
        return Decision(state: next, effects: [])
      }
      // The forced fix: already recorded by the caller; it becomes the new anchor (inflated accuracy kept).
      next.mode = .reduced
      next.anchor = fix
      return Decision(
        state: next,
        effects: [.flushStorage, .applyReducedProfile, .cancelTimer(.probe), .startTimer(.maxReduced)]
      )
    case .stop:
      return Decision(state: .off, effects: [.cancelAllTimers])
    }
  }

  // MARK: - Helpers

  /// Reduces when the dwell elapsed, no vehicle evidence is recent and an anchor exists;
  /// otherwise keeps waiting for TIMER(COOLDOWN) or a FULL fix.
  private static func tryReduce(_ state: State) -> Decision {
    guard state.mode == .candidate, state.dwellDone, !state.vehicleRecent, state.anchor != nil else {
      return Decision(state: state, effects: [])
    }
    var next = state
    next.mode = .reduced
    return Decision(state: next, effects: [.flushStorage, .applyReducedProfile, .startTimer(.maxReduced), .emitReduced])
  }

  /// Leaves REDUCED for MONITORING with full-accuracy updates and one warning.
  private static func restore(_ state: State, reason: RestoreReason) -> Decision {
    return Decision(
      state: toMonitoring(state),
      effects: [.applyFullProfile, .cancelTimer(.maxReduced), .emitRestored(reason)]
    )
  }

  /// Every entry into MONITORING drops the dwell progress and the anchor.
  private static func toMonitoring(_ state: State) -> State {
    var next = state
    next.mode = .monitoring
    next.dwellDone = false
    next.anchor = nil
    return next
  }
}
