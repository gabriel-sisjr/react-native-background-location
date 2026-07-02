package com.backgroundlocation.provider

import android.app.PendingIntent
import android.content.Context
import com.google.android.gms.location.ActivityRecognition
import com.google.android.gms.location.ActivityRecognitionClient
import com.google.android.gms.tasks.Task
import io.mockk.every
import io.mockk.mockk
import io.mockk.mockkStatic
import io.mockk.unmockkAll
import io.mockk.verify
import org.junit.After
import org.junit.Before
import org.junit.Test

class ActivityRecognitionProviderTest {

    private lateinit var provider: ActivityRecognitionProvider
    private lateinit var activityClient: ActivityRecognitionClient
    private lateinit var context: Context
    private lateinit var pendingIntent: PendingIntent

    @Before
    fun setUp() {
        context = mockk(relaxed = true)
        activityClient = mockk(relaxed = true)
        pendingIntent = mockk(relaxed = true)

        mockkStatic(ActivityRecognition::class)
        every { ActivityRecognition.getClient(any<Context>()) } returns activityClient

        // Mock Task return types for the Play Services methods
        every { activityClient.requestActivityUpdates(any<Long>(), any<PendingIntent>()) } returns mockk<Task<Void>>(relaxed = true)
        every { activityClient.removeActivityUpdates(any<PendingIntent>()) } returns mockk<Task<Void>>(relaxed = true)
        provider = ActivityRecognitionProvider()
        provider.initialize(context)
    }

    @After
    fun tearDown() {
        unmockkAll()
    }

    @Test
    fun `requestActivityUpdates passes interval and pending intent to client`() {
        val intervalMs = 60000L

        provider.requestActivityUpdates(intervalMs, pendingIntent)

        verify(exactly = 1) {
            activityClient.requestActivityUpdates(intervalMs, pendingIntent)
        }
    }

    @Test
    fun `removeActivityUpdates passes pending intent to client`() {
        provider.removeActivityUpdates(pendingIntent)

        verify(exactly = 1) {
            activityClient.removeActivityUpdates(pendingIntent)
        }
    }

    @Test
    fun `cleanup clears client reference safely`() {
        provider.cleanup()
        
        // Ensure no exception is thrown and subsequent calls are null-safe
        provider.requestActivityUpdates(1000L, pendingIntent)
        
        // Verification is that it didn't crash.
        // It should NOT call the mock client because cleanup() cleared the reference
        verify(exactly = 0) {
            activityClient.requestActivityUpdates(any<Long>(), any<PendingIntent>())
        }
    }
}
