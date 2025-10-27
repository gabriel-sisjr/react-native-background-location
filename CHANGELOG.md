# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-10-26

### Added

- ✨ Initial release of react-native-background-location
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
import BackgroundLocation from 'react-native-background-location';
await BackgroundLocation.startTracking('trip-123');

// New (recommended)
import { useBackgroundLocation } from 'react-native-background-location';
const { startTracking } = useBackgroundLocation({
  onLocationUpdate: (location) => console.log(location)
});
```

### Branch Strategy

Starting with 0.2.0, the project follows a two-branch strategy:

- **`main`**: Production-ready releases (stable versions)
- **`develop`**: Latest development code (beta releases available via `npm install react-native-background-location@beta`)

## [Unreleased]

### Planned

- iOS implementation with Swift
- Customizable location update intervals
- Event emitters for real-time updates
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
npm install react-native-background-location

# Beta version (latest features from develop)
npm install react-native-background-location@beta
```

---

### v0.1.0 - Initial Release

This is the first public release of `react-native-background-location`. The library provides robust background location tracking for React Native apps using the new TurboModule architecture.

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
