package com.backgroundlocation

import com.backgroundlocation.LocationService.ActivityState
import com.backgroundlocation.LocationService.PauseDecision
import com.google.android.gms.location.DetectedActivity
import org.junit.Assert.assertEquals
import org.junit.Test

class ActivityStateTest {

  @Test
  fun `STILL with confidence >= 70 triggers PAUSE when not currently paused and pause enabled`() {
    val state = ActivityState(
      activityType = DetectedActivity.STILL,
      confidence = 75,
      isCurrentlyPaused = false,
      isPauseEnabled = true,
      lastResumeTimestampMs = 0L,
      currentTimeMs = 100_000L
    )
    assertEquals(PauseDecision.PAUSE, LocationService.decidePauseResume(state))
  }

  @Test
  fun `STILL with confidence exactly 70 triggers PAUSE`() {
    val state = ActivityState(
      activityType = DetectedActivity.STILL,
      confidence = 70,
      isCurrentlyPaused = false,
      isPauseEnabled = true,
      lastResumeTimestampMs = 0L,
      currentTimeMs = 100_000L
    )
    assertEquals(PauseDecision.PAUSE, LocationService.decidePauseResume(state))
  }

  @Test
  fun `STILL with confidence below 70 returns NO_CHANGE`() {
    val state = ActivityState(
      activityType = DetectedActivity.STILL,
      confidence = 50,
      isCurrentlyPaused = false,
      isPauseEnabled = true,
      lastResumeTimestampMs = 0L,
      currentTimeMs = 100_000L
    )
    assertEquals(PauseDecision.NO_CHANGE, LocationService.decidePauseResume(state))
  }

  @Test
  fun `IN_VEHICLE returns NO_CHANGE regardless of other parameters`() {
    val state = ActivityState(
      activityType = DetectedActivity.IN_VEHICLE,
      confidence = 99,
      isCurrentlyPaused = false,
      isPauseEnabled = true,
      lastResumeTimestampMs = 0L,
      currentTimeMs = 100_000L
    )
    assertEquals(PauseDecision.NO_CHANGE, LocationService.decidePauseResume(state))
  }

  @Test
  fun `TILTING returns NO_CHANGE`() {
    val state = ActivityState(
      activityType = DetectedActivity.TILTING,
      confidence = 90,
      isCurrentlyPaused = false,
      isPauseEnabled = true,
      lastResumeTimestampMs = 0L,
      currentTimeMs = 100_000L
    )
    assertEquals(PauseDecision.NO_CHANGE, LocationService.decidePauseResume(state))
  }

  @Test
  fun `UNKNOWN returns NO_CHANGE`() {
    val state = ActivityState(
      activityType = DetectedActivity.UNKNOWN,
      confidence = 50,
      isCurrentlyPaused = false,
      isPauseEnabled = true,
      lastResumeTimestampMs = 0L,
      currentTimeMs = 100_000L
    )
    assertEquals(PauseDecision.NO_CHANGE, LocationService.decidePauseResume(state))
  }

  @Test
  fun `already paused with STILL returns NO_CHANGE`() {
    val state = ActivityState(
      activityType = DetectedActivity.STILL,
      confidence = 95,
      isCurrentlyPaused = true,
      isPauseEnabled = true,
      lastResumeTimestampMs = 0L,
      currentTimeMs = 100_000L
    )
    assertEquals(PauseDecision.NO_CHANGE, LocationService.decidePauseResume(state))
  }

  @Test
  fun `already paused with TILTING returns NO_CHANGE`() {
    val state = ActivityState(
      activityType = DetectedActivity.TILTING,
      confidence = 90,
      isCurrentlyPaused = true,
      isPauseEnabled = true,
      lastResumeTimestampMs = 0L,
      currentTimeMs = 100_000L
    )
    assertEquals(PauseDecision.NO_CHANGE, LocationService.decidePauseResume(state))
  }

  @Test
  fun `not paused and not stationary returns NO_CHANGE`() {
    val state = ActivityState(
      activityType = DetectedActivity.WALKING,
      confidence = 80,
      isCurrentlyPaused = false,
      isPauseEnabled = true,
      lastResumeTimestampMs = 0L,
      currentTimeMs = 100_000L
    )
    assertEquals(PauseDecision.NO_CHANGE, LocationService.decidePauseResume(state))
  }

  @Test
  fun `resume grace period: within 30s of resume, NO_CHANGE`() {
    val resumeTime = 100_000L
    val state = ActivityState(
      activityType = DetectedActivity.STILL,
      confidence = 85,
      isCurrentlyPaused = false,
      isPauseEnabled = true,
      lastResumeTimestampMs = resumeTime,
      currentTimeMs = resumeTime + 10_000L  // 10 seconds after resume
    )
    assertEquals(PauseDecision.NO_CHANGE, LocationService.decidePauseResume(state))
  }

  @Test
  fun `resume grace period: exactly at 30s boundary, NO_CHANGE`() {
    val resumeTime = 100_000L
    val state = ActivityState(
      activityType = DetectedActivity.STILL,
      confidence = 85,
      isCurrentlyPaused = false,
      isPauseEnabled = true,
      lastResumeTimestampMs = resumeTime,
      currentTimeMs = resumeTime + 29_999L  // 29999ms < 30000ms
    )
    assertEquals(PauseDecision.NO_CHANGE, LocationService.decidePauseResume(state))
  }

  @Test
  fun `resume grace period: after 30s of resume, PAUSE`() {
    val resumeTime = 100_000L
    val state = ActivityState(
      activityType = DetectedActivity.STILL,
      confidence = 85,
      isCurrentlyPaused = false,
      isPauseEnabled = true,
      lastResumeTimestampMs = resumeTime,
      currentTimeMs = resumeTime + 35_000L  // 35 seconds after resume
    )
    assertEquals(PauseDecision.PAUSE, LocationService.decidePauseResume(state))
  }

  @Test
  fun `STILL but pause not enabled returns NO_CHANGE`() {
    val state = ActivityState(
      activityType = DetectedActivity.STILL,
      confidence = 95,
      isCurrentlyPaused = false,
      isPauseEnabled = false,
      lastResumeTimestampMs = 0L,
      currentTimeMs = 100_000L
    )
    assertEquals(PauseDecision.NO_CHANGE, LocationService.decidePauseResume(state))
  }

  @Test
  fun `not paused but moving triggers RESUME`() {
    val state = ActivityState(
      activityType = DetectedActivity.WALKING,
      confidence = 80,
      isCurrentlyPaused = true,
      isPauseEnabled = true,
      lastResumeTimestampMs = 0L,
      currentTimeMs = 100_000L
    )
    assertEquals(PauseDecision.RESUME, LocationService.decidePauseResume(state))
  }

  @Test
  fun `STILL with lastResumeTimestampMs at 0 returns PAUSE`() {
    val state = ActivityState(
      activityType = DetectedActivity.STILL,
      confidence = 80,
      isCurrentlyPaused = false,
      isPauseEnabled = true,
      lastResumeTimestampMs = 0L,
      currentTimeMs = 100_000L
    )
    // currentTimeMs - lastResumeTimestampMs = 100000 >= 30000, outside grace period
    assertEquals(PauseDecision.PAUSE, LocationService.decidePauseResume(state))
  }
}
