# Implementation Summary

Cross-platform React Native TurboModule library for background location tracking on Android and iOS. Published as `@gabriel-sisjr/react-native-background-location`. On Android, provides a foreground service backed by Room DB persistence, dual location providers with automatic fallback, configurable notification appearance, real-time event streaming to JavaScript, and WorkManager-based crash recovery. On iOS, provides CLLocationManager-based tracking with Core Data persistence, significant location monitoring for crash recovery, and the same event streaming interface.

## Architecture Overview

### TurboModule Bridge Pattern

The library follows the React Native New Architecture (TurboModules) communication model. TypeScript enums are converted to plain strings before crossing the bridge because Codegen does not support TS enums. Complex objects (e.g., notification actions) are JSON-serialized for the same reason.

```
JS Hook
  |
  v
src/index.tsx                   -- Public API, enum-to-string conversion
  |
  v
NativeBackgroundLocation.ts    -- TurboModule Spec (Codegen contract)
  |
  +-----------+-----------+
  |                       |
  v                       v
[Android]               [iOS]
BackgroundLocationModule.kt    BackgroundLocation.mm (ObjC++ bridge)
  |                               |
  v                               v
LocationService.kt             LocationManagerWrapper.swift
  |              |                 |              |
  v              v                 v              v
LocationProvider  LocationStorage  CLLocationMgr  LocationStorage.swift
(Fused/Android)  (Room DB)        Delegate        (Core Data)
  |              |                 |              |
  v              v                 v              v
LocationEventBroadcaster        RCTEventEmitter (direct)
  |                               |
  v                               v
LocalBroadcastManager           RCTDeviceEventEmitter
  |                               |
  v                               v
BackgroundLocationModule.kt     NativeEventEmitter -- JS subscription
  |
  v
DeviceEventManagerModule
  |
  v
NativeEventEmitter             -- JS subscription (useLocationUpdates)
```

### Native Event Names

| Event                  | Direction     | Description                                                             |
| ---------------------- | ------------- | ----------------------------------------------------------------------- |
| `onLocationUpdate`     | Native --> JS | New location coordinate received                                        |
| `onLocationError`      | Native --> JS | Fatal error (PERMISSION_REVOKED, PROVIDER_ERROR)                        |
| `onLocationWarning`    | Native --> JS | Non-fatal warning (SERVICE_TIMEOUT, TASK_REMOVED, LOCATION_UNAVAILABLE) |
| `onNotificationAction` | Native --> JS | Notification action button pressed                                      |

---

## TypeScript Layer

### Public API (`src/index.tsx`)

Wraps the TurboModule spec with:

- Native module availability check (graceful fallback for simulators)
- Overloaded `startTracking(tripIdOrOptions?, options?)` signature
- Enum-to-string conversion for `LocationAccuracy` and `NotificationPriority`
- JSON serialization of `notificationActions` array (capped at 3 items)
- `updateNotification(title, text)` for dynamic notification content

Exported methods: `startTracking`, `stopTracking`, `isTracking`, `getLocations`, `clearTrip`, `updateNotification`.

### TurboModule Spec (`src/NativeBackgroundLocation.ts`)

Defines the `Spec extends TurboModule` interface consumed by Codegen. Uses a separate `TrackingOptionsSpec` interface with string-typed enum fields and a JSON-serialized `notificationActions` string to satisfy Codegen constraints.

### Types

| File                   | Contents                                                                                                                                                                                     |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `types/enums.ts`       | `LocationPermissionStatus`, `LocationAccuracy` (5 levels), `NotificationPriority` (4 levels)                                                                                                 |
| `types/tracking.ts`    | `Coords` (14 fields), `TrackingStatus`, `LocationUpdateEvent`, `TrackingOptions` (22 fields), `LocationWarningEvent`, `LocationWarningType`, `NotificationAction`, `NotificationActionEvent` |
| `types/permissions.ts` | `PermissionState`, `UseLocationPermissionsResult`                                                                                                                                            |
| `types/hooks.ts`       | `UseBackgroundLocationResult`, `UseLocationTrackingOptions`, `UseLocationUpdatesOptions`, `UseLocationUpdatesResult`                                                                         |
| `types/index.ts`       | Barrel re-exports for all of the above                                                                                                                                                       |

### Hooks

| Hook                     | Purpose                                                                                                                                                                                                                                                                                   |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useLocationPermissions` | Two-step Android permission flow (foreground, then background on API 29+, then notification on API 33+). Tracks `hasPermission`, `status`, `canRequestAgain`.                                                                                                                             |
| `useBackgroundLocation`  | Full tracking lifecycle management. Start/stop, auto-start option, location polling via `getLocations`, error handling, trip clearing. Converts options to `TrackingOptionsSpec` internally.                                                                                              |
| `useLocationTracking`    | Lightweight read-only tracking status monitor. Returns `isTracking`, `tripId`, `refresh`. No start/stop control.                                                                                                                                                                          |
| `useLocationUpdates`     | Real-time location streaming via `NativeEventEmitter`. Subscribes to `onLocationUpdate`, `onLocationWarning`, and `onNotificationAction`. Supports `onUpdateInterval` callback throttling, `autoLoad` of existing locations, and `clearLocations`. Polls tracking status every 5 seconds. |

---

## Android Native Layer

All Kotlin sources live under `android/src/main/java/com/backgroundlocation/`.

### Core Module

**`BackgroundLocationModule.kt`** -- TurboModule implementation (`NativeBackgroundLocationSpec` subclass). Responsibilities:

- Parses `ReadableMap` options into native `TrackingOptions` data class
- Manages `LifecycleEventListener` for host resume/pause/destroy
- Registers `LocalBroadcastManager` receiver for four event actions
- Forwards native events to JS via `RCTDeviceEventEmitter`
- On resume: checks stop token and tracking state, then schedules `RecoveryWorker` (API 31+) or recovers directly (older APIs)
- Stop sequence: set stop token, cancel recovery work, stop location updates on active instance, save state synchronously, stop service
- Permission checks: foreground-only mode skips `ACCESS_BACKGROUND_LOCATION`; Android 13+ checks `POST_NOTIFICATIONS`

### Foreground Service

**`LocationService.kt`** -- Android `Service` running as a foreground service. Key behaviors:

- Calls `startForeground()` immediately in `onStartCommand()` with a minimal notification to avoid `ForegroundServiceDidNotStartInTimeException` on API 31+, then updates with the proper notification once options are parsed
- Uses `START_REDELIVER_INTENT` for predictable system restart behavior
- Android 14+ (API 34): passes `FOREGROUND_SERVICE_TYPE_LOCATION` at runtime
- Restart loop detection: max 5 restarts per hour via SharedPreferences counter
- Stop token mechanism: 60-second validity window in SharedPreferences, checked before processing each location update
- `onTimeout()` override (API 35+): emits `SERVICE_TIMEOUT` warning, schedules service restart via `Handler`, then stops the current instance
- `onTaskRemoved()`: emits `TASK_REMOVED` warning; service continues because `stopWithTask="false"` in manifest
- Static `activeInstance` reference for immediate stop and notification update access
- `updateNotificationContent()`: merges new title/text into `trackingOptions`, rebuilds notification, posts via `NotificationManager`; changes are transient (not persisted to DB)

### Location Storage

**`LocationStorage.kt`** -- Thread-safe persistence layer using Room Database. Features:

- Batched async writes: locations buffered in a `ConcurrentLinkedQueue`, flushed when buffer reaches 10 items or every 5 seconds (whichever comes first)
- `forceFlush()` drains the buffer before reads to guarantee consistency
- Tracking state stored as a single-row table (`id = 1`) with full `TrackingOptions` serialization for crash recovery
- `saveTrackingStateSync()` suspend function for critical operations (stop sequence) to prevent race conditions
- Coroutine scope: `SupervisorJob() + Dispatchers.IO`
- `cleanup()` cancels batch timer, flushes pending writes, cancels scope

### Event Broadcasting

**`LocationEventBroadcaster.kt`** -- Singleton object decoupling `LocationService` from `BackgroundLocationModule` via `LocalBroadcastManager`. Handles four broadcast actions:

- `LOCATION_UPDATE` -- carries tripId + location data Bundle
- `LOCATION_ERROR` -- carries tripId + error type + message
- `LOCATION_WARNING` -- carries tripId + warning type + message
- `NOTIFICATION_ACTION` -- carries tripId + actionId

Provides `locationToBundle()` and `bundleToWritableMap()` converters. Includes all extended location fields (accuracy, altitude, speed, bearing, vertical accuracy, speed accuracy, bearing accuracy, elapsed realtime nanos, provider, mock indicator).

### Crash Recovery

**`RecoveryWorker.kt`** -- `CoroutineWorker` scheduled via WorkManager. Respects Android 12+ background start restrictions by using `setForeground(ForegroundInfo(...))` to safely create a `SystemForegroundService`. Recovery logic:

1. Check stop token (triple-checked: before state read, after state read, before service start)
2. Verify permissions still granted (clears tracking state if revoked)
3. Start `LocationService` with saved `TrackingOptions`
4. Exponential backoff on failure, max 3 retry attempts

### Notification Defaults

**`NotificationDefaults.kt`** -- Singleton resolving notification icon, large icon, and color with a four-level priority chain:

1. Runtime `TrackingOptions` value (handled by caller)
2. AndroidManifest `<meta-data>` keys (`com.backgroundlocation.default_notification_icon`, `...large_icon`, `...color`)
3. Conventional drawable names (`bg_location_notification_icon`, `bg_location_notification_large_icon`)
4. Android system default (`ic_menu_mylocation`)

Values are cached after first resolution.

### Notification Actions

**`NotificationActionReceiver.kt`** -- Manifest-registered `BroadcastReceiver` for notification button clicks. Receives `PendingIntent` broadcasts and forwards them to `LocationEventBroadcaster.broadcastNotificationAction()`, which delivers to `BackgroundLocationModule` via `LocalBroadcastManager`, which emits to JS.

### Provider Pattern (`provider/`)

| File                         | Role                                                                                                                                                                                                                                             |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `LocationProvider.kt`        | Interface defining `requestLocationUpdates`, `removeLocationUpdates`, `getLastLocation`, `isAvailable`, `cleanup`. Also defines `LocationUpdateCallback` with `onLocationUpdate`, `onLocationBatch`, `onLocationAvailabilityChanged`, `onError`. |
| `FusedLocationProvider.kt`   | Primary provider using Google Play Services `FusedLocationProviderClient`. Supports distance filter via `setMinUpdateDistanceMeters`. Checks availability via `GoogleApiAvailability`.                                                           |
| `AndroidLocationProvider.kt` | Fallback provider using Android `LocationManager`. Maps priority to `GPS_PROVIDER`, `NETWORK_PROVIDER`, or `PASSIVE_PROVIDER`. For devices without Google Play Services.                                                                         |
| `LocationProviderFactory.kt` | Factory selecting best available provider. Tries Fused first; falls back to Android if Google Play Services unavailable. Also supports explicit provider type selection.                                                                         |

### Database Layer (`database/`)

| File                     | Role                                                                                                                                                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LocationDatabase.kt`    | Room database singleton (version 4). Two tables: `locations`, `tracking_state`. No destructive fallback -- migrations are mandatory. Provides `getInMemoryInstance()` for testing.                            |
| `LocationEntity.kt`      | `@Entity` for `locations` table. 14 fields (id, tripId, lat, lng, timestamp + 9 optional). Indexed on `tripId`.                                                                                               |
| `TrackingStateEntity.kt` | `@Entity` for `tracking_state` table. Single-row (id=1). Stores full `TrackingOptions` for crash recovery (17 option columns).                                                                                |
| `LocationDao.kt`         | DAO with `insert`, `insertAll` (batch), `getLocationsByTripId`, `getLocationsByTripIdFlow` (reactive), `getLocationCount`, `deleteLocationsByTripId`, `deleteAllLocations`, `getAllTripIds`.                  |
| `TrackingStateDao.kt`    | DAO with `upsert` (INSERT OR REPLACE), `getTrackingState`, `clearTrackingState`.                                                                                                                              |
| `Migrations.kt`          | Incremental migrations: v1->v2 (icon/color/timestamp columns), v2->v3 (actions column), v3->v4 (largeIcon/subtext/channelId columns). Includes `validateMigrationPath()` and `getMigrationHistory()` helpers. |

### Location Processor (`processor/`)

**`LocationProcessor.kt`** -- Interface for pre-storage filtering and transformation. Methods: `shouldStore(location)`, `process(location)`, `onLocationBatch(locations)`. All have default no-op implementations.

**`DefaultLocationProcessor`** -- Default implementation that stores all locations unchanged.

### Supporting Files

| File                           | Role                                                                                                                    |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `TrackingOptions.kt`           | Kotlin data class mirroring JS `TrackingOptions`. 18 fields with companion defaults and `getXxxOrDefault()` accessors.  |
| `LocationAccuracy.kt`          | Kotlin enum with 5 levels mapping to Android `Priority` constants. `fromString()` factory with `HIGH_ACCURACY` default. |
| `BackgroundLocationPackage.kt` | React Native package registration for the TurboModule.                                                                  |

---

## iOS Native Layer

All Swift sources live under `ios/` alongside the Objective-C++ bridge file.

### TurboModule Bridge

**`BackgroundLocation.mm`** -- Objective-C++ bridge file that connects the TurboModule Codegen spec to the Swift implementation. Uses `@objc` protocol conformance to forward all spec methods to Swift classes. Handles type conversion between React Native `ReadableMap`/`WritableMap` and Swift types.

### Core Components

**`LocationManagerWrapper.swift`** -- Central orchestrator for all CLLocationManager operations. Responsibilities:

- Creates and configures `CLLocationManager` with accuracy, distance filter, and activity type
- Sets `allowsBackgroundLocationUpdates = true` and `pausesLocationUpdatesAutomatically` based on options
- Manages start/stop of `startUpdatingLocation()` and `startMonitoringSignificantLocationChanges()`
- Coordinates with `LocationManagerDelegate` for callback handling
- Applies stop token checks before processing location updates

**`LocationManagerDelegate.swift`** -- Implements `CLLocationManagerDelegate` protocol. Handles:

- `didUpdateLocations:` -- Processes new locations, forwards to storage and event emission
- `didFailWithError:` -- Handles location errors and emits error events
- `didChangeAuthorization:` -- Monitors permission changes, emits `PERMISSION_REVOKED` or `PERMISSION_DOWNGRADED` warnings if permissions change while tracking

**`LocationStorage.swift`** -- Core Data persistence layer with batched async writes. Features:

- Batched writes matching Android behavior (batch size and timeout-based flushing)
- `forceFlush()` for consistent reads
- Tracking state stored as a Core Data entity for crash recovery
- Thread-safe access via Core Data's `performBackgroundTask`
- Uses `NSPersistentContainer` with SQLite store

**`RecoveryManager.swift`** -- Crash recovery using significant location monitoring. Features:

- Stop token pattern (UserDefaults-based) prevents recovery after explicit stop
- Rate limiting: 5 recoveries per hour maximum
- On recovery: reads tracking state from Core Data, resumes CLLocationManager with saved options
- Triggered when the app is relaunched by significant location change

**`TrackingOptions.swift`** -- Swift data model mapping TypeScript `TrackingOptions` to iOS-native values. Handles:

- Conversion of string-typed accuracy to `CLLocationAccuracy` constants
- Distance filter mapping to `CLLocationManager.distanceFilter`
- Activity type mapping for battery optimization
- Ignoring Android-specific notification fields

**`LocationAccuracy.swift`** -- Maps the library's accuracy enum values to `CLLocationAccuracy` constants:

| Library Value             | iOS Constant                         |
| ------------------------- | ------------------------------------ |
| `HIGH_ACCURACY`           | `kCLLocationAccuracyBest`            |
| `BALANCED_POWER_ACCURACY` | `kCLLocationAccuracyHundredMeters`   |
| `LOW_POWER`               | `kCLLocationAccuracyKilometer`       |
| `NO_POWER` / `PASSIVE`    | `kCLLocationAccuracyThreeKilometers` |

**`CoreDataStack.swift`** -- Core Data setup and lifecycle management:

- `NSPersistentContainer` configuration with the library's data model
- Background context creation for write operations
- Main context for read operations
- Migration support for schema changes

---

## Key Design Decisions

### Stop Token Mechanism

A SharedPreferences-based boolean flag with a 60-second TTL. Set synchronously (`commit()`) during `stopTracking()` to prevent `RecoveryWorker` from restarting the service. Checked at three points: before reading tracking state, after reading tracking state, and before starting the service. Also checked by `LocationService.handleLocation()` on each location update to suppress late broadcasts.

### Restart Loop Detection

`LocationService` tracks restart count and timestamp in SharedPreferences. If more than 5 restarts occur within a 1-hour window, the service refuses to start and clears tracking state. Counter resets on clean shutdown (`onDestroy`).

### Batched Database Writes

Locations are buffered in a `ConcurrentLinkedQueue` and flushed to Room in batches of up to 10 items. A periodic timer flushes every 5 seconds regardless of buffer size. On read, `forceFlush()` drains the buffer first to guarantee data consistency. On flush failure, items are re-added to the buffer.

### Distance Filter

Both `FusedLocationProvider` (via `setMinUpdateDistanceMeters`) and `AndroidLocationProvider` (via `LocationManager` min distance parameter) support distance-based filtering. Default is 0 (no filter -- all updates delivered).

### Dual Provider with Automatic Fallback

`LocationProviderFactory` tries `FusedLocationProvider` first (Google Play Services). If unavailable (e.g., Huawei devices without GMS), falls back to `AndroidLocationProvider` using Android's native `LocationManager`. Both implement the same `LocationProvider` interface.

### Foreground-Only Mode

When `foregroundOnly: true`, the library skips `ACCESS_BACKGROUND_LOCATION` permission checks. Tracking only works while the app is visible. Useful for privacy-conscious flows that avoid background permission prompts.

### Notification Customization

Notifications support: custom title, text, subtext, small icon, large icon, accent color, timestamp, channel ID, channel name, priority, and up to 3 action buttons. Static defaults can be configured via AndroidManifest `<meta-data>` or conventional drawable names, with runtime overrides taking highest priority. Dynamic updates via `updateNotification()` are transient (not persisted to DB).

### Extended Location Data

Each location point includes up to 14 fields beyond lat/lng/timestamp: accuracy, altitude, speed, bearing, vertical accuracy (API 26+), speed accuracy (API 26+), bearing accuracy (API 26+), elapsed realtime nanos, provider name, and mock provider indicator (API 18+). Optional fields are only included when the underlying Android API reports valid values.

---

## Current Status

| Property          | Value                                                    |
| ----------------- | -------------------------------------------------------- |
| Version           | 0.10.0                                                    |
| Package           | `@gabriel-sisjr/react-native-background-location`        |
| Android support   | Min SDK 24, Target SDK 34                                |
| iOS support       | iOS 13+, Swift, CLLocationManager, Core Data             |
| Architecture      | React Native New Architecture (TurboModules)             |
| Android DB schema | Room Database version 4 (4 incremental migrations)       |
| iOS persistence   | Core Data with SQLite store                              |
| Build system      | react-native-builder-bob (ESM + TypeScript declarations) |
| Package manager   | Yarn 3.6.1 workspaces with Turborepo                     |

### Feature Completeness

| Feature                                          | Status   |
| ------------------------------------------------ | -------- |
| Background location tracking                     | Complete |
| Session-based tracking (trip IDs)                | Complete |
| Auto-generated trip IDs                          | Complete |
| Idempotent start/stop                            | Complete |
| Room DB persistent storage                       | Complete |
| Foreground service with notification             | Complete |
| Configurable location accuracy                   | Complete |
| Configurable update intervals                    | Complete |
| Distance filter                                  | Complete |
| Foreground-only mode                             | Complete |
| Notification visual customization                | Complete |
| Notification action buttons                      | Complete |
| Dynamic notification updates                     | Complete |
| Real-time event streaming to JS                  | Complete |
| Warning events (timeout, task removed, GPS lost) | Complete |
| WorkManager crash recovery                       | Complete |
| Restart loop detection                           | Complete |
| Stop token anti-restart mechanism                | Complete |
| React hooks (4 hooks)                            | Complete |
| Permission management hook                       | Complete |
| Dual location provider (Fused + Android)         | Complete |
| Extended location data (14 fields)               | Complete |
| iOS implementation                               | Complete |
| iOS CLLocationManager tracking                   | Complete |
| iOS Core Data persistence                        | Complete |
| iOS crash recovery (significant location)        | Complete |
| iOS two-step permission flow                     | Complete |
| Cross-platform permission hooks                  | Complete |
