package com.backgroundlocation.motion

import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType
import io.mockk.every
import io.mockk.mockk
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class MotionOptionsTest {

  /** ReadableMap backed by [values]; a `null` value is a JS `null`. */
  private fun readableMap(values: Map<String, Any?>): ReadableMap {
    val map = mockk<ReadableMap>()
    every { map.hasKey(any()) } answers { values.containsKey(firstArg<String>()) }
    every { map.isNull(any()) } answers { values[firstArg<String>()] == null }
    every { map.getType(any()) } answers {
      when (values[firstArg<String>()]) {
        null -> ReadableType.Null
        is Boolean -> ReadableType.Boolean
        is Number -> ReadableType.Number
        is String -> ReadableType.String
        else -> ReadableType.Map
      }
    }
    every { map.getBoolean(any()) } answers { values[firstArg<String>()] as Boolean }
    every { map.getDouble(any()) } answers { (values[firstArg<String>()] as Number).toDouble() }
    every { map.getString(any()) } answers { values[firstArg<String>()] as String? }
    return map
  }

  @Test
  fun `defaults match the documented values`() {
    val defaults = MotionOptions()

    assertEquals(30_000L, defaults.sampleIntervalMs)
    assertEquals(false, defaults.reduceWhenStationary)
    assertEquals(300_000L, defaults.stationaryDelayMs)
    assertEquals(600_000L, defaults.automotiveCooldownMs)
    assertEquals(1_800_000L, defaults.maxReducedDurationMs)
    assertNull(defaults.reducedNotificationText)
    assertEquals("Location updates reduced while stationary", defaults.reducedNotificationTextOrDefault)
    assertEquals(defaults, MotionOptions.normalized())
  }

  @Test
  fun `absent and non-finite values take the defaults`() {
    for (value in listOf(null, Double.NaN, Double.POSITIVE_INFINITY, Double.NEGATIVE_INFINITY)) {
      val options = MotionOptions.normalized(
        sampleInterval = value,
        stationaryDelay = value,
        automotiveCooldown = value,
        maxReducedDuration = value
      )
      assertEquals("value $value", MotionOptions(), options)
    }
  }

  @Test
  fun `out-of-range values are clamped and fractions rounded`() {
    val low = MotionOptions.normalized(
      sampleInterval = -1.0,
      stationaryDelay = 0.0,
      automotiveCooldown = -1.0,
      maxReducedDuration = 0.0
    )
    assertEquals(10_000L, low.sampleIntervalMs)
    assertEquals(60_000L, low.stationaryDelayMs)
    assertEquals(120_000L, low.automotiveCooldownMs)
    assertEquals(300_000L, low.maxReducedDurationMs)

    val huge = Long.MAX_VALUE.toDouble()
    val high = MotionOptions.normalized(
      sampleInterval = huge,
      stationaryDelay = huge,
      automotiveCooldown = huge,
      maxReducedDuration = huge
    )
    assertEquals(300_000L, high.sampleIntervalMs)
    assertEquals(3_600_000L, high.stationaryDelayMs)
    assertEquals(3_600_000L, high.automotiveCooldownMs)
    assertEquals(3_600_000L, high.maxReducedDurationMs)

    val fractional = MotionOptions.normalized(sampleInterval = 12_345.6, stationaryDelay = 90_000.4)
    assertEquals(12_346L, fractional.sampleIntervalMs)
    assertEquals(90_000L, fractional.stationaryDelayMs)
  }

  @Test
  fun `json round trip keeps every field`() {
    val options = MotionOptions.normalized(
      sampleInterval = 15_000.0,
      reduceWhenStationary = true,
      stationaryDelay = 120_000.0,
      automotiveCooldown = 240_000.0,
      maxReducedDuration = 900_000.0,
      reducedNotificationText = "Parked"
    )

    assertEquals(options, MotionOptions.fromJsonString(options.toJsonString()))
    assertEquals(MotionOptions(), MotionOptions.fromJsonString(MotionOptions().toJsonString()))
  }

  @Test
  fun `malformed json gives null`() {
    for (json in listOf("not json", "", "{", "[]", "{\"sampleIntervalMs\":")) {
      assertNull("json '$json'", MotionOptions.fromJsonString(json))
    }
    assertNull(MotionOptions.fromJsonString(null))
  }

  @Test
  fun `stored json values are clamped again`() {
    val options = MotionOptions.fromJsonString(
      "{\"sampleIntervalMs\":1,\"reduceWhenStationary\":true,\"stationaryDelayMs\":99999999," +
        "\"automotiveCooldownMs\":\"600000\",\"reducedNotificationText\":\"  \"}"
    )

    assertEquals(
      MotionOptions(
        sampleIntervalMs = 10_000L,
        reduceWhenStationary = true,
        stationaryDelayMs = 3_600_000L,
        automotiveCooldownMs = 600_000L
      ),
      options
    )
  }

  @Test
  fun `reduce without enabled is ignored`() {
    assertNull(MotionOptions.fromReadableMap(readableMap(mapOf("motionReduceWhenStationary" to true))))
    assertNull(
      MotionOptions.fromReadableMap(
        readableMap(mapOf("motionActivityEnabled" to false, "motionReduceWhenStationary" to true))
      )
    )
  }

  @Test
  fun `a null readable map or a missing enabled flag turns motion off`() {
    assertNull(MotionOptions.fromReadableMap(null))
    assertNull(MotionOptions.fromReadableMap(readableMap(emptyMap())))
    assertNull(MotionOptions.fromReadableMap(readableMap(mapOf("motionActivityEnabled" to null))))
  }

  @Test
  fun `an enabled flag of the wrong type turns motion off`() {
    assertNull(MotionOptions.fromReadableMap(readableMap(mapOf("motionActivityEnabled" to "true"))))
    assertNull(MotionOptions.fromReadableMap(readableMap(mapOf("motionActivityEnabled" to 1))))
  }

  @Test
  fun `wrong-typed and null option values fall back to the defaults`() {
    val options = MotionOptions.fromReadableMap(
      readableMap(
        mapOf(
          "motionActivityEnabled" to true,
          "motionSampleInterval" to "15000",
          "motionReduceWhenStationary" to "yes",
          "motionStationaryDelay" to null,
          "motionAutomotiveCooldown" to true,
          "motionMaxReducedDuration" to Double.NaN,
          "motionReducedNotificationText" to 42
        )
      )
    )

    assertEquals(MotionOptions(), options)
  }

  @Test
  fun `readable map values are read and clamped`() {
    val options = MotionOptions.fromReadableMap(
      readableMap(
        mapOf(
          "motionActivityEnabled" to true,
          "motionSampleInterval" to 5_000.0,
          "motionReduceWhenStationary" to true,
          "motionStationaryDelay" to 120_000.0,
          "motionAutomotiveCooldown" to 7_200_000.0,
          "motionMaxReducedDuration" to 600_000.4,
          "motionReducedNotificationText" to "Parked"
        )
      )
    )

    assertEquals(
      MotionOptions(
        sampleIntervalMs = 10_000L,
        reduceWhenStationary = true,
        stationaryDelayMs = 120_000L,
        automotiveCooldownMs = 3_600_000L,
        maxReducedDurationMs = 600_000L,
        reducedNotificationText = "Parked"
      ),
      options
    )
  }

  @Test
  fun `a blank notification text is dropped`() {
    val options = MotionOptions.fromReadableMap(
      readableMap(mapOf("motionActivityEnabled" to true, "motionReducedNotificationText" to "   "))
    )

    assertNull(options?.reducedNotificationText)
    assertEquals("Location updates reduced while stationary", options?.reducedNotificationTextOrDefault)
  }
}
