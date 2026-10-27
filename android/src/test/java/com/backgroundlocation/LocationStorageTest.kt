package com.backgroundlocation

import android.content.Context
import com.backgroundlocation.database.LocationDao
import com.backgroundlocation.database.LocationDatabase
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import io.mockk.mockkObject
import io.mockk.unmockkAll
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Before
import org.junit.Test

/**
 * The fire-and-forget flush started when location updates are reduced, against a mocked DAO.
 */
class LocationStorageTest {

  private val locationDao = mockk<LocationDao>()
  private lateinit var storage: LocationStorage

  @Before
  fun setUp() {
    val database = mockk<LocationDatabase>()
    every { database.locationDao() } returns locationDao
    every { database.trackingStateDao() } returns mockk(relaxed = true)
    mockkObject(LocationDatabase.Companion)
    every { LocationDatabase.getInstance(any()) } returns database
    storage = LocationStorage(mockk<Context>(relaxed = true))
  }

  @After
  fun tearDown() {
    // With a working DAO, cleanup() writes what is left and stops the periodic flush
    coEvery { locationDao.insertAll(any()) } returns emptyList()
    storage.cleanup()
    unmockkAll()
  }

  @Test
  fun `an async flush writes every buffered location in one batch`() {
    coEvery { locationDao.insertAll(any()) } returns listOf(1L, 2L, 3L)
    repeat(3) { index -> storage.saveLocation(TRIP, index.toDouble(), 0.0, index.toLong()) }

    storage.flushAsync()

    coVerify(timeout = 5_000, exactly = 1) { locationDao.insertAll(match { it.size == 3 }) }
  }

  @Test
  fun `an async flush stops at the first failed batch and keeps that batch buffered`() {
    coEvery { locationDao.insertAll(any()) } throws IllegalStateException("database or disk is full")
    storage.saveLocation(TRIP, 1.0, 2.0, 3L)

    storage.flushAsync()

    coVerify(timeout = 5_000, exactly = 1) { locationDao.insertAll(any()) }
    // A retry loop would have called the DAO many more times by now
    Thread.sleep(300)
    coVerify(exactly = 1) { locationDao.insertAll(any()) }

    // The failed batch is still buffered: the next flush writes it
    coEvery { locationDao.insertAll(any()) } returns listOf(1L)
    runBlocking { storage.forceFlush() }
    coVerify(exactly = 2) { locationDao.insertAll(match { batch -> batch.single().tripId == TRIP }) }
  }

  private companion object {
    const val TRIP = "trip-storage"
  }
}
