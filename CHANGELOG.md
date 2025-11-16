# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned

- iOS implementation with Swift
- iOS crash recovery support
- Geofencing support
- Distance filtering
- Configurable notification appearance
- Automatic data retention policies
- Background sync with remote server

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
  accuracy: LocationAccuracy.HIGH_ACCURACY
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
  onLocationUpdate: (location) => console.log(location)
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

---

## Release Notes

### v0.6.0 - Crash Recovery & Room Database

**Major Additions:**

This release introduces automatic crash recovery and a new persistence layer with Room Database for better performance and scalability.

**🔄 Crash Recovery:**
- Automatic tracking session recovery after app crash or restart
- Persistent storage of TrackingOptions for complete state restoration
- Service auto-recovery using START_STICKY
- Graceful handling of permission revocations
- Best-effort recovery with automatic cleanup of corrupted state

**🗄️ Room Database:**
- Room Database 2.6.1 with KSP for all data persistence
- SQLite backend for locations and tracking state
- Better performance with large datasets
- Thread-safe coroutine-based operations
- Indexed queries for fast data retrieval
- Zero JSON parsing overhead

**📚 Documentation:**
- Complete crash recovery architecture guide
- Manual testing guide with 8 detailed scenarios
- Technical implementation documentation
- Performance metrics and best practices

**Key Improvements:**

- ✅ **More Reliable**: Automatic recovery ensures tracking continues after crashes
- ✅ **Better Performance**: Room Database scales better with large datasets
- ✅ **Thread-Safe**: Coroutines ensure safe concurrent operations
- ✅ **Data Persistence**: Locations and state survive app restarts
- ✅ **Production Ready**: Comprehensive testing and documentation

---

### v0.5.0 - Extended Location Properties

**Major Additions:**

This release adds comprehensive support for all location data available from Google Play Services Location API.

**📍 Extended Properties:**
- Full support for 10+ location properties (accuracy, altitude, speed, bearing, etc.)
- API-level specific properties (Android 18+, 26+)
- Type-safe access with TypeScript
- Backward compatible - all new fields are optional

**Key Improvements:**

- ✅ **More Data**: Access to comprehensive location information
- ✅ **Type-Safe**: Full TypeScript definitions for all properties
- ✅ **Future-Proof**: Generic property extraction for extensibility
- ✅ **Backward Compatible**: Existing code continues to work

---

### v0.4.0 - Configurable Tracking & Battery Optimization

**Major Additions:**

This release introduces comprehensive tracking configuration options and built-in battery optimization features.

**⚙️ Configurable Tracking:**
- TrackingOptions interface for full customization
- Location accuracy levels (HIGH_ACCURACY, BALANCED_POWER_ACCURACY, LOW_POWER)
- Adjustable update intervals
- Notification customization
- Configuration presets (High Accuracy, Balanced, Low Power)

**🔋 Battery Optimization:**
- Configurable accuracy levels for reduced battery consumption
- Adjustable update intervals to minimize location requests
- Smart location updates and efficient foreground service
- Best practices documentation

**Key Improvements:**

- ✅ **Flexible**: Full control over tracking behavior
- ✅ **Battery Efficient**: Built-in optimization options
- ✅ **User-Friendly**: Predefined configuration presets
- ✅ **Type-Safe**: Enums for accuracy and priority levels

---

### v0.3.0 - Real-Time Location Updates

**Major Additions:**

This release introduces real-time location updates with event-driven architecture.

**🎯 Real-Time Updates:**
- New useLocationUpdates hook for automatic location watching
- Event-driven location updates via native events
- Automatic subscription/unsubscription management
- Live location visualization

**Key Improvements:**

- ✅ **Real-Time**: Automatic updates without polling
- ✅ **Efficient**: Event-driven architecture with minimal overhead
- ✅ **Easy to Use**: Hook-based API with automatic cleanup
- ✅ **Flexible**: Manual or automatic update modes

---

### v0.2.0 - React Hooks & CI/CD Automation

**Major Additions:**

This release introduces React Hooks for easier integration and a complete CI/CD pipeline for automated releases.

**🎣 React Hooks API:**
- `useBackgroundLocation`: Complete hook for location tracking
- `useLocationTracking`: Lightweight hook for monitoring tracking status
- `useLocationPermissions`: Full permission management for Android

**🤖 Automated CI/CD:**
- Automated testing on every PR (lint, tests, builds)
- Automatic beta releases from `develop` branch
- Automatic production releases from `main` branch
- Semantic versioning with automatic version detection

**🧪 Test Coverage:**
- 98.91% overall code coverage
- 96 comprehensive tests covering all hooks and core functionality

**Key Improvements:**

- ✅ **Easier to Use**: Hooks provide cleaner, more intuitive API
- ✅ **More Reliable**: High test coverage ensures stability
- ✅ **Faster Releases**: Automated CI/CD reduces release time
- ✅ **Better DX**: Enhanced documentation and TypeScript support

---

### v0.1.0 - Initial Release

This is the first public release of `@gabriel-sisjr/react-native-background-location`. The library provides robust background location tracking for React Native apps using the new TurboModule architecture.

**What's Working:**
- ✅ Full Android implementation
- ✅ Background and foreground tracking
- ✅ Persistent storage
- ✅ Complete TypeScript support
- ✅ Production-ready

**What's Next:**
- 🚧 iOS implementation
- 🚧 Event emitters
- 🚧 Advanced configuration options

---

[0.6.0]: https://github.com/gabriel-sisjr/react-native-background-location/releases/tag/v0.6.0
[0.5.0]: https://github.com/gabriel-sisjr/react-native-background-location/releases/tag/v0.5.0
[0.4.0]: https://github.com/gabriel-sisjr/react-native-background-location/releases/tag/v0.4.0
[0.3.0]: https://github.com/gabriel-sisjr/react-native-background-location/releases/tag/v0.3.0
[0.2.0]: https://github.com/gabriel-sisjr/react-native-background-location/releases/tag/v0.2.0
[0.1.0]: https://github.com/gabriel-sisjr/react-native-background-location/releases/tag/v0.1.0
