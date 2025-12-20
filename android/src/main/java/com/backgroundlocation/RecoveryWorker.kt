package com.backgroundlocation

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import androidx.work.*
import java.util.concurrent.TimeUnit

/**
 * WorkManager worker for safely recovering tracking sessions
 * Respects Android 12+ background start restrictions
 */
class RecoveryWorker(
  context: Context,
  workerParams: WorkerParameters
) : CoroutineWorker(context, workerParams) {

  override suspend fun doWork(): Result {
    val storage = LocationStorage(applicationContext)

    return try {
      val trackingState = storage.getTrackingStateAsync()

      // Only proceed if tracking is actually active with a valid tripId
      if (!trackingState.isActive || trackingState.tripId == null) {
        android.util.Log.d(TAG, "No active tracking session, skipping recovery")
        return Result.success()
      }

      // Check permissions before attempting restart
      if (!hasRequiredPermissions()) {
        android.util.Log.w(TAG, "Permissions revoked, clearing tracking state")
        // Clear tracking state if permissions revoked
        storage.saveTrackingState(null, false)
        return Result.success()
      }

      // Use setForeground to safely start foreground service from background
      // This creates SystemForegroundService with location type
      val notification = createRecoveryNotification()
      setForeground(ForegroundInfo(
        RECOVERY_NOTIFICATION_ID,
        notification,
        ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
      ))

      // Now safe to start the actual service
      val options = trackingState.options ?: TrackingOptions()
      LocationService.startService(applicationContext, trackingState.tripId, options)

      android.util.Log.d(TAG, "Successfully recovered tracking session: ${trackingState.tripId}")

      Result.success()
    } catch (e: Exception) {
      android.util.Log.e(TAG, "Recovery failed", e)

      // Don't retry indefinitely
      if (runAttemptCount >= MAX_RETRY_ATTEMPTS) {
        android.util.Log.e(TAG, "Max retry attempts reached, clearing tracking state")
        storage.saveTrackingState(null, false)
        return Result.failure()
      }

      Result.retry()
    }
  }

  private fun hasRequiredPermissions(): Boolean {
    val fineLocation = ContextCompat.checkSelfPermission(
      applicationContext,
      Manifest.permission.ACCESS_FINE_LOCATION
    ) == PackageManager.PERMISSION_GRANTED

    val coarseLocation = ContextCompat.checkSelfPermission(
      applicationContext,
      Manifest.permission.ACCESS_COARSE_LOCATION
    ) == PackageManager.PERMISSION_GRANTED

    val backgroundLocation = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      ContextCompat.checkSelfPermission(
        applicationContext,
        Manifest.permission.ACCESS_BACKGROUND_LOCATION
      ) == PackageManager.PERMISSION_GRANTED
    } else {
      true
    }

    return fineLocation && coarseLocation && backgroundLocation
  }

  private fun createRecoveryNotification(): android.app.Notification {
    // Create notification channel for Android 8+
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val notificationManager = applicationContext.getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
      val channel = android.app.NotificationChannel(
        CHANNEL_ID,
        "Background Location",
        android.app.NotificationManager.IMPORTANCE_LOW
      ).apply {
        description = "Background location tracking"
        setShowBadge(false)
      }
      notificationManager.createNotificationChannel(channel)
    }

    // Create minimal notification for setForeground
    return NotificationCompat.Builder(applicationContext, CHANNEL_ID)
      .setContentTitle("Recovering location tracking...")
      .setContentText("Restarting background location service")
      .setSmallIcon(android.R.drawable.ic_menu_mylocation)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .build()
  }

  companion object {
    private const val TAG = "RecoveryWorker"
    private const val RECOVERY_NOTIFICATION_ID = 2
    private const val CHANNEL_ID = "background_location_channel"
    private const val MAX_RETRY_ATTEMPTS = 3

    /**
     * Schedules recovery work with exponential backoff
     */
    fun scheduleRecovery(context: Context) {
      val constraints = Constraints.Builder()
        .setRequiredNetworkType(NetworkType.NOT_REQUIRED)
        .build()

      val recoveryRequest = OneTimeWorkRequestBuilder<RecoveryWorker>()
        .setConstraints(constraints)
        .setBackoffCriteria(
          BackoffPolicy.EXPONENTIAL,
          WorkRequest.MIN_BACKOFF_MILLIS,
          TimeUnit.MILLISECONDS
        )
        .build()

      WorkManager.getInstance(context)
        .enqueueUniqueWork(
          "location_recovery",
          ExistingWorkPolicy.KEEP, // Don't duplicate if already scheduled
          recoveryRequest
        )
    }

    /**
     * Cancels any pending recovery work
     */
    fun cancelRecovery(context: Context) {
      WorkManager.getInstance(context).cancelUniqueWork("location_recovery")
    }
  }
}
