package com.backgroundlocation

import android.annotation.SuppressLint
import android.app.*
import android.content.Context
import android.content.Intent
import android.location.Location
import android.os.Build
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.google.android.gms.location.*

/**
 * Foreground service that handles background location tracking
 * Continues to collect location updates even when app is in background
 */
class LocationService : Service() {

  private lateinit var fusedLocationClient: FusedLocationProviderClient
  private lateinit var locationCallback: LocationCallback
  private lateinit var storage: LocationStorage
  private var currentTripId: String? = null
  private var reactContext: ReactContext? = null
  private var trackingOptions: TrackingOptions = TrackingOptions()

  override fun onCreate() {
    super.onCreate()
    serviceInstance = this
    fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
    storage = LocationStorage(this)
    
    setupLocationCallback()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    currentTripId = intent?.getStringExtra(EXTRA_TRIP_ID)
    
    // Parse tracking options from Bundle
    val optionsBundle = intent?.getBundleExtra(EXTRA_TRACKING_OPTIONS)
    trackingOptions = if (optionsBundle != null) {
      parseTrackingOptionsFromBundle(optionsBundle)
    } else {
      TrackingOptions()
    }
    
    if (currentTripId == null) {
      stopSelf()
      return START_NOT_STICKY
    }

    // Create notification channel with options
    createNotificationChannel()

    // Start as foreground service with notification
    val notification = createNotification()
    startForeground(NOTIFICATION_ID, notification)

    // Start location updates
    startLocationUpdates()

    return START_STICKY
  }

  /**
   * Parses TrackingOptions from Bundle
   */
  private fun parseTrackingOptionsFromBundle(bundle: android.os.Bundle): TrackingOptions {
    val accuracyString = bundle.getString("accuracy")
    return TrackingOptions(
      updateInterval = if (bundle.containsKey("updateInterval")) bundle.getLong("updateInterval") else null,
      fastestInterval = if (bundle.containsKey("fastestInterval")) bundle.getLong("fastestInterval") else null,
      maxWaitTime = if (bundle.containsKey("maxWaitTime")) bundle.getLong("maxWaitTime") else null,
      accuracy = LocationAccuracy.fromString(accuracyString),
      waitForAccurateLocation = if (bundle.containsKey("waitForAccurateLocation")) bundle.getBoolean("waitForAccurateLocation") else null,
      notificationTitle = bundle.getString("notificationTitle"),
      notificationText = bundle.getString("notificationText"),
      notificationChannelName = bundle.getString("notificationChannelName"),
      notificationPriority = bundle.getString("notificationPriority")
    )
  }

  @SuppressLint("MissingPermission")
  private fun startLocationUpdates() {
    val priority = when (trackingOptions.getAccuracyOrDefault()) {
      LocationAccuracy.HIGH_ACCURACY -> Priority.PRIORITY_HIGH_ACCURACY
      LocationAccuracy.BALANCED_POWER_ACCURACY -> Priority.PRIORITY_BALANCED_POWER_ACCURACY
      LocationAccuracy.LOW_POWER -> Priority.PRIORITY_LOW_POWER
      LocationAccuracy.NO_POWER -> Priority.PRIORITY_LOW_POWER // NO_POWER is deprecated, use LOW_POWER instead
      LocationAccuracy.PASSIVE -> Priority.PRIORITY_PASSIVE
    }

    val locationRequest = LocationRequest.Builder(
      priority,
      trackingOptions.getUpdateIntervalOrDefault()
    ).apply {
      setMinUpdateIntervalMillis(trackingOptions.getFastestIntervalOrDefault())
      setMaxUpdateDelayMillis(trackingOptions.getMaxWaitTimeOrDefault())
      setWaitForAccurateLocation(trackingOptions.getWaitForAccurateLocationOrDefault())
    }.build()

    try {
      fusedLocationClient.requestLocationUpdates(
        locationRequest,
        locationCallback,
        Looper.getMainLooper()
      )
    } catch (e: SecurityException) {
      e.printStackTrace()
      stopSelf()
    }
  }

  private fun setupLocationCallback() {
    locationCallback = object : LocationCallback() {
      override fun onLocationResult(locationResult: LocationResult) {
        locationResult.locations.forEach { location ->
          handleLocation(location)
        }
      }
    }
  }

  private fun handleLocation(location: Location) {
    currentTripId?.let { tripId ->
      storage.saveLocation(
        tripId = tripId,
        latitude = location.latitude,
        longitude = location.longitude,
        timestamp = location.time
      )
      
      // Emit location update event to React Native
      sendLocationUpdateEvent(tripId, location)
    }
  }
  
  /**
   * Sends a location update event to React Native
   */
  private fun sendLocationUpdateEvent(tripId: String, location: Location) {
    reactContext?.let { context ->
      try {
        val eventData = Arguments.createMap().apply {
          putString("tripId", tripId)
          putString("latitude", location.latitude.toString())
          putString("longitude", location.longitude.toString())
          putDouble("timestamp", location.time.toDouble())
        }
        
        context
          .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
          .emit("onLocationUpdate", eventData)
      } catch (e: Exception) {
        // React Native context may not be available yet
        e.printStackTrace()
      }
    }
  }

  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val importance = when (trackingOptions.getNotificationPriorityOrDefault()) {
        "LOW" -> NotificationManager.IMPORTANCE_LOW
        "DEFAULT" -> NotificationManager.IMPORTANCE_DEFAULT
        "HIGH" -> NotificationManager.IMPORTANCE_HIGH
        "MAX" -> NotificationManager.IMPORTANCE_HIGH
        else -> NotificationManager.IMPORTANCE_LOW
      }

      val channel = NotificationChannel(
        CHANNEL_ID,
        trackingOptions.getNotificationChannelNameOrDefault(),
        importance
      ).apply {
        description = "Background location tracking"
        setShowBadge(false)
      }

      val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      notificationManager.createNotificationChannel(channel)
    }
  }

  private fun createNotification(): Notification {
    val notificationIntent = packageManager.getLaunchIntentForPackage(packageName)
    val pendingIntent = PendingIntent.getActivity(
      this,
      0,
      notificationIntent,
      PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
    )

    val priority = when (trackingOptions.getNotificationPriorityOrDefault()) {
      "LOW" -> NotificationCompat.PRIORITY_LOW
      "DEFAULT" -> NotificationCompat.PRIORITY_DEFAULT
      "HIGH" -> NotificationCompat.PRIORITY_HIGH
      "MAX" -> NotificationCompat.PRIORITY_MAX
      else -> NotificationCompat.PRIORITY_LOW
    }

    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle(trackingOptions.getNotificationTitleOrDefault())
      .setContentText(trackingOptions.getNotificationTextOrDefault())
      .setSmallIcon(android.R.drawable.ic_menu_mylocation)
      .setContentIntent(pendingIntent)
      .setOngoing(true)
      .setPriority(priority)
      .build()
  }

  override fun onDestroy() {
    super.onDestroy()
    fusedLocationClient.removeLocationUpdates(locationCallback)
    if (serviceInstance == this) {
      serviceInstance = null
    }
  }

  override fun onBind(intent: Intent?): IBinder? = null

  companion object {
    const val EXTRA_TRIP_ID = "trip_id"
    const val EXTRA_TRACKING_OPTIONS = "tracking_options"
    private const val NOTIFICATION_ID = 1
    private const val CHANNEL_ID = "background_location_channel"

    // Store the service instance to allow setting ReactContext
    private var serviceInstance: LocationService? = null

    /**
     * Sets the React Context for event emission
     */
    fun setReactContext(context: ReactContext?) {
      serviceInstance?.reactContext = context
    }

    /**
     * Starts the location service for a specific trip with options
     */
    fun startService(context: Context, tripId: String, options: TrackingOptions = TrackingOptions()) {
      val optionsBundle = android.os.Bundle().apply {
        if (options.updateInterval != null) putLong("updateInterval", options.updateInterval)
        if (options.fastestInterval != null) putLong("fastestInterval", options.fastestInterval)
        if (options.maxWaitTime != null) putLong("maxWaitTime", options.maxWaitTime)
        if (options.accuracy != null) putString("accuracy", options.accuracy.value)
        if (options.waitForAccurateLocation != null) putBoolean("waitForAccurateLocation", options.waitForAccurateLocation)
        if (options.notificationTitle != null) putString("notificationTitle", options.notificationTitle)
        if (options.notificationText != null) putString("notificationText", options.notificationText)
        if (options.notificationChannelName != null) putString("notificationChannelName", options.notificationChannelName)
        if (options.notificationPriority != null) putString("notificationPriority", options.notificationPriority)
      }

      val intent = Intent(context, LocationService::class.java).apply {
        putExtra(EXTRA_TRIP_ID, tripId)
        putExtra(EXTRA_TRACKING_OPTIONS, optionsBundle)
      }
      
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
    }

    /**
     * Stops the location service
     */
    fun stopService(context: Context) {
      val intent = Intent(context, LocationService::class.java)
      context.stopService(intent)
    }
  }
}

