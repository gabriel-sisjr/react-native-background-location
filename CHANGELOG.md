# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

### Developer Experience

This release significantly improves the developer experience with:

- **Easier Integration**: React Hooks provide a more intuitive API than imperative methods
- **Better Debugging**: Comprehensive error messages and warnings
- **Faster Development**: Automated CI/CD reduces manual release overhead
- **Higher Confidence**: 98.91% test coverage ensures reliability
- **Type Safety**: Enhanced TypeScript definitions for hooks

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

### API Additions

**New Hook**: `useLocationUpdates`
```typescript
const {
  locations,        // Real-time array of all locations
  lastLocation,     // Most recent location received
  isTracking,       // Tracking status
  tripId,          // Current trip ID
  isLoading,       // Loading state
  error,           // Error state
  clearError       // Clear error function
} = useLocationUpdates({
  tripId?: string,                    // Filter by tripId
  onLocationUpdate?: (location) => void,  // Callback per location
  autoLoad?: boolean                  // Load existing locations
});
```

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

## [Unreleased]

### Planned

- iOS implementation with Swift
- iOS event emitter support
- Customizable location update intervals
- Geofencing support
- Distance filtering
- SQLite storage option for large datasets
- Configurable notification appearance
- Battery optimization modes

---

## Release Notes

### v0.2.0 - React Hooks & CI/CD Automation

**Major Additions:**

This release introduces React Hooks for easier integration and a complete CI/CD pipeline for automated releases.

**🎣 React Hooks API:**
- `useBackgroundLocation`: Complete hook for location tracking with auto-start, callbacks, and error handling
- `useLocationTracking`: Lightweight hook for monitoring tracking status
- `useLocationPermissions`: Full permission management for Android (including Android 10+ background permissions)

**🤖 Automated CI/CD:**
- Automated testing on every PR (lint, tests, builds)
- Automatic beta releases from `develop` branch (npm `@beta` tag)
- Automatic production releases from `main` branch (npm `latest` tag)
- Semantic versioning with automatic version detection
- GitHub Actions workflows for complete automation

**🧪 Test Coverage:**
- 98.91% overall code coverage
- 96 comprehensive tests covering all hooks and core functionality
- Extensive edge case and error handling tests
- Platform-specific behavior tests (Android/iOS)

**📚 Developer Experience:**
- Complete hooks documentation with examples
- Comprehensive CI/CD setup guide
- Better error messages and warnings
- TypeScript improvements for better type safety
- Consolidated documentation structure

**Key Improvements:**

- ✅ **Easier to Use**: Hooks provide cleaner, more intuitive API
- ✅ **More Reliable**: High test coverage ensures stability
- ✅ **Faster Releases**: Automated CI/CD reduces release time from 30-60min to 5-7min
- ✅ **Better DX**: Enhanced documentation and TypeScript support

**Installation:**

```bash
# Production version (stable)
npm install @gabriel-sisjr/react-native-background-location

# Beta version (latest features from develop)
npm install @gabriel-sisjr/react-native-background-location@beta
```

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

**Migration from Other Libraries:**

If you're migrating from other location tracking libraries:

1. The API is promise-based (no callbacks)
2. Location coordinates are returned as strings (not numbers)
3. Trip/session management is built-in
4. Requires TurboModules enabled (New Architecture)

**Feedback Welcome:**

This is an early release. Please report any issues, suggestions, or feature requests on GitHub.

---

[0.2.0]: https://github.com/gabriel-sisjr/react-native-background-location/releases/tag/v0.2.0
[0.1.0]: https://github.com/gabriel-sisjr/react-native-background-location/releases/tag/v0.1.0
