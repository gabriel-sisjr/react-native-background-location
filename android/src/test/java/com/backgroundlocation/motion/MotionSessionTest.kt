package com.backgroundlocation.motion

import com.backgroundlocation.LocationAccuracy
import com.backgroundlocation.TrackingOptions
import com.backgroundlocation.motion.MotionGate.FixKind
import com.backgroundlocation.motion.MotionGate.TimerKind
import com.google.android.gms.common.api.ApiException
import com.google.android.gms.common.api.Status
import com.google.android.gms.location.ActivityTransition
import com.google.android.gms.location.DetectedActivity
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class MotionSessionTest {

  private class FakePlatform : MotionPlatform {
    override var sdkInt: Int = 34
    var playServices = true
    var granted = true
    var availabilityChecks = 0
    val checkedPermissions = mutableListOf<String>()

    override fun isPlayServicesAvailable(): Boolean {
      availabilityChecks++
      return playServices
    }

    override fun isGranted(permission: String): Boolean {
      checkedPermissions += permission
      return granted
    }
  }

  private class FakeClient : MotionRecognitionClient {
    var sampleIntervalMs: Long? = null
    var transitionsRequested = false
    var samplesRemoved = 0
    var transitionsRemoved = 0
    var failOnSamples: Exception? = null
    val failureCallbacks = mutableListOf<(Exception) -> Unit>()

    override fun requestActivityUpdates(intervalMs: Long, onFailure: (Exception) -> Unit) {
      failOnSamples?.let { throw it }
      sampleIntervalMs = intervalMs
      failureCallbacks += onFailure
    }

    override fun requestTransitionUpdates(onFailure: (Exception) -> Unit) {
      transitionsRequested = true
      failureCallbacks += onFailure
    }

    override fun removeActivityUpdates() {
      samplesRemoved++
    }

    override fun removeTransitionUpdates() {
      transitionsRemoved++
    }
  }

  private class FakeTimers : MotionTimers {
    /** kind -> (duration, token) */
    val armed = mutableMapOf<TimerKind, Pair<Long, Long>>()

    /** Kinds the platform refuses to arm. */
    val failing = mutableSetOf<TimerKind>()

    override fun start(kind: TimerKind, durationMs: Long, token: Long): Boolean {
      if (kind in failing) return false
      armed[kind] = durationMs to token
      return true
    }

    override fun cancel(kind: TimerKind) {
      armed.remove(kind)
    }

    override fun cancelAll() {
      armed.clear()
    }
  }

  private class FakeHost : MotionHost {
    val calls = mutableListOf<String>()

    override fun applyReducedProfile() {
      calls += "reduced profile"
    }

    override fun applyFullProfile() {
      calls += "full profile"
    }

    override fun flushStorage() {
      calls += "flush"
    }

    override fun showReducedNotification(text: String) {
      calls += "notification: $text"
    }

    override fun showBaseNotification() {
      calls += "notification: base"
    }
  }

  private class FakeSink : MotionEventSink {
    val events = mutableListOf<MotionActivityEvent>()
    val warnings = mutableListOf<Pair<String, String>>()
    var lastSnapshot: MotionStateSnapshot? = null

    override fun emitMotionActivity(event: MotionActivityEvent) {
      events += event
    }

    override fun emitWarning(tripId: String, type: String, message: String) {
      assertEquals(TRIP, tripId)
      warnings += type to message
    }

    override fun publishState(snapshot: MotionStateSnapshot) {
      lastSnapshot = snapshot
    }
  }

  private val platform = FakePlatform()
  private val client = FakeClient()
  private val timers = FakeTimers()
  private val host = FakeHost()
  private val sink = FakeSink()
  private var clientFactoryCalls = 0
  private var staleRemovals = 0
  private var stopRequested = false
  private var nowNanos = 1_000_000_000L

  private val session = MotionSession(
    platform = platform,
    clientFactory = {
      clientFactoryCalls++
      client
    },
    timers = timers,
    host = host,
    sink = sink,
    removeStale = { staleRemovals++ },
    isStopRequested = { stopRequested },
    elapsedRealtimeNanos = { nowNanos }
  )

  private fun options(
    reduce: Boolean = true,
    foregroundOnly: Boolean? = null,
    accuracy: LocationAccuracy? = null,
    distanceFilter: Float? = null
  ) = TrackingOptions(
    accuracy = accuracy,
    foregroundOnly = foregroundOnly,
    distanceFilter = distanceFilter,
    motion = MotionOptions(reduceWhenStationary = reduce)
  )

  private fun sampleOf(type: Int, confidence: Int, timestampMs: Long = 1_000L): MotionDelivery.Sample {
    val mostProbable = DetectedActivityInput(type, confidence)
    return MotionDelivery.Sample(mostProbable, listOf(mostProbable), timestampMs)
  }

  private fun fire(kind: TimerKind) {
    val token = timers.armed.getValue(kind).second
    session.deliver(MotionDelivery.Timer(kind, token))
  }

  /** start -> cooldown expiry -> full fix -> stillness -> dwell expiry (G22). */
  private fun driveToReduced(trackingOptions: TrackingOptions = options()) {
    session.start(TRIP, trackingOptions)
    fire(TimerKind.COOLDOWN)
    session.onFix(0.0, 0.0, 10.0, FixKind.FULL)
    session.deliver(sampleOf(DetectedActivity.STILL, 95))
    fire(TimerKind.DWELL)
  }

  /** Candidate whose dwell is done but without an anchor: the next full fix lets it reduce. */
  private fun driveToCandidateWithoutAnchor() {
    session.start(TRIP, options())
    fire(TimerKind.COOLDOWN)
    session.deliver(sampleOf(DetectedActivity.STILL, 95))
    fire(TimerKind.DWELL)
    assertEquals(MotionGate.Mode.CANDIDATE, session.gateMode)
  }

  /** A fix as the host sees it: position and its own accuracy. */
  private data class HostFix(val lat: Double, val lon: Double, val accuracyM: Double)

  /** Routes [fix] like the service does; record and feed calls are logged next to the host effects. */
  private fun route(fix: HostFix, recorded: Boolean = true) {
    session.routeFix(
      fix = fix,
      fixElapsedRealtimeNanos = nowNanos,
      record = { candidate ->
        host.calls += "record"
        candidate.takeIf { recorded }
      },
      feed = { routed, kind ->
        host.calls += "feed $kind"
        session.onFix(routed.lat, routed.lon, routed.accuracyM, kind)
      }
    )
  }

  /** Latitude [metres] north of the origin on its meridian, where the haversine distance is exact. */
  private fun latitudeNorthOf(metres: Double): Double = Math.toDegrees(metres / EARTH_RADIUS_M)

  @Test
  fun `motion off never invokes the client factory`() {
    session.start(TRIP, TrackingOptions())

    assertEquals(0, clientFactoryCalls)
    assertEquals(0, platform.availabilityChecks)
    assertTrue(platform.checkedPermissions.isEmpty())
    assertEquals(1, staleRemovals)
    assertFalse(session.isActive)
    assertTrue(sink.warnings.isEmpty())
    assertTrue(timers.armed.isEmpty())
    assertEquals(MotionStateSnapshot.OFF, sink.lastSnapshot)
  }

  @Test
  fun `missing permission emits one warning and registers nothing`() {
    platform.granted = false

    session.start(TRIP, options())

    assertEquals(0, clientFactoryCalls)
    assertEquals(listOf("android.permission.ACTIVITY_RECOGNITION"), platform.checkedPermissions)
    assertEquals(
      listOf(MotionWarnings.TYPE_PERMISSION_NOT_GRANTED to MotionWarnings.PLATFORM_PERMISSION_NOT_GRANTED),
      sink.warnings
    )
    assertTrue(timers.armed.isEmpty())
    assertEquals(MotionDetectionStatus.PERMISSION_NOT_GRANTED, sink.lastSnapshot?.detection)
    assertEquals(MotionReductionStatus.UNAVAILABLE, sink.lastSnapshot?.reduction)
  }

  @Test
  fun `missing permission on API 28 names the undeclared Play services permission`() {
    platform.sdkInt = 28
    platform.granted = false

    session.start(TRIP, options())

    assertEquals(listOf("com.google.android.gms.permission.ACTIVITY_RECOGNITION"), platform.checkedPermissions)
    assertEquals(
      listOf(MotionWarnings.TYPE_PERMISSION_NOT_GRANTED to MotionWarnings.PLAY_SERVICES_PERMISSION_NOT_DECLARED),
      sink.warnings
    )
    assertEquals(0, clientFactoryCalls)
  }

  @Test
  fun `Play services missing emits one warning`() {
    platform.playServices = false

    session.start(TRIP, options())

    assertEquals(0, clientFactoryCalls)
    assertEquals(
      listOf(MotionWarnings.TYPE_ACTIVITY_UNAVAILABLE to MotionWarnings.PLAY_SERVICES_UNAVAILABLE),
      sink.warnings
    )
    assertEquals(MotionDetectionStatus.UNAVAILABLE, sink.lastSnapshot?.detection)
    assertEquals(MotionReductionStatus.UNAVAILABLE, sink.lastSnapshot?.reduction)
  }

  @Test
  fun `Task failure tears down, warns once and loses detection`() {
    session.start(TRIP, options())
    assertEquals(30_000L, client.sampleIntervalMs)
    assertTrue(client.transitionsRequested)
    assertEquals(2, client.failureCallbacks.size)
    assertTrue(timers.armed.containsKey(TimerKind.COOLDOWN))

    client.failureCallbacks[0](ApiException(Status(17)))
    client.failureCallbacks[1](IllegalArgumentException("second failure"))

    assertEquals(1, client.samplesRemoved)
    assertEquals(1, client.transitionsRemoved)
    assertEquals(
      listOf(MotionWarnings.TYPE_ACTIVITY_UNAVAILABLE to MotionWarnings.couldNotStart("status 17")),
      sink.warnings
    )
    assertTrue(timers.armed.isEmpty())
    assertEquals(MotionDetectionStatus.UNAVAILABLE, sink.lastSnapshot?.detection)
    assertEquals(MotionReductionStatus.UNAVAILABLE, sink.lastSnapshot?.reduction)
    assertNull(session.gateMode)
  }

  @Test
  fun `detection lost while reduced restores full accuracy before the cause warning`() {
    driveToReduced()

    client.failureCallbacks[0](SecurityException("revoked"))

    assertEquals(
      listOf(
        MotionWarnings.TYPE_LOCATION_REDUCED to MotionWarnings.LOCATION_REDUCED,
        MotionWarnings.TYPE_LOCATION_RESTORED to MotionWarnings.RESTORED_DETECTION_LOST,
        MotionWarnings.TYPE_PERMISSION_NOT_GRANTED to MotionWarnings.PERMISSION_REVOKED
      ),
      sink.warnings
    )
    assertEquals("full profile", host.calls.filter { it.endsWith("profile") }.last())
    assertEquals(MotionDetectionStatus.PERMISSION_NOT_GRANTED, sink.lastSnapshot?.detection)
    assertEquals(MotionReductionStatus.UNAVAILABLE, sink.lastSnapshot?.reduction)
  }

  @Test
  fun `a synchronous SecurityException reports the permission as revoked`() {
    client.failOnSamples = SecurityException("not allowed")

    session.start(TRIP, options())

    assertEquals(
      listOf(MotionWarnings.TYPE_PERMISSION_NOT_GRANTED to MotionWarnings.PERMISSION_REVOKED),
      sink.warnings
    )
    assertEquals(1, client.samplesRemoved)
    assertEquals(1, client.transitionsRemoved)
    assertTrue(timers.armed.isEmpty())
  }

  @Test
  fun `stop removes both registrations and cancels all timers`() {
    session.start(TRIP, options())
    assertFalse(timers.armed.isEmpty())

    session.stop(MotionSession.StopReason.STOP)

    assertEquals(1, client.samplesRemoved)
    assertEquals(1, client.transitionsRemoved)
    assertTrue(timers.armed.isEmpty())
    assertTrue(sink.warnings.isEmpty())
    assertFalse(session.isActive)
    assertEquals(MotionStateSnapshot.OFF, sink.lastSnapshot)
  }

  @Test
  fun `nothing is emitted after the stop token`() {
    session.start(TRIP, options())
    fire(TimerKind.COOLDOWN)
    session.onFix(0.0, 0.0, 10.0, FixKind.FULL)
    session.deliver(sampleOf(DetectedActivity.STILL, 95))
    assertEquals(1, sink.events.size)

    stopRequested = true
    fire(TimerKind.DWELL)
    session.deliver(sampleOf(DetectedActivity.WALKING, 90))

    assertEquals(1, sink.events.size)
    assertTrue(sink.warnings.isEmpty())
    assertFalse(host.calls.contains("reduced profile"))
    assertEquals(MotionGate.Mode.CANDIDATE, session.gateMode)
  }

  @Test
  fun `snapshot reports REDUCED after G22`() {
    driveToReduced()

    assertEquals(MotionReductionStatus.REDUCED, sink.lastSnapshot?.reduction)
    assertEquals(MotionDetectionStatus.RUNNING, sink.lastSnapshot?.detection)
    assertEquals(TRIP, sink.lastSnapshot?.tripId)
    assertEquals(
      listOf("flush", "reduced profile", "notification: Location updates reduced while stationary"),
      host.calls
    )
    assertEquals(listOf(MotionWarnings.TYPE_LOCATION_REDUCED to MotionWarnings.LOCATION_REDUCED), sink.warnings)
    assertEquals(MotionOptions.DEFAULT_MAX_REDUCED_DURATION_MS, timers.armed.getValue(TimerKind.MAX_REDUCED).first)

    val json = JSONObject(session.snapshot().toJsonString())
    assertEquals(TRIP, json.getString("tripId"))
    assertEquals("RUNNING", json.getString("detection"))
    assertEquals("REDUCED", json.getString("reduction"))
    assertEquals("STATIONARY", json.getJSONObject("lastActivity").getString("activity"))
    assertEquals("HIGH", json.getJSONObject("lastActivity").getString("confidence"))
  }

  @Test
  fun `receiver without a session removes stale registrations`() {
    var removals = 0
    val delivery = sampleOf(DetectedActivity.STILL, 95)

    MotionActivityReceiver.dispatch(delivery, session = null, stopTokenSet = false) { removals++ }
    assertEquals(1, removals)

    session.start(TRIP, options())
    MotionActivityReceiver.dispatch(delivery, session = session, stopTokenSet = true) { removals++ }
    assertEquals(2, removals)
    assertTrue(sink.events.isEmpty())

    MotionActivityReceiver.dispatch(delivery, session = session, stopTokenSet = false) { removals++ }
    assertEquals(2, removals)
    assertEquals(1, sink.events.size)
  }

  @Test
  fun `the first event of a session is always emitted and repeats are dropped`() {
    session.start(TRIP, options(reduce = false))
    session.deliver(sampleOf(DetectedActivity.STILL, 95, timestampMs = 1L))
    session.deliver(sampleOf(DetectedActivity.STILL, 90, timestampMs = 2L))
    session.deliver(sampleOf(DetectedActivity.STILL, 60, timestampMs = 3L))
    session.deliver(sampleOf(DetectedActivity.WALKING, 80, timestampMs = 4L))

    assertEquals(
      listOf(
        MotionActivityEvent(TRIP, MotionActivityType.STATIONARY, MotionConfidence.HIGH, 1L),
        MotionActivityEvent(TRIP, MotionActivityType.STATIONARY, MotionConfidence.MEDIUM, 3L),
        MotionActivityEvent(TRIP, MotionActivityType.WALKING, MotionConfidence.HIGH, 4L)
      ),
      sink.events
    )

    session.stop(MotionSession.StopReason.STOP)
    session.start(TRIP, options(reduce = false))
    session.deliver(sampleOf(DetectedActivity.WALKING, 80, timestampMs = 5L))

    assertEquals(MotionActivityEvent(TRIP, MotionActivityType.WALKING, MotionConfidence.HIGH, 5L), sink.events.last())
    assertEquals(MotionReductionStatus.DISABLED, sink.lastSnapshot?.reduction)
  }

  @Test
  fun `foreground-only trips keep raw events but never arm the gate`() {
    session.start(TRIP, options(foregroundOnly = true))
    session.deliver(sampleOf(DetectedActivity.STILL, 95))

    assertTrue(timers.armed.isEmpty())
    assertNull(session.gateMode)
    assertNull(session.classifyFix(nowNanos))
    assertEquals(1, sink.events.size)
    assertTrue(sink.warnings.isEmpty())
    assertEquals(MotionReductionStatus.NOT_APPLICABLE, sink.lastSnapshot?.reduction)
  }

  @Test
  fun `fixes are keep-alive while reduced and before the last full-accuracy restore`() {
    session.start(TRIP, options())
    assertEquals(FixKind.FULL, session.classifyFix(1L))

    driveToReduced()
    assertEquals(FixKind.KEEPALIVE, session.classifyFix(nowNanos + 1))

    nowNanos = 5_000_000_000L
    session.deliver(sampleOf(DetectedActivity.WALKING, 90))

    assertEquals(MotionGate.Mode.MONITORING, session.gateMode)
    assertEquals(FixKind.KEEPALIVE, session.classifyFix(nowNanos - 1))
    assertEquals(FixKind.FULL, session.classifyFix(nowNanos))
    assertEquals(
      MotionWarnings.TYPE_LOCATION_RESTORED to MotionWarnings.RESTORED_MOTION,
      sink.warnings.last()
    )
    assertEquals("notification: base", host.calls.last())
  }

  @Test
  fun `a keep-alive fix far from the anchor restores full accuracy`() {
    driveToReduced()

    session.onFix(0.02, 0.0, 500.0, FixKind.KEEPALIVE)

    assertEquals(MotionGate.Mode.MONITORING, session.gateMode)
    assertEquals(
      MotionWarnings.TYPE_LOCATION_RESTORED to MotionWarnings.RESTORED_DISPLACEMENT,
      sink.warnings.last()
    )
  }

  @Test
  fun `restart while reduced announces the restore once`() {
    driveToReduced()

    session.stop(MotionSession.StopReason.RESTART)

    assertEquals(
      listOf(
        MotionWarnings.TYPE_LOCATION_REDUCED to MotionWarnings.LOCATION_REDUCED,
        MotionWarnings.TYPE_LOCATION_RESTORED to MotionWarnings.RESTORED_SESSION_RESTART
      ),
      sink.warnings
    )
    assertTrue(host.calls.contains("full profile"))
    assertTrue(timers.armed.isEmpty())
    assertEquals(1, client.samplesRemoved)
    assertEquals(MotionStateSnapshot.OFF, sink.lastSnapshot)
  }

  @Test
  fun `stale timer tokens are ignored`() {
    session.start(TRIP, options())
    val cooldownToken = timers.armed.getValue(TimerKind.COOLDOWN).second
    session.onFix(0.0, 0.0, 10.0, FixKind.FULL)
    session.deliver(sampleOf(DetectedActivity.STILL, 95))

    session.deliver(MotionDelivery.Timer(TimerKind.COOLDOWN, cooldownToken + 1))
    fire(TimerKind.DWELL)
    assertEquals(MotionGate.Mode.CANDIDATE, session.gateMode)

    session.deliver(MotionDelivery.Timer(TimerKind.COOLDOWN, cooldownToken))
    assertEquals(MotionGate.Mode.REDUCED, session.gateMode)
  }

  @Test
  fun `a revoked permission found at the max reduced duration ends detection`() {
    driveToReduced()
    platform.granted = false

    fire(TimerKind.MAX_REDUCED)

    assertEquals(
      listOf(
        MotionWarnings.TYPE_LOCATION_REDUCED to MotionWarnings.LOCATION_REDUCED,
        MotionWarnings.TYPE_LOCATION_RESTORED to MotionWarnings.RESTORED_DETECTION_LOST,
        MotionWarnings.TYPE_PERMISSION_NOT_GRANTED to MotionWarnings.PERMISSION_REVOKED
      ),
      sink.warnings
    )
    assertEquals(1, client.samplesRemoved)
    assertTrue(timers.armed.isEmpty())
    assertNull(session.gateMode)
  }

  @Test
  fun `timer durations follow the options`() {
    session.start(
      TRIP,
      TrackingOptions(
        motion = MotionOptions(
          reduceWhenStationary = true,
          stationaryDelayMs = 120_000L,
          automotiveCooldownMs = 180_000L,
          maxReducedDurationMs = 400_000L
        )
      )
    )
    assertEquals(180_000L, timers.armed.getValue(TimerKind.COOLDOWN).first)

    fire(TimerKind.COOLDOWN)
    session.onFix(0.0, 0.0, 10.0, FixKind.FULL)
    session.deliver(sampleOf(DetectedActivity.STILL, 95))
    assertEquals(120_000L, timers.armed.getValue(TimerKind.DWELL).first)

    fire(TimerKind.DWELL)
    assertEquals(400_000L, timers.armed.getValue(TimerKind.MAX_REDUCED).first)

    fire(TimerKind.MAX_REDUCED)
    assertEquals(MotionGate.PROBE_TIMEOUT_MS, timers.armed.getValue(TimerKind.PROBE).first)
  }

  @Test
  fun `a cooldown timer that cannot be armed at start ends detection with the AlarmManager warning`() {
    timers.failing += TimerKind.COOLDOWN

    session.start(TRIP, options())

    assertEquals(listOf(MotionWarnings.TYPE_ACTIVITY_UNAVAILABLE to ALARM_MANAGER_WARNING), sink.warnings)
    assertEquals(1, client.samplesRemoved)
    assertEquals(1, client.transitionsRemoved)
    assertTrue(timers.armed.isEmpty())
    assertTrue(host.calls.isEmpty())
    assertNull(session.gateMode)
    assertEquals(MotionDetectionStatus.UNAVAILABLE, sink.lastSnapshot?.detection)
    assertEquals(MotionReductionStatus.UNAVAILABLE, sink.lastSnapshot?.reduction)
  }

  @Test
  fun `a dwell timer that cannot be armed turns the gate off silently before the AlarmManager warning`() {
    session.start(TRIP, options())
    fire(TimerKind.COOLDOWN)
    session.onFix(0.0, 0.0, 10.0, FixKind.FULL)
    timers.failing += TimerKind.DWELL

    session.deliver(sampleOf(DetectedActivity.STILL, 95))

    assertEquals(listOf(MotionWarnings.TYPE_ACTIVITY_UNAVAILABLE to ALARM_MANAGER_WARNING), sink.warnings)
    assertTrue(host.calls.isEmpty())
    assertTrue(timers.armed.isEmpty())
    assertNull(session.gateMode)
  }

  @Test
  fun `a timer that cannot be armed in a transition batch drops the rest of the batch`() {
    session.start(TRIP, options())
    timers.failing += TimerKind.COOLDOWN

    session.deliver(
      MotionDelivery.Transitions(
        listOf(
          TransitionInput(DetectedActivity.IN_VEHICLE, ActivityTransition.ACTIVITY_TRANSITION_EXIT, 1_000L),
          TransitionInput(DetectedActivity.STILL, ActivityTransition.ACTIVITY_TRANSITION_ENTER, 2_000L)
        )
      )
    )

    assertEquals(listOf(MotionWarnings.TYPE_ACTIVITY_UNAVAILABLE to ALARM_MANAGER_WARNING), sink.warnings)
    assertTrue(sink.events.isEmpty())
    assertNull(sink.lastSnapshot?.lastActivity)
    assertEquals(MotionDetectionStatus.UNAVAILABLE, sink.lastSnapshot?.detection)
  }

  @Test
  fun `a max reduced timer that cannot be armed restores full accuracy before the AlarmManager warning`() {
    session.start(TRIP, options())
    fire(TimerKind.COOLDOWN)
    session.onFix(0.0, 0.0, 10.0, FixKind.FULL)
    session.deliver(sampleOf(DetectedActivity.STILL, 95))
    timers.failing += TimerKind.MAX_REDUCED

    fire(TimerKind.DWELL)

    assertEquals(
      listOf(
        MotionWarnings.TYPE_LOCATION_REDUCED to MotionWarnings.LOCATION_REDUCED,
        MotionWarnings.TYPE_LOCATION_RESTORED to MotionWarnings.RESTORED_DETECTION_LOST,
        MotionWarnings.TYPE_ACTIVITY_UNAVAILABLE to ALARM_MANAGER_WARNING
      ),
      sink.warnings
    )
    assertEquals(
      listOf(
        "flush",
        "reduced profile",
        "notification: Location updates reduced while stationary",
        "full profile",
        "notification: base"
      ),
      host.calls
    )
    assertTrue(timers.armed.isEmpty())
    assertNull(session.gateMode)
    assertEquals(1, client.samplesRemoved)
    assertEquals(MotionDetectionStatus.UNAVAILABLE, sink.lastSnapshot?.detection)
  }

  @Test
  fun `a probe timer that cannot be armed ends detection at full accuracy instead of acting as expired`() {
    driveToReduced()
    timers.failing += TimerKind.PROBE

    fire(TimerKind.MAX_REDUCED)

    assertEquals(
      listOf(
        MotionWarnings.TYPE_LOCATION_REDUCED to MotionWarnings.LOCATION_REDUCED,
        MotionWarnings.TYPE_LOCATION_RESTORED to MotionWarnings.RESTORED_DETECTION_LOST,
        MotionWarnings.TYPE_ACTIVITY_UNAVAILABLE to ALARM_MANAGER_WARNING
      ),
      sink.warnings
    )
    // Full accuracy last: an expired probe would have gone back to the reduced profile
    assertEquals(listOf("full profile", "notification: base"), host.calls.takeLast(2))
    assertEquals(1, host.calls.count { it == "reduced profile" })
    assertTrue(timers.armed.isEmpty())
    assertNull(session.gateMode)
    assertNull(session.classifyFix(nowNanos))
  }

  @Test
  fun `the trip distance filter widens full fixes so a keep-alive fix within it does not restore`() {
    driveToReduced(options(distanceFilter = 150f))

    session.onFix(latitudeNorthOf(150.0), 0.0, 30.0, FixKind.KEEPALIVE)

    assertEquals(MotionGate.Mode.REDUCED, session.gateMode)
    assertEquals(listOf(MotionWarnings.TYPE_LOCATION_REDUCED to MotionWarnings.LOCATION_REDUCED), sink.warnings)
  }

  @Test
  fun `without a distance filter a keep-alive fix 150 m away restores full accuracy`() {
    driveToReduced()

    session.onFix(latitudeNorthOf(150.0), 0.0, 30.0, FixKind.KEEPALIVE)

    assertEquals(MotionGate.Mode.MONITORING, session.gateMode)
    assertEquals(
      MotionWarnings.TYPE_LOCATION_RESTORED to MotionWarnings.RESTORED_DISPLACEMENT,
      sink.warnings.last()
    )
  }

  @Test
  fun `a probe fix is judged on its own accuracy when the distance filter widens it`() {
    driveToReduced(options(distanceFilter = 150f))
    fire(TimerKind.MAX_REDUCED)
    assertEquals(MotionGate.Mode.PROBING, session.gateMode)

    session.onFix(0.0, 0.0, 10.0, FixKind.FULL)

    assertEquals(MotionGate.Mode.REDUCED, session.gateMode)
    assertTrue(timers.armed.containsKey(TimerKind.MAX_REDUCED))
    assertFalse(timers.armed.containsKey(TimerKind.PROBE))
  }

  @Test
  fun `a full fix is recorded before it reaches the gate and before the effects it triggers`() {
    driveToCandidateWithoutAnchor()

    route(HostFix(0.0, 0.0, 10.0))

    assertEquals(
      listOf(
        "record",
        "feed FULL",
        "flush",
        "reduced profile",
        "notification: Location updates reduced while stationary"
      ),
      host.calls
    )
    assertEquals(MotionGate.Mode.REDUCED, session.gateMode)
  }

  @Test
  fun `a full fix that was not recorded never reaches the gate`() {
    driveToCandidateWithoutAnchor()

    route(HostFix(0.0, 0.0, 10.0), recorded = false)

    assertEquals(listOf("record"), host.calls)
    assertEquals(MotionGate.Mode.CANDIDATE, session.gateMode)
  }

  @Test
  fun `a keep-alive fix only feeds the gate and is never recorded`() {
    driveToReduced()
    host.calls.clear()

    route(HostFix(0.0, 0.0, 30.0))

    assertEquals(listOf("feed KEEPALIVE"), host.calls)
    assertEquals(MotionGate.Mode.REDUCED, session.gateMode)
  }

  @Test
  fun `without a gate every fix is only recorded`() {
    session.start(TRIP, TrackingOptions())

    route(HostFix(0.0, 0.0, 10.0))

    assertEquals(listOf("record"), host.calls)
  }

  private companion object {
    const val TRIP = "trip-motion"
    const val EARTH_RADIUS_M = 6_371_000.0
    const val ALARM_MANAGER_WARNING =
      "Motion activity could not start (AlarmManager). Location tracking continues at full accuracy."
  }
}
