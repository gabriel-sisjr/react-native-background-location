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

## [Unreleased]

### Planned

- iOS implementation with Swift
- Customizable location update intervals
- React hooks (useLocation, useTracking)
- Event emitters for real-time updates
- Geofencing support
- Distance filtering
- SQLite storage option for large datasets
- Configurable notification appearance
- Battery optimization modes

---

## Release Notes

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
- 🚧 React hooks
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

[0.1.0]: https://github.com/gabriel-sisjr/react-native-background-location/releases/tag/v0.1.0

