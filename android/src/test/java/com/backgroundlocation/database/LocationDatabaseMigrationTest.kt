package com.backgroundlocation.database

import android.content.Context
import androidx.room.Room
import androidx.room.testing.MigrationTestHelper
import androidx.sqlite.db.SupportSQLiteDatabase
import androidx.test.core.app.ApplicationProvider
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Schema v1 -> v2 upgrade. The schemas are the KSP exports under `android/schemas`,
 * served to MigrationTestHelper as test assets.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class LocationDatabaseMigrationTest {

  @get:Rule
  val helper = MigrationTestHelper(
    InstrumentationRegistry.getInstrumentation(),
    LocationDatabase::class.java
  )

  private val context: Context = ApplicationProvider.getApplicationContext()

  @After
  fun tearDown() {
    context.deleteDatabase(TEST_DB)
  }

  @Test
  fun `v1 database with rows in all four tables migrates to v2 with every row intact`() {
    helper.createDatabase(TEST_DB, 1).use { insertV1Rows(it) }

    val db = helper.runMigrationsAndValidate(TEST_DB, 2, true, LocationDatabase.MIGRATION_1_2)

    db.query("SELECT tripId, latitude, longitude, timestamp, accuracy, provider, isFromMockProvider FROM locations")
      .use { cursor ->
        assertEquals(1, cursor.count)
        cursor.moveToFirst()
        assertEquals("trip-v1", cursor.getString(0))
        assertEquals(-23.5, cursor.getDouble(1), 0.0)
        assertEquals(-46.6, cursor.getDouble(2), 0.0)
        assertEquals(1_700_000_000_000L, cursor.getLong(3))
        assertEquals(5.0, cursor.getDouble(4), 0.0)
        assertEquals("fused", cursor.getString(5))
        assertEquals(0, cursor.getInt(6))
      }

    db.query(
      "SELECT isActive, tripId, updateInterval, fastestInterval, maxWaitTime, accuracy, " +
        "waitForAccurateLocation, foregroundOnly, notificationOptionsJson, distanceFilter, motionOptionsJson " +
        "FROM tracking_state WHERE id = 1"
    ).use { cursor ->
      assertEquals(1, cursor.count)
      cursor.moveToFirst()
      assertEquals(1, cursor.getInt(0))
      assertEquals("trip-v1", cursor.getString(1))
      assertEquals(5_000L, cursor.getLong(2))
      assertEquals(3_000L, cursor.getLong(3))
      assertEquals(10_000L, cursor.getLong(4))
      assertEquals("HIGH_ACCURACY", cursor.getString(5))
      assertEquals(0, cursor.getInt(6))
      assertEquals(0, cursor.getInt(7))
      assertEquals(NOTIFICATION_JSON, cursor.getString(8))
      assertTrue("distanceFilter is NULL", cursor.isNull(9))
      assertTrue("motionOptionsJson is NULL", cursor.isNull(10))
    }

    db.query("SELECT identifier, radius, transitionTypes, loiteringDelay, metadata, createdAt FROM geofences")
      .use { cursor ->
        assertEquals(1, cursor.count)
        cursor.moveToFirst()
        assertEquals("home", cursor.getString(0))
        assertEquals(150.0, cursor.getDouble(1), 0.0)
        assertEquals(3, cursor.getInt(2))
        assertEquals(30_000, cursor.getInt(3))
        assertEquals(GEOFENCE_METADATA, cursor.getString(4))
        assertEquals(1_700_000_000_000L, cursor.getLong(5))
      }

    db.query("SELECT geofenceId, transitionType, distanceFromCenter, timestamp FROM geofence_transitions")
      .use { cursor ->
        assertEquals(1, cursor.count)
        cursor.moveToFirst()
        assertEquals("home", cursor.getString(0))
        assertEquals("ENTER", cursor.getString(1))
        assertEquals(12.5, cursor.getDouble(2), 0.0)
        assertEquals(1_700_000_000_500L, cursor.getLong(3))
      }
  }

  @Test
  fun `room opens the migrated database through the shared migration policy and reads the tracking state`() {
    helper.createDatabase(TEST_DB, 1).use { insertV1Rows(it) }

    val database = LocationDatabase.applyMigrationPolicy(
      Room.databaseBuilder(context, LocationDatabase::class.java, TEST_DB)
    ).allowMainThreadQueries().build()

    try {
      val state = runBlocking { database.trackingStateDao().getTrackingState() }
      assertNotNull(state)
      assertEquals(true, state?.isActive)
      assertEquals("trip-v1", state?.tripId)
      assertEquals(5_000L, state?.updateInterval)
      assertEquals("HIGH_ACCURACY", state?.accuracy)
      assertEquals(NOTIFICATION_JSON, state?.notificationOptionsJson)
      assertNull(state?.distanceFilter)
      assertNull(state?.motionOptionsJson)

      // Nothing was dropped by the destructive fallback
      assertEquals(1, runBlocking { database.locationDao().getLocationCount("trip-v1") })
      assertEquals(1, runBlocking { database.geofenceDao().getGeofenceCount() })
      assertEquals(1, runBlocking { database.geofenceDao().getAllTransitions() }.size)
    } finally {
      database.close()
    }
  }

  @Test
  fun `a fresh v2 database round-trips distanceFilter and motionOptionsJson`() {
    val database = Room.inMemoryDatabaseBuilder(context, LocationDatabase::class.java)
      .allowMainThreadQueries()
      .build()

    try {
      val motionJson = "{\"sampleIntervalMs\":30000,\"reduceWhenStationary\":true}"
      runBlocking {
        database.trackingStateDao().upsert(
          TrackingStateEntity(
            id = 1,
            isActive = true,
            tripId = "trip-v2",
            distanceFilter = 25.5f,
            motionOptionsJson = motionJson
          )
        )
      }

      val state = runBlocking { database.trackingStateDao().getTrackingState() }
      assertEquals(25.5f, state?.distanceFilter)
      assertEquals(motionJson, state?.motionOptionsJson)
      assertEquals("trip-v2", state?.tripId)
    } finally {
      database.close()
    }
  }

  private fun insertV1Rows(db: SupportSQLiteDatabase) {
    db.execSQL(
      "INSERT INTO locations (tripId, latitude, longitude, timestamp, accuracy, provider, isFromMockProvider) " +
        "VALUES ('trip-v1', -23.5, -46.6, 1700000000000, 5.0, 'fused', 0)"
    )
    db.execSQL(
      "INSERT INTO tracking_state (id, isActive, tripId, updateInterval, fastestInterval, maxWaitTime, accuracy, " +
        "waitForAccurateLocation, foregroundOnly, notificationOptionsJson) " +
        "VALUES (1, 1, 'trip-v1', 5000, 3000, 10000, 'HIGH_ACCURACY', 0, 0, ?)",
      arrayOf<Any?>(NOTIFICATION_JSON)
    )
    db.execSQL(
      "INSERT INTO geofences (identifier, latitude, longitude, radius, transitionTypes, loiteringDelay, " +
        "expirationDuration, metadata, createdAt, notificationConfig) " +
        "VALUES ('home', -23.5, -46.6, 150.0, 3, 30000, NULL, ?, 1700000000000, NULL)",
      arrayOf<Any?>(GEOFENCE_METADATA)
    )
    db.execSQL(
      "INSERT INTO geofence_transitions (geofenceId, transitionType, latitude, longitude, distanceFromCenter, " +
        "timestamp, metadata) VALUES ('home', 'ENTER', -23.5, -46.6, 12.5, 1700000000500, NULL)"
    )
  }

  private companion object {
    const val TEST_DB = "location-migration-test"
    const val NOTIFICATION_JSON = "{\"title\":\"Tracking\",\"text\":\"On the road\"}"
    const val GEOFENCE_METADATA = "{\"label\":\"Home\"}"
  }
}
