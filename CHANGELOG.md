# Changelog

## [0.11.0] - 2026-03-25

### Added

- `configureGeofenceNotifications(options)` -- global notification configuration for geofence transitions
- `getGeofenceNotificationConfig()` -- retrieve current notification configuration
- `NotificationOptions` interface -- unified notification configuration type for the library
- `GEOFENCE_TEMPLATE_VARS` constant -- template variable reference for autocomplete
- Template variable support in notification title and text: `{{identifier}}`, `{{transitionType}}`, `{{latitude}}`, `{{longitude}}`, `{{radius}}`, `{{timestamp}}`, `{{metadata.KEY}}`
- iOS geofence transition notifications via `UNUserNotificationCenter` (previously iOS showed no notifications)
- `notificationOptions` on `UseGeofencingOptions` for hook-based configuration
- `notificationOptions` field on `GeofenceRegion` for per-geofence notification overrides
  - Set to a `NotificationOptions` object to customize notification content for a specific geofence
  - Set to `false` as shorthand for `{ enabled: false }` to suppress notifications for a specific geofence
  - Omit (or set to `undefined`) to inherit the global configuration
- `transitionOverrides` field on `NotificationOptions` for per-transition-type notification customization
  - Supports `ENTER`, `EXIT`, and `DWELL` keys, each accepting a partial `NotificationOptions` object
  - Works at both the per-geofence level and the global level (`configureGeofenceNotifications()`)
- Notification resolution chain: per-geofence transition override -> per-geofence config -> global transition override -> global config -> built-in defaults
- Mixed batch support: `addGeofences()` accepts geofences with different notification configurations in a single call
- Example app: notification presets demo in `GeofencingScreen` with 5 selectable presets (Default, Custom Templates, Per-Transition, Silent, High Priority), live JSON config preview, and per-geofence preset badges

### Improved

- **Hook reference stability**: All hooks (`useGeofencing`, `useGeofenceEvents`, `useLocationUpdates`, `useBackgroundLocation`, `useLocationTracking`, `useLocationPermissions`) now internalize reference stabilization via `useRef` pattern. Consumers no longer need to wrap options or callbacks with `useMemo`/`useCallback` — inline objects and functions work correctly without causing unnecessary effect re-runs or listener re-subscriptions.
- **Memoized hook return values**: All hooks now return `useMemo`-wrapped objects, preventing unnecessary re-renders in consumer components that rely on referential equality.
- **Polling optimization**: `useLocationUpdates` 5-second status polling now skips `setState` calls when values are unchanged, eliminating periodic unnecessary re-renders.
- **Metadata serialization fix**: `GeofenceRegion.metadata` is no longer double-serialized when passed through `addGeofence()`/`addGeofences()`. Previously, Android would crash (`java.lang.String cannot be converted to JSONObject`) and iOS would silently drop the metadata. Template variables like `{{metadata.fieldName}}` now resolve correctly on both platforms.

### Changed

- (Android): Geofence notification text changed from hardcoded English ("Entered geofence" / "Geofence: {id}") to template-based defaults ("{{transitionType}} zone: {{identifier}}" / "Transition detected"). Customize via `configureGeofenceNotifications()`.
- **Android**: Room Database migration v5 -> v6 -- adds `notificationConfig TEXT` column to the geofence table for persisting per-geofence notification configuration
- **iOS**: Core Data model version v3 -- adds optional `notificationConfig` attribute for per-geofence notification persistence

## [0.10.0] - 2026-03-21

### Added

- **Full iOS Support**: Complete native implementation using Swift and CLLocationManager
  - Background location tracking with `CLLocationManager` and `allowsBackgroundLocationUpdates`
  - Core Data persistence with batched async writes (matches Android Room DB behavior)
  - Two-step permission flow: WhenInUse → Always authorization via `requestAlwaysAuthorization()`
  - Significant location monitoring for crash recovery and app wake-up
  - `RecoveryManager` with stop token pattern and 5 recoveries/hour limit
  - `LocationManagerWrapper` orchestrating CLLocationManager lifecycle
  - `LocationManagerDelegate` handling all delegate callbacks
  - `CoreDataStack` for persistent storage setup and management
  - `TrackingOptions.swift` and `LocationAccuracy.swift` mapping TypeScript options to iOS native values
  - `activityType` support for battery optimization (automotive, fitness, other navigation)
  - `pausesLocationUpdatesAutomatically` for system-managed battery savings

- **Cross-Platform Permission Hooks**: `useLocationPermissions` now works on both platforms
  - iOS uses native `checkLocationPermission()` and `requestLocationPermission()` TurboModule methods
  - New `WHEN_IN_USE` permission status for iOS (maps to `hasPermission = true`)
  - Android continues using `PermissionsAndroid` API as before

- **New TurboModule Methods**:
  - `checkLocationPermission()` - Returns current permission status from native layer
  - `requestLocationPermission()` - Requests location permission through native CLLocationManager (iOS)

- **iOS Warning Events**: Platform-specific warnings via `onLocationWarning`
  - `PERMISSION_REVOKED` - User revoked location permission while tracking
  - `PERMISSION_DOWNGRADED` - User downgraded from Always to WhenInUse

### Changed

- `useLocationPermissions` hook is now fully cross-platform (was Android-only)
- `LocationPermissionStatus` enum now includes `WHEN_IN_USE` value
- Documentation updated across all guides to reflect dual-platform support

### iOS-Specific Behavior

- No foreground notification on iOS; the system shows a blue status bar indicator
- Notification-related `TrackingOptions` fields are silently ignored on iOS
- `activityType` in `TrackingOptions` is iOS-only (ignored on Android)
- Crash recovery uses significant location monitoring instead of WorkManager
- Persistence uses Core Data (SQLite) instead of Room Database
- Distance filter uses `CLLocationManager.distanceFilter` property

### Requirements

- React Native 0.70 or higher
- Android API 24+ (Android 7.0 Nougat)
- iOS 13+ (iPhone and iPad)
- Xcode 15+ (for building iOS)
- Google Play Services Location 21.3.0 (Android)

## [0.9.0] - 2026-03-19

### Added

- 🎨 **Notification Visual Customization** (Phase 1): Core appearance options for the foreground service notification
  - `notificationSmallIcon` (string) - Custom drawable resource name for small icon, with fallback to system default
  - `notificationColor` (string) - Hex color for notification accent color (e.g., "#FF5722")
  - `notificationShowTimestamp` (boolean) - Show/hide timestamp on notification

- 🔄 **Dynamic Notification Updates** (Phase 2): Update notification content while tracking is active
  - New `updateNotification(title, text)` method on the public API and TurboModule spec
  - Updates notification content in-place using `NotificationManager.notify()`
  - Dynamic updates are transient (not persisted to DB, won't survive service restart)

- 🔘 **Notification Action Buttons** (Phase 3): Interactive buttons on the tracking notification
  - New `NotificationAction` interface: `{ id: string; label: string }`
  - New `NotificationActionEvent` interface: `{ tripId: string; actionId: string }`
  - `notificationActions` field in `TrackingOptions` (max 3 actions)
  - New `onNotificationAction` callback in `useLocationUpdates` hook
  - Flow: PendingIntent → NotificationActionReceiver → LocalBroadcast → RCTDeviceEventEmitter → JS
  - JSON serialization workaround for Codegen (typed object arrays not supported)
  - New `NotificationActionReceiver` manifest-registered BroadcastReceiver

- 🖼️ **Extended Notification Customization** (Phase 4): Additional appearance options
  - `notificationLargeIcon` (string) - Drawable resource decoded with BitmapFactory for large icon
  - `notificationSubtext` (string) - Subtext below notification content
  - `notificationChannelId` (string) - Custom notification channel ID (default still "background_location_channel")

- 🎯 **Static Notification Defaults**: Configure default icons and colors without runtime options
  - AndroidManifest `<meta-data>` support (same pattern as Firebase)
    - `com.backgroundlocation.default_notification_icon` — default small icon
    - `com.backgroundlocation.default_notification_large_icon` — default large icon
    - `com.backgroundlocation.default_notification_color` — default accent color
  - Convention-based drawable resolution (`bg_location_notification_icon` in `res/drawable/`)
  - Resolution chain: Runtime → Manifest → Convention → System default
  - Applies to all notification contexts including minimal notification (Android 12+ deadline) and crash recovery
  - New `NotificationDefaults.kt` utility with cached resolution

- 🗄️ **Database Migrations**: Room Database schema versioning v1 → v4
  - Migration v1→v2 (Phase 1): Visual customization fields
  - Migration v2→v3 (Phase 3): Notification action fields
  - Migration v3→v4 (Phase 4): Extended customization fields
  - All new fields persisted in `TrackingStateEntity` for crash recovery

### Changed

- 🔧 **TrackingOptions**: Extended with 6 new notification parameters
  - Added `notificationSmallIcon?: string` for custom small icon drawable
  - Added `notificationColor?: string` for notification accent color
  - Added `notificationShowTimestamp?: boolean` for timestamp visibility
  - Added `notificationLargeIcon?: string` for large icon drawable
  - Added `notificationSubtext?: string` for notification subtext
  - Added `notificationChannelId?: string` for custom channel ID
  - Added `notificationActions?: NotificationAction[]` for action buttons (max 3)

- 🔧 **TurboModule Spec**: Extended with new fields and method
  - Added all new notification fields to the spec
  - Added `updateNotification(title: string, text: string)` method

- 🔧 **LocationService**: Enhanced notification creation
  - Large icon support with `BitmapFactory` drawable decoding
  - Subtext support below notification content
  - Custom notification channel ID support
  - Action buttons with `PendingIntent` for each action
  - In-place notification content updates via `updateNotificationContent()`
  - Bundle serialization for notification actions

- 🔧 **LocationEventBroadcaster**: New notification action broadcasting
  - Added `ACTION_NOTIFICATION_ACTION` constant
  - Added `broadcastNotificationAction()` method

- 🔧 **Hooks**: Extended for new notification features
  - `useBackgroundLocation`: TrackingOptions → TrackingOptionsSpec conversion for new fields
  - `useLocationUpdates`: Added `onNotificationAction` event listener

- 🔧 **LocationService**: Notification icon/color resolution now uses `NotificationDefaults` utility
  - `createMinimalNotification()` respects static defaults instead of hardcoded system icon
  - `createNotification()` uses full resolution chain for icon, large icon, and color
- 🔧 **RecoveryWorker**: Recovery notification now uses `NotificationDefaults` for icon resolution

### Technical Details

**File Changes (TypeScript):**

- `src/types/tracking.ts`: Added `NotificationAction`, `NotificationActionEvent` interfaces, 6 new `TrackingOptions` fields
- `src/types/hooks.ts`: Added `onNotificationAction` callback to hook options
- `src/types/index.ts`: New type exports for `NotificationAction` and `NotificationActionEvent`
- `src/NativeBackgroundLocation.ts`: New spec fields + `updateNotification` method
- `src/index.tsx`: Public API: `updateNotification`, JSON serialization of actions, new type exports
- `src/hooks/useBackgroundLocation.ts`: TrackingOptions → TrackingOptionsSpec conversion for new fields
- `src/hooks/useLocationUpdates.ts`: `onNotificationAction` event listener

**File Changes (Kotlin):**

- `android/src/main/java/com/backgroundlocation/TrackingOptions.kt`: 6 new fields
- `android/src/main/java/com/backgroundlocation/BackgroundLocationModule.kt`: Parse new fields, `handleNotificationAction`, `updateNotification` override
- `android/src/main/java/com/backgroundlocation/LocationService.kt`: `createNotification` updates (largeIcon, subtext, channelId, actions with PendingIntent), `updateNotificationContent`, Bundle serialization
- `android/src/main/java/com/backgroundlocation/LocationEventBroadcaster.kt`: `ACTION_NOTIFICATION_ACTION` + `broadcastNotificationAction`
- `android/src/main/java/com/backgroundlocation/NotificationActionReceiver.kt`: New manifest-registered BroadcastReceiver
- `android/src/main/AndroidManifest.xml`: Register `NotificationActionReceiver`
- `android/src/main/java/com/backgroundlocation/LocationStorage.kt`: Save/restore all new fields
- `android/src/main/java/com/backgroundlocation/database/TrackingStateEntity.kt`: 6 new columns
- `android/src/main/java/com/backgroundlocation/database/LocationDatabase.kt`: Version 1→4
- `android/src/main/java/com/backgroundlocation/database/Migrations.kt`: `MIGRATION_1_2`, `MIGRATION_2_3`, `MIGRATION_3_4`
- `NotificationDefaults.kt` - NEW: Singleton utility for resolving notification icon/color from manifest metadata, convention drawables, and system defaults with caching
- `LocationService.kt` - Refactored icon/color resolution to use NotificationDefaults in createMinimalNotification() and createNotification()
- `RecoveryWorker.kt` - Refactored icon resolution to use NotificationDefaults in createRecoveryNotification()

**File Changes (Tests):**

- `src/__tests__/index.test.ts`: 11 new tests (visual options, updateNotification, actions serialization, extended options)

**Architecture:**

- Four-phase implementation for incremental delivery
- JSON serialization workaround for Codegen limitation with typed object arrays
- PendingIntent-based action flow through manifest-registered BroadcastReceiver
- Transient dynamic updates (not persisted) for performance
- All persistent fields stored in Room DB for crash recovery continuity

### Migration Guide

If upgrading from 0.8.0:

**No Breaking Changes** - All existing code continues to work without modifications. All new fields are optional with defaults preserving existing behavior.

**New Features Available:**

```typescript
// Notification visual customization
await BackgroundLocation.startTracking('trip-123', {
  notificationSmallIcon: 'ic_delivery',
  notificationColor: '#FF5722',
  notificationShowTimestamp: true,
  notificationLargeIcon: 'ic_large_logo',
  notificationSubtext: '2.5km remaining',
  notificationChannelId: 'delivery_tracking',
  notificationActions: [
    { id: 'stop', label: 'Stop' },
    { id: 'pause', label: 'Pause' },
  ],
});

// Dynamic notification update
await BackgroundLocation.updateNotification(
  'Delivery #1234',
  'Arriving in 5 minutes'
);

// Listen for action button presses
useLocationUpdates({
  onNotificationAction: (event) => {
    if (event.actionId === 'stop') stopTracking();
  },
});

// Or configure defaults statically in AndroidManifest.xml (no runtime code needed):
// <meta-data android:name="com.backgroundlocation.default_notification_icon"
//            android:resource="@drawable/ic_notification" />
```

### Requirements

- React Native 0.70 or higher
- Android API 24+ (Android 7.0 Nougat)
- Google Play Services Location 21.3.0
- Kotlin 2.0.21
- Room Database v4 schema

## [0.8.0] - 2025-12-22

### Added

- 📏 **Distance Filter**: Minimum distance between location updates (Android)
  - `distanceFilter` option in `TrackingOptions` (in meters)
  - Uses `setMinUpdateDistanceMeters()` for FusedLocationProvider
  - Uses `minDistance` parameter for AndroidLocationProvider
  - Default: 0 (no distance filter - all updates delivered)

- ⏱️ **Callback Throttling**: Control callback execution frequency
  - `onUpdateInterval` option in `TrackingOptions` and `UseLocationUpdatesOptions`
  - Throttles `onLocationUpdate` callback to execute at minimum intervals (e.g., every 30 seconds)
  - Locations are still collected and stored at `updateInterval` rate
  - Callback fires on the first location that arrives after the interval has elapsed
  - Ideal for periodic server sync without overwhelming network requests

- 🔄 **startTracking Overload**: Cleaner API for options-only calls
  - `startTracking(options?: TrackingOptions)` - new signature
  - `startTracking(tripId?: string, options?: TrackingOptions)` - backward compatible
  - Automatically detects if first argument is options object or tripId

### Changed

- 🔧 **LocationProvider Interface**: Added `distanceFilter` parameter
  - Updated `requestLocationUpdates()` signature in all providers
  - Both FusedLocationProvider and AndroidLocationProvider support distance filtering

- 📱 **TrackingOptions**: Extended with new parameters
  - Added `distanceFilter?: number` for Android distance filtering
  - Added `onUpdateInterval?: number` for callback throttling

### Technical Details

**File Changes:**

- `android/src/main/java/com/backgroundlocation/TrackingOptions.kt`: Added distanceFilter
- `android/src/main/java/com/backgroundlocation/provider/LocationProvider.kt`: Updated interface
- `android/src/main/java/com/backgroundlocation/provider/FusedLocationProvider.kt`: Distance filter support
- `android/src/main/java/com/backgroundlocation/provider/AndroidLocationProvider.kt`: Distance filter support
- `android/src/main/java/com/backgroundlocation/LocationService.kt`: Pass distanceFilter to providers
- `android/src/main/java/com/backgroundlocation/BackgroundLocationModule.kt`: Parse distanceFilter option
- `src/types/tracking.ts`: Added distanceFilter and onUpdateInterval types
- `src/types/hooks.ts`: Added onUpdateInterval to UseLocationUpdatesOptions
- `src/hooks/useLocationUpdates.ts`: Implemented callback throttling
- `src/index.tsx`: Added startTracking overload with distanceFilter support
- `src/NativeBackgroundLocation.ts`: Added distanceFilter to TurboModule spec

### Migration Guide

If upgrading from 0.7.0:

**No Breaking Changes** - All existing code continues to work without modifications.

**New Features Available:**

```typescript
// Distance filter - only update if moved 50+ meters
await BackgroundLocation.startTracking('my-trip', {
  distanceFilter: 50,
  updateInterval: 5000,
});

// Cleaner API - no need to pass undefined for tripId
await BackgroundLocation.startTracking({
  distanceFilter: 100,
  notificationTitle: 'Tracking',
});

// Callback throttling - callback executes every ~30 seconds
// Locations are still collected at updateInterval rate, but onLocationUpdate
// fires only when 30+ seconds have passed since the last callback execution
useLocationUpdates({
  onLocationUpdate: (location) => syncToServer(location),
  onUpdateInterval: 30000, // minimum 30 seconds between callback executions
});
```

### Requirements

- React Native 0.70 or higher
- Android API 24+ (Android 7.0 Nougat)
- Google Play Services Location 21.3.0
- Kotlin 2.0.21

## [0.7.0] - 2025-12-20

### Added

- 🤖 **Android 14/15 Compliance**: Full compatibility with latest Android versions
  - `FOREGROUND_SERVICE_TYPE_LOCATION` declaration for Android 14+ (API 34)
  - `onTimeout()` callback handling for Android 15+ (~6 hour service limit)
  - Auto-restart service with saved state when timeout reached
  - `onTaskRemoved()` handling for app swipe from recents

- ⚠️ **Warning Event System**: New event types for service lifecycle
  - `LocationWarningEvent` type for warning notifications
  - `LocationWarningType` enum: `SERVICE_TIMEOUT`, `TASK_REMOVED`, `LOCATION_UNAVAILABLE`
  - `onLocationWarning` callback in `useLocationUpdates` hook
  - `lastWarning` state in hook results

- 🏗️ **Provider Abstraction Layer**: Extensible location provider system
  - `LocationProvider` interface for location updates
  - `FusedLocationProvider` - Google Play Services implementation
  - `AndroidLocationProvider` - Fallback for devices without Play Services
  - `LocationProviderFactory` for automatic provider selection
  - `LocationProcessor` interface for filtering and processing

- 📚 **Production Documentation**: Comprehensive production guides
  - `docs/production/BATTERY_OPTIMIZATION.md` - Battery efficiency guide
  - `docs/production/CRASH_RECOVERY.md` - Recovery mechanisms documentation
  - `docs/production/GOOGLE_PLAY_COMPLIANCE.md` - Play Store requirements

- 🗄️ **Database Migrations**: Room Database schema versioning
  - Version 2 schema with migrations support
  - Automatic migration from version 1 to 2

### Changed

- 🔧 **LocationService**: Major architectural improvements
  - Immediate `startForeground()` call within 5-10 second Android requirement
  - Enhanced restart handling with crash loop protection
  - Improved notification channel management

- 🔧 **BackgroundLocationModule**: Enhanced event broadcasting
  - Uses `LocationEventBroadcaster` for IPC via LocalBroadcastManager
  - Better separation of concerns for event handling

- 📱 **Example App**: Updated for Android 15 compatibility
  - Updated AndroidManifest.xml with proper service declarations
  - Foreground service type declarations

### Requirements

- React Native 0.70 or higher
- Android API 24+ (Android 7.0 Nougat)
- Google Play Services Location 21.3.0
- Kotlin 2.0.21
- Supports Android 15 (API 35, targetSDK 36)

## [0.6.0] - 2025-11-16

### Added

- 🔄 **Crash Recovery & Data Persistence**: Robust recovery system for tracking sessions
  - Automatic tracking session recovery after app crash or restart
  - Persistent storage of `TrackingOptions` for complete state restoration
  - Service auto-recovery using `START_STICKY` for system-initiated restarts
  - Graceful handling of permission revocations during recovery
  - Automatic cleanup of corrupted state to prevent recovery loops
  - Complete recovery documentation and testing guide
  - Recovery works across app crashes, system process termination, and device reboots

- 🗄️ **Room Database Integration**: Modern persistence layer
  - Room Database 2.6.1 with KSP for all data persistence
  - Location data stored with SQLite backend and indexed queries
  - Tracking state stored in single-row table for efficiency
  - Better performance and scalability for large datasets
  - Thread-safe coroutine-based operations
  - No JSON parsing or serialization overhead

- 📚 **Comprehensive Documentation**:
  - Complete crash recovery architecture guide in `docs/development/CRASH_RECOVERY.md`
  - Manual testing guide with 8 detailed scenarios in `docs/development/TEST_RECOVERY.md`
  - Technical implementation documentation in `docs/development/IMPLEMENTATION_RECOVERY.md`
  - Performance metrics and best practices
  - Troubleshooting guide for common recovery scenarios

### Changed

- 🔧 **LocationStorage**: Complete refactoring to use Room Database exclusively
  - Maintains same public API for backward compatibility
  - All data stored in SQLite via Room (locations and tracking state)
  - `saveTrackingState()` now accepts optional `TrackingOptions` parameter
  - `getTrackingState()` returns `TrackingState` with stored options
  - Automatic cleanup of options when tracking stops
  - Asynchronous operations with coroutines for better performance
  - Zero JSON parsing or serialization

- 🔧 **BackgroundLocationModule**: Enhanced initialization with recovery
  - Added `recoverTrackingSession()` called during module init
  - Validates permissions before attempting recovery
  - Restarts LocationService with saved tripId and options
  - Handles recovery failures gracefully with state cleanup

- 🔧 **LocationService**: Improved service restart capability
  - Enhanced `onStartCommand()` to handle null intent (system restart)
  - Automatic recovery of tripId and options from storage
  - Already uses `START_STICKY` for automatic system restart
  - Graceful degradation when recovery data unavailable

### Technical Details

**Architecture Changes:**

- New persistence layer using Room Database exclusively
- Room Database handles all data with SQLite backend and indexed queries
- Locations stored in `locations` table with tripId index
- Tracking state stored in single-row `tracking_state` table
- Thread-safe operations using Kotlin Coroutines
- TrackingState data class now includes `options: TrackingOptions?`
- Module initialization triggers automatic recovery check
- Service can self-recover from storage when restarted by system

**Recovery Flow:**

1. App crashes or is killed by system
2. User reopens app (or system restarts service via START_STICKY)
3. `BackgroundLocationModule.init()` calls `recoverTrackingSession()`
4. Checks for active tracking state in Room Database
5. Validates location permissions still granted
6. Restarts `LocationService` with saved tripId and TrackingOptions
7. Tracking continues seamlessly from previous state

**Error Handling:**

- Permission revocation during recovery clears tracking state
- Corrupted recovery data triggers automatic cleanup
- Best-effort recovery with graceful fallback to clean state

**File Changes:**

- `android/build.gradle`: Added Room 2.6.1 with KSP dependencies
- `android/src/main/java/com/backgroundlocation/database/LocationEntity.kt`: Room entity for locations (new)
- `android/src/main/java/com/backgroundlocation/database/LocationDao.kt`: DAO for location operations (new)
- `android/src/main/java/com/backgroundlocation/database/TrackingStateEntity.kt`: Room entity for tracking state (new)
- `android/src/main/java/com/backgroundlocation/database/TrackingStateDao.kt`: DAO for tracking state operations (new)
- `android/src/main/java/com/backgroundlocation/database/LocationDatabase.kt`: Room database singleton with both tables (new)
- `android/src/main/java/com/backgroundlocation/LocationStorage.kt`: Refactored to use Room exclusively
- `android/src/main/java/com/backgroundlocation/BackgroundLocationModule.kt`: Added recovery logic
- `android/src/main/java/com/backgroundlocation/LocationService.kt`: Improved restart handling
- `docs/development/CRASH_RECOVERY.md`: Complete recovery documentation (new)
- `docs/development/TEST_RECOVERY.md`: Manual testing guide (new)
- `docs/development/IMPLEMENTATION_RECOVERY.md`: Technical implementation details (new)

### Migration Guide

If upgrading from 0.5.0:

**No Breaking Changes** - All existing code continues to work without modifications.

**Important Note:**

- Previous versions stored data in memory only
- After update, any in-progress tracking sessions will need to be restarted
- This is expected behavior and not a bug

**New Features Available:**

```typescript
// Everything continues to work as before
const { startTracking, stopTracking, getLocations } = useBackgroundLocation();

// Crash recovery is now automatic
await startTracking('my-trip', {
  updateInterval: 5000,
  accuracy: LocationAccuracy.HIGH_ACCURACY,
});

// If app crashes and restarts, tracking resumes automatically
// All locations are now persisted to database
```

**Performance Improvements:**

- Better performance with large datasets (1000+ location points)
- Faster queries with indexed Room Database
- Reduced memory usage with coroutine-based operations
- No JSON parsing overhead - direct SQLite storage

**Best Practices:**

- Crash recovery is automatic - no configuration needed
- Data is now persisted to SQLite database
- Use `clearTrip()` to remove old trip data when no longer needed

### Requirements

- React Native 0.70 or higher
- Android API 24+ (Android 7.0 Nougat)
- Google Play Services Location 21.3.0
- Kotlin 2.0.21
- KSP (Kotlin Symbol Processing) for Room code generation

## [0.5.0] - 2025-11-14

### Added

- 📍 **Extended Location Properties**: Full support for all location data from play-services-location:21.3.0
  - `accuracy` - Horizontal accuracy in meters
  - `altitude` - Altitude in meters above sea level
  - `speed` - Speed in meters per second
  - `bearing` - Bearing in degrees (0-360)
  - `verticalAccuracyMeters` - Vertical accuracy in meters (Android API 26+)
  - `speedAccuracyMetersPerSecond` - Speed accuracy in meters per second (Android API 26+)
  - `bearingAccuracyDegrees` - Bearing accuracy in degrees (Android API 26+)
  - `elapsedRealtimeNanos` - Elapsed realtime in nanoseconds since system boot
  - `provider` - Location provider (gps, network, passive, etc.)
  - `isFromMockProvider` - Whether the location is from a mock provider (Android API 18+)
  - All properties are optional and only included when available from the location provider

- 🛠️ **Utility Functions**: New utility module for object manipulation
  - `extractDefinedProperties()` - Generic function to extract all defined properties from objects
  - Located in `src/utils/objectUtils.ts` for reusability across the codebase
  - Automatically handles optional properties without manual field listing

- 📱 **Enhanced Example App**: Updated example app to demonstrate extended location properties
  - Displays all available location properties in real-time
  - Shows formatted values (speed in km/h, elapsed time in ms, etc.)
  - Visual separation between required and optional properties
  - Demonstrates proper usage of extended location data

### Changed

- 🔧 **TypeScript Interfaces**: Extended `Coords` and `LocationUpdateEvent` interfaces
  - Added 10 new optional properties with full JSDoc documentation
  - Maintains backward compatibility (all new fields are optional)
  - Type-safe access to all location data from play-services-location API

- 🔄 **Hook Implementation**: Enhanced `useLocationUpdates` hook
  - Automatically extracts and includes all available location properties
  - Uses generic utility function for property extraction
  - No manual field mapping required for future property additions

- 📦 **Native Android Module**: Extended LocationService and LocationStorage
  - `LocationService.handleLocation()` now extracts all available location data
  - `LocationService.sendLocationUpdateEvent()` includes all properties in events
  - `LocationStorage.saveLocation()` stores all available properties
  - `LocationStorage.getLocations()` returns all stored properties
  - Proper handling of API-level specific properties (Android 18+, 26+)

### Technical Details

**File Changes:**

- `android/src/main/java/com/backgroundlocation/LocationService.kt`: Extended to extract and emit all location properties
- `android/src/main/java/com/backgroundlocation/LocationStorage.kt`: Extended to save and retrieve all location properties
- `src/types/tracking.ts`: Added optional properties to `Coords` and `LocationUpdateEvent` interfaces
- `src/hooks/useLocationUpdates.ts`: Enhanced to map all properties using `extractDefinedProperties`
- `src/utils/objectUtils.ts`: New utility module for generic property extraction
- `example/src/App.tsx`: Updated to display all location properties
- `example/src/styles.ts`: Added styles for additional properties display

**Architecture:**

- Generic property extraction eliminates manual field mapping
- Future-proof design automatically includes new properties
- Type-safe access to all location data
- Backward compatible (existing code continues to work)
- Proper handling of optional and API-level specific properties

### Migration Guide

If upgrading from 0.4.0:

**No Breaking Changes** - All existing code continues to work without modifications.

**New Features Available:**

```typescript
// Existing code still works
const { locations } = useLocationUpdates();
locations.forEach((location) => {
  console.log(location.latitude);
  console.log(location.longitude);
  console.log(location.timestamp);
});

// New properties are now available (when provided by location provider)
locations.forEach((location) => {
  if (location.accuracy !== undefined) {
    console.log(`Accuracy: ${location.accuracy} meters`);
  }
  if (location.speed !== undefined) {
    console.log(`Speed: ${location.speed} m/s`);
  }
  if (location.altitude !== undefined) {
    console.log(`Altitude: ${location.altitude} meters`);
  }
  // ... and more properties
});
```

**Best Practices:**

- Always check for `undefined` before using optional properties
- Properties may not be available on all devices or Android versions
- Some properties require specific Android API levels (18+, 26+)

## [0.4.0] - 2025-11-05

### Added

- ⚙️ **Configurable Tracking Options**: Full customization of location tracking parameters
  - `TrackingOptions` interface for comprehensive configuration
  - Customizable update intervals (`updateInterval`, `fastestInterval`, `maxWaitTime`)
  - Location accuracy levels (`LocationAccuracy` enum)
  - Notification customization (`notificationTitle`, `notificationText`, `notificationChannelName`, `notificationPriority`)
  - `waitForAccurateLocation` option for precise GPS tracking
  - Support for configuration options in `startTracking()` method and `useBackgroundLocation` hook

- 📊 **Location Accuracy Enums**: Type-safe location accuracy levels
  - `LocationAccuracy.HIGH_ACCURACY` - Highest accuracy using GPS and sensors
  - `LocationAccuracy.BALANCED_POWER_ACCURACY` - Balanced accuracy and power consumption
  - `LocationAccuracy.LOW_POWER` - Low power consumption using network-based location
  - `LocationAccuracy.NO_POWER` - No power consumption, passive updates
  - `LocationAccuracy.PASSIVE` - Receives location updates from other apps

- 🔔 **Notification Priority Enums**: Type-safe notification priority levels
  - `NotificationPriority.LOW` - Low priority (default)
  - `NotificationPriority.DEFAULT` - Default priority
  - `NotificationPriority.HIGH` - High priority
  - `NotificationPriority.MAX` - Maximum priority

- 🗑️ **Clear Locations Method**: Added `clearLocations()` method to `useLocationUpdates` hook
  - Allows clearing all locations for the current trip
  - Prevents immediate reloading of data after clear operation
  - Works seamlessly with auto-update functionality

- 📱 **Configuration Presets**: Example app includes predefined configuration presets
  - **High Accuracy**: Optimized for navigation (2s interval, GPS)
  - **Balanced**: Good balance between accuracy and battery (10s interval)
  - **Low Power**: Optimized for battery efficiency (30s interval, network-based)
  - **Default**: Standard configuration (5s interval)

- 🔋 **Battery Optimization**: Built-in battery efficiency features
  - Configurable accuracy levels (`LOW_POWER`, `BALANCED_POWER_ACCURACY`) for reduced battery consumption
  - Adjustable update intervals (`updateInterval`, `fastestInterval`, `maxWaitTime`) to minimize location requests
  - Smart location updates that only request when necessary
  - Foreground service optimization for efficient background operation
  - Configuration presets for common battery-conscious use cases

### Changed

- 🔧 **API Enhancement**: `startTracking()` now accepts optional `TrackingOptions` parameter
  - `startTracking(tripId?: string, options?: TrackingOptions): Promise<string>`
  - Backwards compatible with existing code (options are optional)
  - Default values applied when options not provided

- 📚 **Documentation Updates**: Comprehensive documentation for new features
  - Updated README.md with configuration examples and enums documentation
  - Enhanced hooks.md with TrackingOptions examples
  - Updated QUICKSTART.md with configuration examples
  - Added configuration presets documentation

### Fixed

- 🐛 Fixed inline styles warnings in RouteMap component
- 🐛 Fixed enum export/import issues for proper TypeScript support
- 🐛 Improved type safety for TrackingOptions across the codebase

## [0.3.0] - 2025-01-26

### Added

- 🎯 **Real-time Location Updates**: New `useLocationUpdates` hook for automatic location watching
  - Real-time event-driven location updates via native events
  - Automatic subscription to `onLocationUpdate` events from Android background service
  - Access to last location received in real-time
  - Optional filtering by specific tripId
  - Callback support for each new location
  - Automatic loading of existing locations on mount
  - Complete TypeScript support with full type definitions
  - Automatic cleanup of event listeners on unmount
  - Graceful handling when native module unavailable

- 📡 **Android Event System**: Native event emission infrastructure
  - LocationService emits `onLocationUpdate` events via DeviceEventManagerModule
  - Events sent whenever new GPS location is collected
  - Non-blocking async event emission
  - Context-aware event system with React Native bridge

- 📚 **Enhanced Documentation**:
  - Complete real-time updates guide in `docs/getting-started/REAL_TIME_UPDATES.md`
  - Usage examples demonstrating manual vs automatic modes
  - Best practices for combining hooks
  - FAQ section with common questions
  - Updated example app with toggle for manual/automatic modes

- 🎨 **Improved Example App**:
  - Added toggle switch to demonstrate manual vs automatic update modes
  - Real-time visualization of last location
  - Visual indicators for active mode
  - Conditional UI elements based on update mode

### Changed

- 📦 **Version Bump**: Updated to 0.3.0 following semantic versioning (minor release for new features)
- 🔄 **Event System**: Android LocationService now emits native events for real-time updates
- 📱 **Module Integration**: BackgroundLocationModule now provides ReactContext to LocationService

### Technical Details

**File Changes:**

- `android/src/main/java/com/backgroundlocation/LocationService.kt`: Added event emission
- `android/src/main/java/com/backgroundlocation/BackgroundLocationModule.kt`: Added context setup
- `src/hooks/useLocationUpdates.ts`: New hook for real-time updates
- `src/types.ts`: Added `LocationUpdateEvent`, `UseLocationUpdatesOptions`, `UseLocationUpdatesResult`
- `src/hooks/index.ts`: Exported new hook and types
- `src/index.tsx`: Exported new hook and types
- `example/src/App.tsx`: Enhanced with toggle demonstration

**Architecture:**

- Event-driven updates (no polling required)
- Non-blocking event emission
- Automatic subscription/unsubscription
- Memory efficient with minimal overhead
- Compatible with existing imperative API

### Migration Guide

If upgrading from 0.2.0:

**No Breaking Changes** - All existing APIs remain fully supported.

**New Feature - Real-time Updates:**

```typescript
// Option 1: Manual refresh (existing)
import { useBackgroundLocation } from '@gabriel-sisjr/react-native-background-location';
const { locations, refreshLocations } = useBackgroundLocation();
// ... call refreshLocations() periodically

// Option 2: Automatic updates (NEW)
import { useLocationUpdates } from '@gabriel-sisjr/react-native-background-location';
const { locations } = useLocationUpdates();
// ... locations update automatically in real-time

// Option 3: Combine both (recommended)
const control = useBackgroundLocation(); // For start/stop
const updates = useLocationUpdates(); // For real-time data
```

### Requirements

- React Native 0.70 or higher
- Android API 21+ (Android 5.0 Lollipop)
- Google Play Services Location 21.3.0

### Known Limitations

- iOS event emitters not yet implemented (iOS support planned)
- Events only processed when app is in foreground
- Real-time updates currently Android-only

## [0.2.0] - 2025-10-26

### Added

- ⚛️ **React Hooks API**: Production-ready hooks for easier integration and better DX
  - `useBackgroundLocation`: Full-featured hook for managing background location tracking with auto-start, callbacks, and comprehensive error handling
  - `useLocationTracking`: Lightweight hook for monitoring tracking status with real-time updates
  - `useLocationPermissions`: Complete permission management hook for Android (including Android 10+ background location permissions)
  - Full TypeScript support with detailed type definitions
  - Automatic cleanup on unmount
  - React best practices with proper dependency management

- 🤖 **Automated CI/CD Pipeline**: Complete GitHub Actions workflow automation
  - **CI Workflow**: Validates code quality on every PR (lint, typecheck, unit tests, Android/iOS builds)
  - **Publish Workflow**: Automated production releases from `main` branch to npm
  - **Pre-release Workflow**: Automated beta releases from `develop` branch (tagged as `@beta`)
  - Semantic versioning support with automatic version detection
  - Supply chain security with npm provenance
  - Automated GitHub Releases with generated release notes
  - Branch protection and required status checks

- 🧪 **Comprehensive Test Suite**: Achieved 98.91% code coverage
  - 62 tests for `useBackgroundLocation` hook covering all scenarios
  - 25 tests for `useLocationTracking` hook with edge cases
  - 9 tests for `useLocationPermissions` hook
  - Integration tests for main module exports
  - Total: 96 passing tests across 4 test suites
  - Platform-specific behavior tests (Android/iOS)

- 📚 **Enhanced Documentation**:
  - Complete React Hooks guide in `docs/getting-started/hooks.md`
  - Comprehensive CI/CD guide in `docs/development/CICD.md`
  - Testing guide in `docs/development/TESTING.md`
  - Updated documentation structure with clear navigation
  - Consolidated documentation following project conventions

### Changed

- 📦 **Version Bump**: Updated to 0.2.0 following semantic versioning (minor release for new features)
- 🔧 **Test Infrastructure**:
  - Fixed TypeScript errors with `Platform.Version` mocks using `Object.defineProperty`
  - Improved test setup with minimal mocks for better reliability
  - Enhanced error handling tests for all hooks
- 📝 **Documentation Structure**: Reorganized CI/CD docs into `docs/development/` for consistency
- 🌍 **Documentation Language**: Consolidated to English-only for multilingual team

### Fixed

- 🐛 TypeScript read-only property errors in test files
- 🐛 ESLint warnings in test configurations
- 🐛 Test coverage configuration for proper threshold handling

### Migration Guide

If upgrading from 0.1.0:

**No Breaking Changes** - All existing imperative APIs remain unchanged and fully supported.

**New Recommended Approach** - Use hooks for new code:

```typescript
// Old (still works)
import BackgroundLocation from '@gabriel-sisjr/react-native-background-location';
await BackgroundLocation.startTracking('trip-123');

// New (recommended)
import { useBackgroundLocation } from '@gabriel-sisjr/react-native-background-location';
const { startTracking } = useBackgroundLocation({
  onLocationUpdate: (location) => console.log(location),
});
```

### Branch Strategy

Starting with 0.2.0, the project follows a two-branch strategy:

- **`main`**: Production-ready releases (stable versions)
- **`develop`**: Latest development code (beta releases available via `npm install @gabriel-sisjr/react-native-background-location@beta`)

## [0.1.0] - 2025-10-26

### Added

- ✨ Initial release of @gabriel-sisjr/react-native-background-location
- 🚀 Background location tracking using TurboModules (New Architecture)
- 📱 Full Android support with Kotlin implementation
- 🔐 Session-based tracking with trip IDs
- 💾 Persistent location storage using SharedPreferences
- 🔔 Foreground service with notification for reliable background tracking
- 📍 High-accuracy location updates (configurable intervals)
- 🎯 Complete TypeScript API with full type definitions
- 📚 Comprehensive documentation and usage examples
- 🧪 Functional example app demonstrating all features
- 🛡️ Permission checking and error handling
- 🔄 Idempotent API operations

### API Methods

- `startTracking(tripId?: string): Promise<string>` - Start location tracking
- `stopTracking(): Promise<void>` - Stop location tracking
- `isTracking(): Promise<TrackingStatus>` - Check tracking status
- `getLocations(tripId: string): Promise<Coords[]>` - Retrieve locations
- `clearTrip(tripId: string): Promise<void>` - Clear trip data

### Features

- **Background Tracking**: Continues collecting location when app is minimized
- **Foreground Service**: Uses Android foreground service for reliability
- **Auto Trip ID**: Generates UUID if trip ID not provided
- **Persistent Storage**: Locations survive app restarts
- **Permission Management**: Checks for all required permissions
- **Graceful Fallbacks**: Safe behavior when native module unavailable
- **TypeScript First**: Full type safety and IntelliSense support

### Requirements

- React Native 0.70 or higher
- Android API 21+ (Android 5.0 Lollipop)
- Google Play Services Location 21.3.0

### Known Limitations

- iOS support not yet implemented (Android only)
- Location update intervals are not yet configurable
- No event emitters for real-time location updates
- Storage limited to SharedPreferences (consider SQLite for large datasets)
