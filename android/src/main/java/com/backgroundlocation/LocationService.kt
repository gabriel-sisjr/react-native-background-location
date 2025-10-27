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

  override fun onCreate() {
    super.onCreate()
    serviceInstance = this
    fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
    storage = LocationStorage(this)
    
    createNotificationChannel()
    setupLocationCallback()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    currentTripId = intent?.getStringExtra(EXTRA_TRIP_ID)
    
    if (currentTripId == null) {
      stopSelf()
      return START_NOT_STICKY
    }

    // Start as foreground service with notification
    val notification = createNotification()
    startForeground(NOTIFICATION_ID, notification)

    // Start location updates
    startLocationUpdates()

    return START_STICKY
  }

  @SuppressLint("MissingPermission")
  private fun startLocationUpdates() {
    val locationRequest = LocationRequest.Builder(
      Priority.PRIORITY_HIGH_ACCURACY,
      LOCATION_UPDATE_INTERVAL
    ).apply {
      setMinUpdateIntervalMillis(FASTEST_LOCATION_INTERVAL)
      setMaxUpdateDelayMillis(MAX_WAIT_TIME)
      setWaitForAccurateLocation(false)
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
      val channel = NotificationChannel(
        CHANNEL_ID,
        CHANNEL_NAME,
        NotificationManager.IMPORTANCE_LOW
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

    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle("Location Tracking")
      .setContentText("Tracking your location in background")
      .setSmallIcon(android.R.drawable.ic_menu_mylocation)
      .setContentIntent(pendingIntent)
      .setOngoing(true)
      .setPriority(NotificationCompat.PRIORITY_LOW)
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
    private const val NOTIFICATION_ID = 1
    private const val CHANNEL_ID = "background_location_channel"
    private const val CHANNEL_NAME = "Background Location"
    
    // Location update intervals in milliseconds
    private const val LOCATION_UPDATE_INTERVAL = 5000L // 5 seconds
    private const val FASTEST_LOCATION_INTERVAL = 3000L // 3 seconds
    private const val MAX_WAIT_TIME = 10000L // 10 seconds

    // Store the service instance to allow setting ReactContext
    private var serviceInstance: LocationService? = null

    /**
     * Sets the React Context for event emission
     */
    fun setReactContext(context: ReactContext?) {
      serviceInstance?.reactContext = context
    }

    /**
     * Starts the location service for a specific trip
     */
    fun startService(context: Context, tripId: String) {
      val intent = Intent(context, LocationService::class.java).apply {
        putExtra(EXTRA_TRIP_ID, tripId)
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

