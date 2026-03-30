package com.backgroundlocation

import android.Manifest
import android.annotation.SuppressLint
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationManager
import android.os.Build
import android.util.Log
import androidx.core.content.ContextCompat
import com.backgroundlocation.database.GeofenceEntity
import com.backgroundlocation.database.GeofenceTransitionEntity
import android.os.Looper
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.Geofence
import com.google.android.gms.location.GeofencingClient
import com.google.android.gms.location.GeofencingRequest
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlin.coroutines.suspendCoroutine

/**
 * Orchestrates geofence registration, removal, and monitoring
 * Uses GeofencingClient (primary) with proximity alerts fallback
 * Coroutine pattern: SupervisorJob() + Dispatchers.Main (consistent with BackgroundLocationModule)
 */
class GeofenceManager(private val context: Context) {

    private val storage = GeofenceStorage(context)

    private val geofencingClient: GeofencingClient? = if (isPlayServicesAvailable()) {
        LocationServices.getGeofencingClient(context)
    } else null

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    // Heartbeat: lightweight location requests to keep the GPS pipeline warm for geofence detection
    private var heartbeatClient: FusedLocationProviderClient? = null
    private var heartbeatCallback: LocationCallback? = null
    private var isHeartbeatActive: Boolean = false

    private val isoFormatter: SimpleDateFormat
        get() = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }

    companion object {
        private const val TAG = "GeofenceManager"
        const val MAX_GEOFENCES = 100
        private const val GEOFENCE_PENDING_INTENT_REQUEST_CODE = 9001

        // Transition type bitmask constants (matching TypeScript GeofenceTransitionType)
        const val TRANSITION_ENTER = 1
        const val TRANSITION_EXIT = 2
        const val TRANSITION_DWELL = 4

        // Heartbeat interval constants — keep GPS pipeline warm for passive geofence detection
        private const val HEARTBEAT_INTERVAL_MS = 15 * 60 * 1000L   // 15 minutes
        private const val HEARTBEAT_FASTEST_MS = 5 * 60 * 1000L     // 5 minutes
    }

    private fun isPlayServicesAvailable(): Boolean {
        return GoogleApiAvailability.getInstance()
            .isGooglePlayServicesAvailable(context) == ConnectionResult.SUCCESS
    }

    private fun getGeofencePendingIntent(): PendingIntent {
        val intent = Intent(context, GeofenceBroadcastReceiver::class.java)
        return PendingIntent.getBroadcast(
            context,
            GEOFENCE_PENDING_INTENT_REQUEST_CODE,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
        )
    }

    // --- Region Parsing ---

    private fun parseRegionJson(regionJson: String): GeofenceRegionData {
        val json = JSONObject(regionJson)
        return parseRegionObject(json)
    }

    private fun parseRegionsJson(regionsJson: String): List<GeofenceRegionData> {
        val jsonArray = JSONArray(regionsJson)
        val regions = mutableListOf<GeofenceRegionData>()
        for (i in 0 until jsonArray.length()) {
            regions.add(parseRegionObject(jsonArray.getJSONObject(i)))
        }
        return regions
    }

    private fun parseRegionObject(json: JSONObject): GeofenceRegionData {
        val identifier = json.getString("identifier")
        val latitude = json.getDouble("latitude")
        val longitude = json.getDouble("longitude")
        val radius = json.getDouble("radius").toFloat()

        // Parse transition types (default: ENTER | EXIT)
        val transitionTypes = if (json.has("transitionTypes")) {
            val typesArray = json.getJSONArray("transitionTypes")
            var bitmask = 0
            for (i in 0 until typesArray.length()) {
                when (typesArray.getString(i)) {
                    "ENTER" -> bitmask = bitmask or TRANSITION_ENTER
                    "EXIT" -> bitmask = bitmask or TRANSITION_EXIT
                    "DWELL" -> bitmask = bitmask or TRANSITION_DWELL
                }
            }
            bitmask
        } else {
            TRANSITION_ENTER or TRANSITION_EXIT
        }

        val loiteringDelay = if (json.has("loiteringDelay")) json.getInt("loiteringDelay") else 30000
        val expirationDuration = if (json.has("expirationDuration")) json.getLong("expirationDuration") else null
        val metadata = if (json.has("metadata")) json.getJSONObject("metadata").toString() else null
        val notificationConfig = json.optJSONObject("notificationOptions")?.toString()

        return GeofenceRegionData(
            identifier = identifier,
            latitude = latitude,
            longitude = longitude,
            radius = radius,
            transitionTypes = transitionTypes,
            loiteringDelay = loiteringDelay,
            expirationDuration = expirationDuration,
            metadata = metadata,
            notificationConfig = notificationConfig
        )
    }

    // --- Validation ---

    private fun validateRegion(region: GeofenceRegionData) {
        if (region.identifier.isBlank()) {
            throw GeofenceException("INVALID_REGION", "Geofence identifier cannot be empty")
        }
        if (region.latitude < -90 || region.latitude > 90) {
            throw GeofenceException("INVALID_REGION", "Latitude must be between -90 and 90")
        }
        if (region.longitude < -180 || region.longitude > 180) {
            throw GeofenceException("INVALID_REGION", "Longitude must be between -180 and 180")
        }
        if (region.radius < 100) {
            throw GeofenceException("INVALID_REGION", "Radius must be at least 100 meters")
        }
    }

    private fun checkPermissions() {
        val fineLocation = ContextCompat.checkSelfPermission(
            context, Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED

        if (!fineLocation) {
            throw GeofenceException("PERMISSION_DENIED", "ACCESS_FINE_LOCATION permission is required")
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val backgroundLocation = ContextCompat.checkSelfPermission(
                context, Manifest.permission.ACCESS_BACKGROUND_LOCATION
            ) == PackageManager.PERMISSION_GRANTED

            if (!backgroundLocation) {
                throw GeofenceException(
                    "PERMISSION_DENIED",
                    "ACCESS_BACKGROUND_LOCATION permission is required for geofencing"
                )
            }
        }
    }

    // --- Public API ---

    @SuppressLint("MissingPermission")
    suspend fun addGeofence(regionJson: String) {
        checkPermissions()

        if (geofencingClient == null) {
            throw GeofenceException(
                "PLAY_SERVICES_UNAVAILABLE",
                "Google Play Services is not available. Geofencing requires Play Services or will use proximity alerts fallback."
            ).also {
                // Try fallback
                val region = parseRegionJson(regionJson)
                validateRegion(region)
                addGeofenceWithFallback(region)
                return
            }
        }

        val region = parseRegionJson(regionJson)
        validateRegion(region)

        // Check for duplicate
        val existing = storage.getGeofenceByIdentifier(region.identifier)
        if (existing != null) {
            throw GeofenceException(
                "DUPLICATE_IDENTIFIER",
                "Geofence with identifier '${region.identifier}' already exists"
            )
        }

        // Check limit
        val currentCount = storage.getGeofenceCount()
        if (currentCount >= MAX_GEOFENCES) {
            throw GeofenceException(
                "LIMIT_EXCEEDED",
                "Maximum of $MAX_GEOFENCES geofences reached"
            )
        }

        // Register with GeofencingClient
        registerWithGeofencingClient(listOf(region))

        // Persist to Room
        storage.saveGeofence(region.toEntity())
        Log.d(TAG, "Geofence added: ${region.identifier}")

        // Start heartbeat if tracking is not active
        startHeartbeatIfNeeded()
    }

    @SuppressLint("MissingPermission")
    private suspend fun addGeofenceWithFallback(region: GeofenceRegionData) {
        // Check for duplicate
        val existing = storage.getGeofenceByIdentifier(region.identifier)
        if (existing != null) {
            throw GeofenceException(
                "DUPLICATE_IDENTIFIER",
                "Geofence with identifier '${region.identifier}' already exists"
            )
        }

        // Check limit
        val currentCount = storage.getGeofenceCount()
        if (currentCount >= MAX_GEOFENCES) {
            throw GeofenceException(
                "LIMIT_EXCEEDED",
                "Maximum of $MAX_GEOFENCES geofences reached"
            )
        }

        registerWithProximityAlerts(listOf(region))
        storage.saveGeofence(region.toEntity())
        Log.d(TAG, "Geofence added via proximity alert fallback: ${region.identifier}")
    }

    @SuppressLint("MissingPermission")
    suspend fun addGeofences(regionsJson: String) {
        checkPermissions()
        val regions = parseRegionsJson(regionsJson)

        if (regions.isEmpty()) return

        // Validate all regions first (atomic: all-or-nothing)
        regions.forEach { validateRegion(it) }

        // Check for duplicates among batch
        val identifiers = regions.map { it.identifier }
        if (identifiers.size != identifiers.toSet().size) {
            throw GeofenceException("DUPLICATE_IDENTIFIER", "Duplicate identifiers found in batch")
        }

        // Check for duplicates with existing
        for (region in regions) {
            val existing = storage.getGeofenceByIdentifier(region.identifier)
            if (existing != null) {
                throw GeofenceException(
                    "DUPLICATE_IDENTIFIER",
                    "Geofence with identifier '${region.identifier}' already exists"
                )
            }
        }

        // Check limit
        val currentCount = storage.getGeofenceCount()
        if (currentCount + regions.size > MAX_GEOFENCES) {
            throw GeofenceException(
                "LIMIT_EXCEEDED",
                "Adding ${regions.size} geofences would exceed the maximum of $MAX_GEOFENCES (current: $currentCount)"
            )
        }

        // Register with GeofencingClient or fallback
        if (geofencingClient != null) {
            registerWithGeofencingClient(regions)
        } else {
            registerWithProximityAlerts(regions)
        }

        // Persist all to Room
        storage.saveGeofences(regions.map { it.toEntity() })
        Log.d(TAG, "Batch added ${regions.size} geofences")

        // Start heartbeat if tracking is not active
        startHeartbeatIfNeeded()
    }

    @SuppressLint("MissingPermission")
    suspend fun removeGeofence(identifier: String) {
        if (geofencingClient != null) {
            suspendCoroutine { cont ->
                geofencingClient.removeGeofences(listOf(identifier))
                    .addOnSuccessListener { cont.resume(Unit) }
                    .addOnFailureListener { cont.resume(Unit) } // Ignore errors on remove
            }
        }
        storage.removeGeofence(identifier)
        Log.d(TAG, "Geofence removed: $identifier")

        // Stop heartbeat if no geofences remain
        if (storage.getGeofenceCount() == 0) {
            stopHeartbeat()
        }
    }

    @SuppressLint("MissingPermission")
    suspend fun removeGeofences(identifiersJson: String) {
        val jsonArray = JSONArray(identifiersJson)
        val identifiers = mutableListOf<String>()
        for (i in 0 until jsonArray.length()) {
            identifiers.add(jsonArray.getString(i))
        }

        if (identifiers.isEmpty()) return

        if (geofencingClient != null) {
            suspendCoroutine { cont ->
                geofencingClient.removeGeofences(identifiers)
                    .addOnSuccessListener { cont.resume(Unit) }
                    .addOnFailureListener { cont.resume(Unit) }
            }
        }
        storage.removeGeofences(identifiers)
        Log.d(TAG, "Removed ${identifiers.size} geofences")

        // Stop heartbeat if no geofences remain
        if (storage.getGeofenceCount() == 0) {
            stopHeartbeat()
        }
    }

    @SuppressLint("MissingPermission")
    suspend fun removeAllGeofences() {
        if (geofencingClient != null) {
            suspendCoroutine { cont ->
                geofencingClient.removeGeofences(getGeofencePendingIntent())
                    .addOnSuccessListener { cont.resume(Unit) }
                    .addOnFailureListener { cont.resume(Unit) }
            }
        }
        storage.removeAllGeofences()
        stopHeartbeat()
        Log.d(TAG, "All geofences removed")
    }

    suspend fun getActiveGeofences(): String {
        val entities = storage.getActiveGeofences()
        val jsonArray = JSONArray()
        entities.forEach { entity ->
            jsonArray.put(entityToJson(entity))
        }
        return jsonArray.toString()
    }

    fun getMaxGeofences(): Int = MAX_GEOFENCES

    suspend fun getGeofenceTransitions(identifier: String?): String {
        val transitions = storage.getTransitions(identifier)
        val jsonArray = JSONArray()
        transitions.forEach { transition ->
            jsonArray.put(transitionToJson(transition))
        }
        return jsonArray.toString()
    }

    suspend fun clearGeofenceTransitions(identifier: String?) {
        storage.clearTransitions(identifier)
        Log.d(TAG, "Cleared transitions for: ${identifier ?: "all"}")
    }

    // --- Transition Handling (called from GeofenceBroadcastReceiver) ---

    fun handleTransition(
        geofenceId: String,
        transitionType: Int,
        triggeringLocation: Location?
    ) {
        scope.launch {
            try {
                val geofence = storage.getGeofenceByIdentifier(geofenceId) ?: return@launch

                val transitionString = when (transitionType) {
                    Geofence.GEOFENCE_TRANSITION_ENTER -> "ENTER"
                    Geofence.GEOFENCE_TRANSITION_EXIT -> "EXIT"
                    Geofence.GEOFENCE_TRANSITION_DWELL -> "DWELL"
                    else -> return@launch
                }

                // Check if this transition type is being monitored
                val expectedBitmask = when (transitionType) {
                    Geofence.GEOFENCE_TRANSITION_ENTER -> TRANSITION_ENTER
                    Geofence.GEOFENCE_TRANSITION_EXIT -> TRANSITION_EXIT
                    Geofence.GEOFENCE_TRANSITION_DWELL -> TRANSITION_DWELL
                    else -> 0
                }
                if (geofence.transitionTypes and expectedBitmask == 0) return@launch

                val lat = triggeringLocation?.latitude ?: 0.0
                val lng = triggeringLocation?.longitude ?: 0.0
                val timestamp = triggeringLocation?.time ?: System.currentTimeMillis()

                // Calculate distance from center
                val results = FloatArray(1)
                Location.distanceBetween(lat, lng, geofence.latitude, geofence.longitude, results)
                val distanceFromCenter = results[0].toDouble()

                // Persist transition
                val transitionEntity = GeofenceTransitionEntity(
                    geofenceId = geofenceId,
                    transitionType = transitionString,
                    latitude = lat,
                    longitude = lng,
                    distanceFromCenter = distanceFromCenter,
                    timestamp = timestamp,
                    metadata = geofence.metadata
                )
                storage.saveTransition(transitionEntity)

                // Emit to JS via GeofenceEventFlow (SharedFlow)
                GeofenceEventBroadcaster.broadcastTransition(
                    geofenceId = geofenceId,
                    transitionType = transitionString,
                    latitude = lat,
                    longitude = lng,
                    timestamp = timestamp,
                    distanceFromCenter = distanceFromCenter,
                    metadata = geofence.metadata
                )

                // Show notification
                GeofenceNotificationHelper.showTransitionNotification(
                    context = context,
                    geofenceId = geofenceId,
                    transitionType = transitionString,
                    latitude = lat,
                    longitude = lng,
                    radius = geofence.radius.toDouble(),
                    timestamp = isoFormatter.format(java.util.Date(timestamp)),
                    metadata = geofence.metadata,
                    perGeofenceConfigJson = geofence.notificationConfig
                )

                Log.d(TAG, "Transition handled: $transitionString for $geofenceId")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to handle transition for $geofenceId", e)
            }
        }
    }

    // --- Recovery (called from BootCompletedReceiver) ---

    @SuppressLint("MissingPermission")
    suspend fun restoreGeofences() {
        try {
            checkPermissions()
            val geofences = storage.getActiveGeofences()
            if (geofences.isEmpty()) {
                Log.d(TAG, "No geofences to restore")
                return
            }

            val regions = geofences.map { entity ->
                GeofenceRegionData(
                    identifier = entity.identifier,
                    latitude = entity.latitude,
                    longitude = entity.longitude,
                    radius = entity.radius,
                    transitionTypes = entity.transitionTypes,
                    loiteringDelay = entity.loiteringDelay,
                    expirationDuration = entity.expirationDuration,
                    metadata = entity.metadata,
                    notificationConfig = entity.notificationConfig
                )
            }

            if (geofencingClient != null) {
                registerWithGeofencingClient(regions)
            } else {
                registerWithProximityAlerts(regions)
            }
            Log.d(TAG, "Restored ${geofences.size} geofences")

            // Start heartbeat if tracking is not active
            startHeartbeatIfNeeded()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to restore geofences", e)
        }
    }

    // --- Native Registration ---

    @SuppressLint("MissingPermission")
    private suspend fun registerWithGeofencingClient(regions: List<GeofenceRegionData>) {
        val geofences = regions.map { region ->
            val builder = Geofence.Builder()
                .setRequestId(region.identifier)
                .setCircularRegion(region.latitude, region.longitude, region.radius)
                .setLoiteringDelay(region.loiteringDelay)
                .setNotificationResponsiveness(5000)

            // Set transition types
            var transitions = 0
            if (region.transitionTypes and TRANSITION_ENTER != 0) {
                transitions = transitions or Geofence.GEOFENCE_TRANSITION_ENTER
            }
            if (region.transitionTypes and TRANSITION_EXIT != 0) {
                transitions = transitions or Geofence.GEOFENCE_TRANSITION_EXIT
            }
            if (region.transitionTypes and TRANSITION_DWELL != 0) {
                transitions = transitions or Geofence.GEOFENCE_TRANSITION_DWELL
            }
            builder.setTransitionTypes(transitions)

            // Set expiration
            if (region.expirationDuration != null) {
                builder.setExpirationDuration(region.expirationDuration)
            } else {
                builder.setExpirationDuration(Geofence.NEVER_EXPIRE)
            }

            builder.build()
        }

        val request = GeofencingRequest.Builder()
            .setInitialTrigger(
                GeofencingRequest.INITIAL_TRIGGER_ENTER or GeofencingRequest.INITIAL_TRIGGER_DWELL
            )
            .addGeofences(geofences)
            .build()

        suspendCoroutine { cont ->
            geofencingClient!!.addGeofences(request, getGeofencePendingIntent())
                .addOnSuccessListener { cont.resume(Unit) }
                .addOnFailureListener { e ->
                    cont.resumeWithException(
                        GeofenceException(
                            "MONITORING_FAILED",
                            "Failed to register geofences: ${e.message}"
                        )
                    )
                }
        }
    }

    @SuppressLint("MissingPermission")
    private fun registerWithProximityAlerts(regions: List<GeofenceRegionData>) {
        val locationManager = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager

        regions.forEach { region ->
            val intent = Intent(context, GeofenceBroadcastReceiver::class.java).apply {
                putExtra("geofenceId", region.identifier)
            }
            val pendingIntent = PendingIntent.getBroadcast(
                context,
                region.identifier.hashCode(),
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
            )

            val expiration = region.expirationDuration ?: -1L
            locationManager.addProximityAlert(
                region.latitude,
                region.longitude,
                region.radius,
                expiration,
                pendingIntent
            )
        }
        Log.d(TAG, "Registered ${regions.size} geofences via proximity alerts (fallback)")
    }

    // --- JSON Serialization ---

    private fun entityToJson(entity: GeofenceEntity): JSONObject {
        return JSONObject().apply {
            put("identifier", entity.identifier)
            put("latitude", entity.latitude)
            put("longitude", entity.longitude)
            put("radius", entity.radius.toDouble())
            // Convert bitmask back to array
            val types = JSONArray()
            if (entity.transitionTypes and TRANSITION_ENTER != 0) types.put("ENTER")
            if (entity.transitionTypes and TRANSITION_EXIT != 0) types.put("EXIT")
            if (entity.transitionTypes and TRANSITION_DWELL != 0) types.put("DWELL")
            put("transitionTypes", types)
            put("loiteringDelay", entity.loiteringDelay)
            entity.expirationDuration?.let { put("expirationDuration", it) }
            entity.metadata?.let {
                try {
                    put("metadata", JSONObject(it))
                } catch (_: Exception) { }
            }
            entity.notificationConfig?.let {
                try {
                    put("notificationOptions", JSONObject(it))
                } catch (_: Exception) { }
            }
        }
    }

    private fun transitionToJson(transition: GeofenceTransitionEntity): JSONObject {
        return JSONObject().apply {
            put("geofenceId", transition.geofenceId)
            put("transitionType", transition.transitionType)
            put("latitude", transition.latitude)
            put("longitude", transition.longitude)
            put("timestamp", isoFormatter.format(Date(transition.timestamp)))
            put("distanceFromCenter", transition.distanceFromCenter)
            transition.metadata?.let {
                try {
                    put("metadata", JSONObject(it))
                } catch (_: Exception) { }
            }
        }
    }

    // --- Heartbeat: Keep GPS Pipeline Warm for Geofence Detection ---

    /**
     * Starts a low-frequency heartbeat location request to keep the GPS pipeline active.
     * Required when geofences are registered but LocationService (foreground tracking) is not running.
     * On devices with few installed apps, the GPS subsystem can go fully dormant, causing
     * GeofencingClient (which is passive) to miss transitions indefinitely.
     *
     * The heartbeat callback is a no-op — it discards received locations. Its sole purpose
     * is to stimulate the location subsystem so GeofencingClient can detect transitions.
     */
    @SuppressLint("MissingPermission")
    private fun startHeartbeatIfNeeded() {
        if (isHeartbeatActive) {
            Log.d(TAG, "Heartbeat already active, skipping start")
            return
        }

        if (isTrackingActive()) {
            Log.d(TAG, "LocationService is running, heartbeat not needed")
            return
        }

        if (!isPlayServicesAvailable()) {
            Log.d(TAG, "Play Services not available, cannot start heartbeat")
            return
        }

        val client = heartbeatClient ?: LocationServices.getFusedLocationProviderClient(context).also {
            heartbeatClient = it
        }

        val request = LocationRequest.Builder(Priority.PRIORITY_BALANCED_POWER_ACCURACY, HEARTBEAT_INTERVAL_MS)
            .setMinUpdateIntervalMillis(HEARTBEAT_FASTEST_MS)
            .build()

        val callback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                // No-op: discard location data. This callback exists solely to keep the
                // location pipeline warm so GeofencingClient can detect transitions.
                Log.d(TAG, "Heartbeat location received (discarded): lat=${result.lastLocation?.latitude}, lng=${result.lastLocation?.longitude}")
            }
        }
        heartbeatCallback = callback

        client.requestLocationUpdates(request, callback, Looper.getMainLooper())
        isHeartbeatActive = true
        Log.d(TAG, "Heartbeat started (interval=${HEARTBEAT_INTERVAL_MS}ms, fastest=${HEARTBEAT_FASTEST_MS}ms)")
    }

    /**
     * Stops the heartbeat location requests.
     * Called when LocationService starts (tracking provides its own location updates)
     * or when all geofences are removed.
     */
    private fun stopHeartbeat() {
        if (!isHeartbeatActive || heartbeatCallback == null) return

        heartbeatClient?.removeLocationUpdates(heartbeatCallback!!)
        heartbeatCallback = null
        isHeartbeatActive = false
        Log.d(TAG, "Heartbeat stopped")
    }

    /**
     * Checks whether the foreground LocationService is currently running.
     */
    private fun isTrackingActive(): Boolean {
        return LocationService.isRunning
    }

    /**
     * Called when LocationService starts tracking.
     * Stops the heartbeat since tracking already provides continuous location updates,
     * making the heartbeat redundant.
     */
    fun onTrackingStarted() {
        stopHeartbeat()
    }

    /**
     * Called when LocationService stops tracking.
     * Restarts the heartbeat if geofences are still registered, to keep the GPS pipeline
     * active for passive geofence detection.
     */
    fun onTrackingStopped() {
        scope.launch {
            try {
                val count = storage.getGeofenceCount()
                if (count > 0) {
                    startHeartbeatIfNeeded()
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to check geofence count for heartbeat restart", e)
            }
        }
    }

    fun cleanup() {
        stopHeartbeat()
        scope.cancel()
        storage.cleanup()
    }

    // --- Data Classes ---

    data class GeofenceRegionData(
        val identifier: String,
        val latitude: Double,
        val longitude: Double,
        val radius: Float,
        val transitionTypes: Int,
        val loiteringDelay: Int,
        val expirationDuration: Long?,
        val metadata: String?,
        val notificationConfig: String? = null
    ) {
        fun toEntity(): GeofenceEntity {
            return GeofenceEntity(
                identifier = identifier,
                latitude = latitude,
                longitude = longitude,
                radius = radius,
                transitionTypes = transitionTypes,
                loiteringDelay = loiteringDelay,
                expirationDuration = expirationDuration,
                metadata = metadata,
                createdAt = System.currentTimeMillis(),
                notificationConfig = notificationConfig
            )
        }
    }

    class GeofenceException(val code: String, message: String) : Exception(message)
}
