import Foundation
import UIKit

/// Delivers motion readings for one session.
protocol MotionActivitySource: AnyObject {
  /// Starts delivering readings. `handler` runs on the source's own queue.
  func start(handler: @escaping (MotionReading) -> Void)
  /// Stops delivering readings. Safe to call more than once.
  func stop()
}

/// The platform's motion capabilities. Only `requestAuthorization` may prompt the user.
protocol MotionActivityPlatform: AnyObject {
  /// Start-up checks in order: compile flag, usage description, availability, authorization.
  func evaluatePreconditions() -> MotionPreconditionResult
  /// Current Motion & Fitness authorization.
  func authorizationStatus() -> MotionAuthorizationStatus
  /// Creates the activity source for one session.
  func makeSource() -> MotionActivitySource
  /// Prompts when access is undetermined. `completion` may run on any thread.
  func requestAuthorization(completion: @escaping (MotionPermissionStatus) -> Void)
}

/// What the coordinator asks of its owner. Always called on the owner's queue.
protocol MotionCoordinatorHost: AnyObject {
  /// Applies the reduced (keep-alive) profile, or the trip's own full profile, on the main queue.
  /// When given, `applied` then runs once on the main queue with the time taken right after the
  /// properties were set (also when there was nothing to apply).
  func motionCoordinatorApplyLocationProfile(reduced: Bool, applied: ((Date) -> Void)?)
  /// Writes buffered locations to storage.
  func motionCoordinatorFlushStorage()
  /// False once tracking has stopped or the stop token is set.
  func motionCoordinatorCanEmit() -> Bool
  /// Emits an `onLocationWarning` event for the session's trip.
  func motionCoordinatorEmitWarning(_ warning: MotionWarning, tripId: String)
  /// Emits an `onMotionActivity` event.
  func motionCoordinatorEmitActivity(_ payload: [String: Any])
}

/// Owns one motion session: the activity source, the reduction gate, its timers, the
/// permission re-checks and the state snapshot.
///
/// Every method must run on `queue` (the location wrapper's serial queue), which is asserted in
/// debug builds. A `generation` token, bumped on every start and stop, lets readings, timers and
/// observers that belong to an earlier session drop their work.
final class MotionCoordinator {
  private struct ScheduledTimer {
    let source: DispatchSourceTimer
    let sequence: UInt64
  }

  private final class Session {
    let tripId: String
    let options: MotionOptions
    let foregroundOnly: Bool
    let accuracy: String?
    var detection: MotionDetectionStatus = .off
    var platform: MotionActivityPlatform?
    var source: MotionActivitySource?
    var gate: MotionGate.State?
    var timers: [MotionGate.TimerKind: ScheduledTimer] = [:]
    var lastEvent: MotionSample?
    var detectionWarningSent = false
    /// The latest full-profile request that main has not applied yet; every fix is keep-alive meanwhile.
    var pendingFullProfileRequest: UInt64?
    /// When main last finished applying the full profile; fixes timestamped earlier are keep-alive.
    var fullProfileSince: Date?
    var activeObserver: NSObjectProtocol?

    init(tripId: String, options: MotionOptions, foregroundOnly: Bool, accuracy: String?) {
      self.tripId = tripId
      self.options = options
      self.foregroundOnly = foregroundOnly
      self.accuracy = accuracy
    }
  }

  private static let offStateJSON = "{\"tripId\":null,\"detection\":\"OFF\",\"reduction\":\"DISABLED\",\"lastActivity\":null}"

  weak var host: MotionCoordinatorHost?

  private let queue: DispatchQueue
  private let makePlatform: () -> MotionActivityPlatform?
  private var generation: UInt64 = 0
  private var timerSequence: UInt64 = 0
  private var profileRequestSequence: UInt64 = 0
  private var session: Session?

  init(
    queue: DispatchQueue,
    makePlatform: @escaping () -> MotionActivityPlatform? = MotionActivityPlatformFactory.makePlatform
  ) {
    self.queue = queue
    self.makePlatform = makePlatform
  }

  // MARK: - Session lifecycle

  /// Starts motion activity for a trip that has just started (or recovered) tracking.
  ///
  /// With the feature off nothing happens: no CoreMotion call and no event. The checks never
  /// prompt; when one fails, one warning is sent after the caller returns and tracking continues
  /// at full accuracy.
  func startSession(tripId: String, options: TrackingOptions) {
    assertOnQueue()
    stopSession()
    guard let motion = options.motionOptions else {
      return
    }

    generation &+= 1
    let token = generation
    let current = Session(
      tripId: tripId,
      options: motion,
      foregroundOnly: options.isForegroundOnly,
      accuracy: options.accuracy
    )
    session = current

    let platform = makePlatform()
    let result = platform?.evaluatePreconditions() ?? .notCompiled
    current.detection = MotionPreconditions.detectionStatus(for: result)

    guard result == .ready, let readyPlatform = platform else {
      NSLog("[BackgroundLocation] Motion activity did not start; location tracking continues at full accuracy")
      if let warning = MotionWarning.detection(for: result) {
        queue.async { [weak self] in
          self?.emitDetectionWarning(warning, generation: token)
        }
      }
      return
    }

    current.platform = readyPlatform
    let source = readyPlatform.makeSource()
    current.source = source
    let queue = self.queue
    source.start { [weak self] reading in
      queue.async {
        self?.handle(reading, generation: token)
      }
    }
    observeAppActive(current, generation: token)

    let gateApplies = MotionGate.reductionApplies(
      requested: motion.reduceWhenStationary,
      foregroundOnly: current.foregroundOnly,
      accuracy: current.accuracy
    )
    if gateApplies {
      let decision = MotionGate.start()
      current.gate = decision.state
      run(decision.effects, in: current, generation: token)
    }

    #if DEBUG
    NSLog("[BackgroundLocation] Motion session started (gate: \(gateApplies), stationaryDelay: \(motion.stationaryDelayMs) ms, automotiveCooldown: \(motion.automotiveCooldownMs) ms, maxReducedDuration: \(motion.maxReducedDurationMs) ms)")
    #endif
  }

  /// Ends the session on every path that ends tracking: stops the source, cancels every timer,
  /// stops the gate and drops stale work. Emits nothing.
  func stopSession() {
    assertOnQueue()
    generation &+= 1
    guard let current = session else {
      return
    }
    session = nil
    current.source?.stop()
    current.source = nil
    if let gate = current.gate {
      current.gate = MotionGate.decide(gate, .stop).state
    }
    cancelAllTimers(in: current)
    removeAppActiveObserver(current)
  }

  // MARK: - Location fixes

  /// True when the current session has a reduction gate.
  var hasGate: Bool {
    assertOnQueue()
    return session?.gate != nil
  }

  /// True while the reduced (keep-alive) profile is applied.
  var isReduced: Bool {
    assertOnQueue()
    return session?.gate?.mode == .reduced
  }

  /// A fix is keep-alive when the gate is REDUCED, while a switch back to the full profile has not
  /// been applied on main yet, or when it predates the moment that switch was applied. Keep-alive
  /// fixes are never persisted or emitted.
  func isKeepAliveFix(timestamp: Date) -> Bool {
    assertOnQueue()
    guard let current = session, let gate = current.gate else {
      return false
    }
    if gate.mode == .reduced || current.pendingFullProfileRequest != nil {
      return true
    }
    if let since = current.fullProfileSince, timestamp < since {
      return true
    }
    return false
  }

  /// Feeds a classified fix to the gate. A FULL fix must already be persisted and emitted.
  /// `accuracyMeters` is the displacement uncertainty (for a FULL fix it includes the trip's distance
  /// filter, see `MotionGate.fullFixAccuracy`); `rawAccuracyMeters` is the fix's own horizontal accuracy.
  func handleFix(
    latitude: Double,
    longitude: Double,
    accuracyMeters: Double,
    rawAccuracyMeters: Double,
    kind: MotionGate.FixKind
  ) {
    assertOnQueue()
    guard session?.gate != nil else {
      return
    }
    let fix = MotionGate.Fix(
      latitude: latitude,
      longitude: longitude,
      accuracyMeters: accuracyMeters,
      rawAccuracyMeters: rawAccuracyMeters,
      kind: kind
    )
    process(.fix(fix), generation: generation)
  }

  // MARK: - State snapshot

  /// JSON for `getMotionActivityState()`: the OFF state when no motion session exists.
  func stateJSON() -> String {
    assertOnQueue()
    var state: [String: Any] = [
      "tripId": NSNull(),
      "detection": MotionDetectionStatus.off.rawValue,
      "reduction": MotionGate.ReductionStatus.disabled.rawValue,
      "lastActivity": NSNull(),
    ]
    if let current = session {
      state["tripId"] = current.tripId
      state["detection"] = current.detection.rawValue
      state["reduction"] = MotionGate.reductionStatus(
        requested: current.options.reduceWhenStationary,
        foregroundOnly: current.foregroundOnly,
        accuracy: current.accuracy,
        gateMode: current.gate?.mode
      ).rawValue
      if let last = current.lastEvent {
        state["lastActivity"] = eventPayload(for: last, tripId: current.tripId)
      }
    }
    guard JSONSerialization.isValidJSONObject(state),
          let data = try? JSONSerialization.data(withJSONObject: state),
          let json = String(data: data, encoding: .utf8) else {
      return MotionCoordinator.offStateJSON
    }
    return json
  }

  // MARK: - Readings

  private func handle(_ reading: MotionReading, generation token: UInt64) {
    assertOnQueue()
    guard token == generation, let current = session, current.detection == .running else {
      return
    }
    guard host?.motionCoordinatorCanEmit() == true else {
      return
    }

    let sample = MotionNormalization.sample(from: reading)
    let isRepeat = current.lastEvent.map {
      $0.activity == sample.activity && $0.confidence == sample.confidence
    } ?? false

    #if DEBUG
    NSLog("[BackgroundLocation] Motion activity \(sample.activity.rawValue) (\(sample.confidence.rawValue))\(isRepeat ? ", unchanged" : "")")
    #endif

    if !isRepeat {
      current.lastEvent = sample
      host?.motionCoordinatorEmitActivity(eventPayload(for: sample, tripId: current.tripId))
    }
    if current.gate != nil {
      process(MotionNormalization.gateInput(for: sample), generation: token)
    }
  }

  private func eventPayload(for sample: MotionSample, tripId: String) -> [String: Any] {
    return [
      "tripId": tripId,
      "activity": sample.activity.rawValue,
      "confidence": sample.confidence.rawValue,
      "timestamp": sample.timestampMs,
    ]
  }

  // MARK: - Gate

  private func process(_ input: MotionGate.Input, generation token: UInt64) {
    guard token == generation, let current = session, let state = current.gate else {
      return
    }
    let decision = MotionGate.decide(state, input)
    current.gate = decision.state

    #if DEBUG
    if decision.state.mode != state.mode {
      NSLog("[BackgroundLocation] Motion gate \(state.mode.rawValue) -> \(decision.state.mode.rawValue)")
    }
    #endif

    run(decision.effects, in: current, generation: token)
  }

  private func run(_ effects: [MotionGate.Effect], in current: Session, generation token: UInt64) {
    for effect in effects {
      guard token == generation, session === current else {
        return
      }
      switch effect {
      case .startTimer(let kind):
        startTimer(kind, in: current, generation: token)
      case .cancelTimer(let kind):
        cancelTimer(kind, in: current)
      case .cancelAllTimers:
        cancelAllTimers(in: current)
      case .flushStorage:
        host?.motionCoordinatorFlushStorage()
      case .applyReducedProfile:
        host?.motionCoordinatorApplyLocationProfile(reduced: true, applied: nil)
      case .applyFullProfile:
        requestFullProfile(in: current, generation: token)
      case .emitReduced:
        emitGateWarning(.reduced, in: current)
      case .emitRestored(let reason):
        emitGateWarning(.restored(reason), in: current)
      }
    }
  }

  // MARK: - Full profile

  /// Every fix stays keep-alive from this request until main reports when the full profile was
  /// applied, so a fix produced under the reduced profile is never recorded as a trip point.
  private func requestFullProfile(in current: Session, generation token: UInt64) {
    profileRequestSequence &+= 1
    let request = profileRequestSequence
    current.pendingFullProfileRequest = request
    let queue = self.queue
    host?.motionCoordinatorApplyLocationProfile(reduced: false) { [weak self] appliedAt in
      queue.async {
        self?.fullProfileApplied(at: appliedAt, request: request, generation: token)
      }
    }
  }

  /// Only the latest request counts: the time of an earlier one could precede a later reduced profile.
  private func fullProfileApplied(at appliedAt: Date, request: UInt64, generation token: UInt64) {
    assertOnQueue()
    guard token == generation, let current = session, current.pendingFullProfileRequest == request else {
      return
    }
    current.pendingFullProfileRequest = nil
    current.fullProfileSince = appliedAt
  }

  // MARK: - Timers

  private func startTimer(_ kind: MotionGate.TimerKind, in current: Session, generation token: UInt64) {
    cancelTimer(kind, in: current)
    timerSequence &+= 1
    let sequence = timerSequence
    let timer = DispatchSource.makeTimerSource(queue: queue)
    let duration = DispatchTimeInterval.milliseconds(durationMs(of: kind, options: current.options))
    switch kind {
    case .maxReduced, .probe:
      // Wall-clock deadline: it keeps counting while the device sleeps, so the reduced period stays
      // bounded; once overdue, the timer fires at the next wake.
      timer.schedule(wallDeadline: .now() + duration)
    case .dwell, .cooldown:
      timer.schedule(deadline: .now() + duration)
    }
    timer.setEventHandler { [weak self] in
      self?.timerFired(kind, sequence: sequence, generation: token)
    }
    timer.resume()
    current.timers[kind] = ScheduledTimer(source: timer, sequence: sequence)
  }

  private func cancelTimer(_ kind: MotionGate.TimerKind, in current: Session) {
    current.timers.removeValue(forKey: kind)?.source.cancel()
  }

  private func cancelAllTimers(in current: Session) {
    for timer in current.timers.values {
      timer.source.cancel()
    }
    current.timers.removeAll()
  }

  private func timerFired(_ kind: MotionGate.TimerKind, sequence: UInt64, generation token: UInt64) {
    assertOnQueue()
    guard token == generation, let current = session, current.timers[kind]?.sequence == sequence else {
      return
    }
    cancelTimer(kind, in: current)
    if MotionCoordinator.rechecksAuthorization(onTimer: kind, mode: current.gate?.mode) {
      // A revoked permission ends detection (restoring full accuracy when reduced) instead of
      // probing, or reducing on a classifier that went silent.
      guard recheckAuthorization(current, generation: token) else {
        return
      }
    }
    process(.timer(kind), generation: token)
  }

  /// MAX_REDUCED re-reads the authorization in every mode; DWELL and COOLDOWN do while a
  /// reduction is pending (CANDIDATE).
  private static func rechecksAuthorization(onTimer kind: MotionGate.TimerKind, mode: MotionGate.Mode?) -> Bool {
    switch kind {
    case .maxReduced:
      return true
    case .dwell, .cooldown:
      return mode == .candidate
    case .probe:
      return false
    }
  }

  private func durationMs(of kind: MotionGate.TimerKind, options: MotionOptions) -> Int {
    switch kind {
    case .dwell:
      return options.stationaryDelayMs
    case .cooldown:
      return options.automotiveCooldownMs
    case .maxReduced:
      return options.maxReducedDurationMs
    case .probe:
      return MotionGate.probeTimeoutMs
    }
  }

  // MARK: - Permission re-check

  /// Observed only while detection runs.
  private func observeAppActive(_ current: Session, generation token: UInt64) {
    let queue = self.queue
    current.activeObserver = NotificationCenter.default.addObserver(
      forName: UIApplication.didBecomeActiveNotification,
      object: nil,
      queue: nil
    ) { [weak self] _ in
      queue.async {
        guard let self = self, token == self.generation, let current = self.session else {
          return
        }
        self.recheckAuthorization(current, generation: token)
      }
    }
  }

  private func removeAppActiveObserver(_ current: Session) {
    if let observer = current.activeObserver {
      NotificationCenter.default.removeObserver(observer)
      current.activeObserver = nil
    }
  }

  /// Returns true while access is still granted. Otherwise detection is lost: the gate restores
  /// full accuracy (with its warning when it was reduced) and the revocation is reported.
  @discardableResult
  private func recheckAuthorization(_ current: Session, generation token: UInt64) -> Bool {
    guard current.detection == .running, let platform = current.platform else {
      return false
    }
    guard platform.authorizationStatus() != .authorized else {
      return true
    }
    loseDetection(current, generation: token)
    return false
  }

  private func loseDetection(_ current: Session, generation token: UInt64) {
    NSLog("[BackgroundLocation] Motion activity permission was revoked; location tracking continues at full accuracy")
    current.source?.stop()
    current.source = nil
    removeAppActiveObserver(current)
    current.detection = .permissionNotGranted
    process(.detectionLost, generation: token)
    emitDetectionWarning(.revoked, generation: token)
  }

  // MARK: - Warnings

  /// At most one detection warning per session; the first cause wins.
  private func emitDetectionWarning(_ warning: MotionWarning, generation token: UInt64) {
    assertOnQueue()
    guard token == generation, let current = session, !current.detectionWarningSent else {
      return
    }
    guard host?.motionCoordinatorCanEmit() == true else {
      return
    }
    current.detectionWarningSent = true
    host?.motionCoordinatorEmitWarning(warning, tripId: current.tripId)
  }

  private func emitGateWarning(_ warning: MotionWarning, in current: Session) {
    guard host?.motionCoordinatorCanEmit() == true else {
      return
    }
    host?.motionCoordinatorEmitWarning(warning, tripId: current.tripId)
  }

  private func assertOnQueue() {
    #if DEBUG
    dispatchPrecondition(condition: .onQueue(queue))
    #endif
  }
}
