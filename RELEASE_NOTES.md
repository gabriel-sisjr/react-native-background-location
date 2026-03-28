# Release Notes

## v0.11.0 - Geofence Notification Configuration

**Major Additions:**

This release introduces full notification configuration for geofence transitions, including per-geofence overrides, template variables, per-transition customization, and iOS notification support via `UNUserNotificationCenter`.

**🔔 Global Notification Configuration:**

- New `configureGeofenceNotifications(options)` API for global notification settings
- New `getGeofenceNotificationConfig()` to retrieve current configuration
- `NotificationOptions` interface for unified notification configuration
- Template variable support: `{{identifier}}`, `{{transitionType}}`, `{{latitude}}`, `{{longitude}}`, `{{radius}}`, `{{timestamp}}`, `{{metadata.KEY}}`
- `GEOFENCE_TEMPLATE_VARS` constant for autocomplete support

**🎯 Per-Geofence & Per-Transition Overrides:**

- `notificationOptions` field on `GeofenceRegion` for per-geofence notification overrides
- Set to `false` as shorthand for `{ enabled: false }` to suppress notifications for a specific geofence
- `transitionOverrides` field on `NotificationOptions` for per-transition-type customization (ENTER, EXIT, DWELL)
- Resolution chain: per-geofence transition override → per-geofence config → global transition override → global config → built-in defaults
- Mixed batch support: `addGeofences()` accepts geofences with different notification configurations in a single call

**🍎 iOS Geofence Notifications:**

- iOS geofence transition notifications via `UNUserNotificationCenter` (previously iOS showed no notifications)

**⚡ Hook & Rendering Improvements:**

- All hooks (`useGeofencing`, `useGeofenceEvents`, `useLocationUpdates`, `useBackgroundLocation`, `useLocationTracking`, `useLocationPermissions`) now internalize reference stabilization via `useRef` pattern — consumers no longer need `useMemo`/`useCallback` for inline objects and functions
- All hooks return `useMemo`-wrapped objects, preventing unnecessary re-renders
- `useLocationUpdates` 5-second status polling now skips `setState` when values are unchanged
- Metadata serialization fix: `GeofenceRegion.metadata` no longer double-serialized (fixes Android crash and iOS silent drop)

**🗄️ Database Migrations:**

- Android: Room Database migration v5 → v6 — adds `notificationConfig` column to geofence table
- iOS: Core Data model version v3 — adds optional `notificationConfig` attribute

**📱 Example App:**

- Notification presets demo in `GeofencingScreen` with 5 selectable presets (Default, Custom Templates, Per-Transition, Silent, High Priority)
- Live JSON config preview and per-geofence preset badges

**Key Improvements:**

- ✅ **Fully Configurable**: Global, per-geofence, and per-transition notification control
- ✅ **Template Variables**: Dynamic notification content based on geofence data
- ✅ **Cross-Platform**: iOS now shows geofence notifications via UNUserNotificationCenter
- ✅ **Better DX**: Hooks no longer require manual memoization of options/callbacks
- ✅ **Performance**: Reduced unnecessary re-renders across all hooks
- ✅ **Backward Compatible**: All new options are optional with sensible defaults

## v0.10.0 - Full iOS Support

**Major Additions:**

This release delivers complete iOS native implementation, making the library fully cross-platform. All features now work on both Android and iOS.

**🍎 iOS Native Implementation:**

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

**🔐 Cross-Platform Permission Hooks:**

- `useLocationPermissions` now works on both platforms
- iOS uses native `checkLocationPermission()` and `requestLocationPermission()` TurboModule methods
- New `WHEN_IN_USE` permission status for iOS (maps to `hasPermission = true`)
- Android continues using `PermissionsAndroid` API as before

**⚠️ iOS Warning Events:**

- `PERMISSION_REVOKED` — User revoked location permission while tracking
- `PERMISSION_DOWNGRADED` — User downgraded from Always to WhenInUse

**📋 iOS-Specific Behavior:**

- No foreground notification on iOS; the system shows a blue status bar indicator
- Notification-related `TrackingOptions` fields are silently ignored on iOS
- `activityType` in `TrackingOptions` is iOS-only (ignored on Android)
- Crash recovery uses significant location monitoring instead of WorkManager
- Persistence uses Core Data (SQLite) instead of Room Database
- Distance filter uses `CLLocationManager.distanceFilter` property

**Key Improvements:**

- ✅ **Cross-Platform**: Full feature parity between Android and iOS
- ✅ **Crash Recovery**: iOS uses significant location monitoring for automatic recovery
- ✅ **Battery Efficient**: activityType and pausesLocationUpdatesAutomatically for iOS optimization
- ✅ **Permission Aware**: Platform-specific permission flows with unified hook API
- ✅ **Production Ready**: Complete native implementations on both platforms

## v0.9.0 - Configurable Notification Appearance

**Major Additions:**

This release introduces full notification customization for the background location foreground service, delivered in four phases: visual core, dynamic updates, action buttons, and extended customization.

**🎨 Notification Visual Customization (Phase 1):**

- Custom small icon, accent color, and timestamp toggle
- Drawable resource name resolution with system default fallback
- Hex color support for brand-consistent notifications

**🔄 Dynamic Notification Updates (Phase 2):**

- New `updateNotification(title, text)` API method
- In-place content updates while tracking is active
- Transient updates for performance (not persisted to DB)

**🔘 Notification Action Buttons (Phase 3):**

- Up to 3 interactive buttons on the tracking notification
- Full event flow from PendingIntent through to JS callbacks
- New `onNotificationAction` callback in `useLocationUpdates` hook
- JSON serialization workaround for Codegen compatibility

**🖼️ Extended Customization (Phase 4):**

- Large icon support with BitmapFactory drawable decoding
- Subtext below notification content
- Custom notification channel ID

**🎯 Static Notification Defaults:**

- AndroidManifest `<meta-data>` support (same pattern as Firebase) for default icons and colors without runtime code
  - `com.backgroundlocation.default_notification_icon` — default small icon
  - `com.backgroundlocation.default_notification_large_icon` — default large icon
  - `com.backgroundlocation.default_notification_color` — default accent color
- Convention-based drawable resolution (`bg_location_notification_icon` in `res/drawable/`)
- Resolution chain: Runtime → Manifest → Convention → System default
- Applies to all notification contexts including minimal notification (Android 12+ deadline) and crash recovery
- New `NotificationDefaults.kt` utility with cached resolution

**🗄️ Database Migrations:**

- Room Database v1→v4 with three incremental migrations
- All new fields persisted for crash recovery

**Key Improvements:**

- ✅ **Brand Customizable**: Full control over notification appearance
- ✅ **Interactive**: Action buttons for quick user actions without opening the app
- ✅ **Dynamic**: Update notification content in real-time during tracking
- ✅ **Zero-Code Defaults**: Configure notification icons/colors via AndroidManifest without runtime options
- ✅ **Crash Recovery Safe**: All settings persisted and restored after crashes
- ✅ **Backward Compatible**: All new options are optional with sensible defaults

## v0.8.0 - Distance Filter & Callback Throttling

**Major Additions:**

This release introduces distance filtering for location updates and callback throttling for better control over location callbacks.

**📏 Distance Filter:**

- Configure minimum distance between updates
- Reduces battery usage by filtering unnecessary updates
- Works with both FusedLocationProvider and AndroidLocationProvider

**⏱️ Callback Throttling:**

- `onUpdateInterval` sets minimum interval between callback executions (e.g., 30000ms = every ~30 seconds)
- Locations are still collected and stored at `updateInterval` rate
- Callback fires on the first location that arrives after the interval has elapsed
- Ideal for periodic server sync without overwhelming network requests

**🔄 Cleaner API:**

- New startTracking overload for options-only calls
- No more passing undefined for tripId

**Key Improvements:**

- ✅ **Battery Efficient**: Distance filter reduces unnecessary updates
- ✅ **Network Friendly**: Callback throttling prevents server overload
- ✅ **Cleaner Code**: Options-only API reduces boilerplate
- ✅ **Backward Compatible**: All existing code works unchanged

## v0.7.0 - Android 14/15 Compliance & Architecture

**Major Additions:**

This release ensures full compatibility with Android 14 and 15, plus major architectural improvements.

**🤖 Android 14/15 Compliance:**

- Foreground service type declaration for Android 14+
- Timeout handling for Android 15's 6-hour limit
- Task removal handling for app swipe
- Proper service lifecycle management

**🏗️ Provider Abstraction:**

- Extensible location provider system
- Automatic fallback for devices without Play Services
- Location processor interface for filtering

**⚠️ Warning Events:**

- New warning event system
- SERVICE_TIMEOUT, TASK_REMOVED, LOCATION_UNAVAILABLE types
- Hook support for warning callbacks

**Key Improvements:**

- ✅ **Future Proof**: Compatible with latest Android versions
- ✅ **More Reliable**: Better service lifecycle management
- ✅ **Extensible**: Provider abstraction for customization
- ✅ **Informative**: Warning events for debugging

## v0.6.0 - Crash Recovery & Room Database

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

## v0.5.0 - Extended Location Properties

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

## v0.4.0 - Configurable Tracking & Battery Optimization

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

## v0.3.0 - Real-Time Location Updates

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

## v0.2.0 - React Hooks & CI/CD Automation

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

## v0.1.0 - Initial Release

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

[0.11.0]: https://github.com/gabriel-sisjr/react-native-background-location/releases/tag/v0.11.0
[0.10.0]: https://github.com/gabriel-sisjr/react-native-background-location/releases/tag/v0.10.0
[0.9.0]: https://github.com/gabriel-sisjr/react-native-background-location/releases/tag/v0.9.0
[0.8.0]: https://github.com/gabriel-sisjr/react-native-background-location/releases/tag/v0.8.0
[0.7.0]: https://github.com/gabriel-sisjr/react-native-background-location/releases/tag/v0.7.0
[0.6.0]: https://github.com/gabriel-sisjr/react-native-background-location/releases/tag/v0.6.0
[0.5.0]: https://github.com/gabriel-sisjr/react-native-background-location/releases/tag/v0.5.0
[0.4.0]: https://github.com/gabriel-sisjr/react-native-background-location/releases/tag/v0.4.0
[0.3.0]: https://github.com/gabriel-sisjr/react-native-background-location/releases/tag/v0.3.0
[0.2.0]: https://github.com/gabriel-sisjr/react-native-background-location/releases/tag/v0.2.0
[0.1.0]: https://github.com/gabriel-sisjr/react-native-background-location/releases/tag/v0.1.0
