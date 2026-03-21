# @gabriel-sisjr/react-native-background-location

[![NPM Version](https://img.shields.io/npm/v/%40gabriel-sisjr%2Freact-native-background-location)](https://www.npmjs.com/package/@gabriel-sisjr/react-native-background-location)
[![NPM Beta](https://img.shields.io/npm/v/%40gabriel-sisjr%2Freact-native-background-location/beta)](https://www.npmjs.com/package/@gabriel-sisjr/react-native-background-location/v/beta)
[![NPM Downloads](https://img.shields.io/npm/dm/%40gabriel-sisjr%2Freact-native-background-location)](https://www.npmjs.com/package/@gabriel-sisjr/react-native-background-location)
[![NPM Total Downloads](https://img.shields.io/npm/dt/%40gabriel-sisjr%2Freact-native-background-location)](https://www.npmjs.com/package/@gabriel-sisjr/react-native-background-location)
[![CI Tests](https://github.com/gabriel-sisjr/react-native-background-location/actions/workflows/ci.yml/badge.svg)](https://github.com/gabriel-sisjr/react-native-background-location/actions/workflows/ci.yml)
[![Code Coverage](https://codecov.io/gh/gabriel-sisjr/react-native-background-location/branch/develop/graph/badge.svg)](https://codecov.io/gh/gabriel-sisjr/react-native-background-location)
[![Pre-release CI](https://github.com/gabriel-sisjr/react-native-background-location/actions/workflows/prerelease.yml/badge.svg?branch=develop&label=Pre-release)](https://github.com/gabriel-sisjr/react-native-background-location/actions/workflows/prerelease.yml)
[![Release CI](https://github.com/gabriel-sisjr/react-native-background-location/actions/workflows/publish.yml/badge.svg?branch=main&label=Release)](https://github.com/gabriel-sisjr/react-native-background-location/actions/workflows/publish.yml)
[![GitHub Stars](https://img.shields.io/github/stars/gabriel-sisjr/react-native-background-location)](https://github.com/gabriel-sisjr/react-native-background-location/stargazers)
[![License](https://img.shields.io/github/license/gabriel-sisjr/react-native-background-location)](https://github.com/gabriel-sisjr/react-native-background-location/blob/develop/LICENSE)
[![Bundlephobia](https://img.shields.io/bundlephobia/minzip/%40gabriel-sisjr%2Freact-native-background-location?label=size)](https://bundlephobia.com/package/@gabriel-sisjr/react-native-background-location)
![Platform Android](https://img.shields.io/badge/platform-Android-green)
![Platform iOS](https://img.shields.io/badge/platform-iOS-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue)

A cross-platform React Native library for background location tracking built on TurboModules (New Architecture). Tracks user location reliably on both Android and iOS even when the app is minimized, with persistent storage, crash recovery, and platform-native behavior.

![Tracking demo](docs/assets/tracking.gif)

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Hooks](#hooks)
- [API Reference](#api-reference)
- [Types](#types)
- [Enums](#enums)
- [Notification Customization](#notification-customization)
- [Documentation](#documentation)
- [Platform Support](#platform-support)
- [Contributing](#contributing)
- [License](#license)

## Features

- Cross-platform background location tracking (Android and iOS)
- Real-time event-driven location updates on both platforms
- Crash recovery with automatic session restoration (WorkManager on Android, significant location monitoring on iOS)
- Configurable accuracy levels and update intervals for battery efficiency
- Distance filtering and callback throttling
- Session-based tracking organized by trip IDs
- Persistent storage: Room Database (Android) / Core Data (iOS)
- Full notification customization on Android: icons, colors, action buttons, dynamic updates
- Static notification defaults via AndroidManifest or convention drawables (Android)
- Android 14/15 compliance (foreground service type, timeout handling)
- Provider abstraction with Google Play Services primary and fallback provider (Android)
- CLLocationManager with WhenInUse and Always authorization levels (iOS)
- Foreground-only mode (no background permission required)
- Fully typed TypeScript API with unified cross-platform hooks

## Installation

```sh
npm install @gabriel-sisjr/react-native-background-location
# or
yarn add @gabriel-sisjr/react-native-background-location
```

### Android Setup

Add the required permissions to `android/app/src/main/AndroidManifest.xml`:

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
  <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
  <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
  <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
  <uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />
</manifest>
```

> On Android 11+, background location must be requested **separately** from foreground permissions. See the [Quick Start Guide](docs/getting-started/QUICKSTART.md) for the full permission flow and the [Integration Guide](docs/getting-started/INTEGRATION_GUIDE.md) for detailed setup in existing apps.

### iOS Setup

1. Add the following keys to your `Info.plist`:

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>We need your location to track your trips.</string>
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>We need your location in the background to continue tracking your trips.</string>
```

2. Enable the **Location updates** Background Mode in your Xcode project under Signing & Capabilities.

3. Run `pod install` in your `ios/` directory.

> **iOS:** Unlike Android, iOS does not use a foreground notification for background tracking. Instead, the system shows a blue status bar indicator when the app is using location in the background. See the [iOS Setup Guide](docs/getting-started/IOS_SETUP.md) for full details and App Store compliance requirements.

## Quick Start

```typescript
import {
  useLocationPermissions,
  useBackgroundLocation,
  useLocationUpdates,
  LocationAccuracy,
} from '@gabriel-sisjr/react-native-background-location';

function TrackingScreen() {
  const { permissionStatus, requestPermissions } = useLocationPermissions();
  const { startTracking, stopTracking, isTracking } = useBackgroundLocation();
  const { locations, lastLocation } = useLocationUpdates({
    onLocationUpdate: (loc) => console.log('New:', loc.latitude, loc.longitude),
  });

  if (!permissionStatus.hasPermission) {
    return <Button title="Grant Permissions" onPress={requestPermissions} />;
  }

  return (
    <View>
      <Text>Status: {isTracking ? 'Tracking' : 'Stopped'}</Text>
      <Text>Points: {locations.length}</Text>
      {lastLocation && <Text>Last: {lastLocation.latitude}, {lastLocation.longitude}</Text>}
      <Button
        title={isTracking ? 'Stop' : 'Start'}
        onPress={() => isTracking
          ? stopTracking()
          : startTracking(undefined, { accuracy: LocationAccuracy.HIGH_ACCURACY })
        }
      />
    </View>
  );
}
```

For step-by-step setup, see the [Quick Start Guide](docs/getting-started/QUICKSTART.md). For the direct (non-hook) API, see [Using Direct API](#api-reference).

## Hooks

| Hook                                                                             | Purpose                                                                                                         |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| [`useLocationPermissions`](docs/getting-started/hooks.md#uselocationpermissions) | Manages cross-platform permission flow (Android: foreground, background, notifications; iOS: WhenInUse, Always) |
| [`useBackgroundLocation`](docs/getting-started/hooks.md#usebackgroundlocation)   | Full tracking control: start, stop, locations, trip management                                                  |
| [`useLocationTracking`](docs/getting-started/hooks.md#uselocationtracking)       | Lightweight tracking status monitor (read-only)                                                                 |
| [`useLocationUpdates`](docs/getting-started/hooks.md#uselocationupdates)         | Real-time event-driven location stream with warnings and action callbacks                                       |

See the [Hooks Guide](docs/getting-started/hooks.md) for complete documentation, options, and examples.

## API Reference

### Methods

| Method               | Signature                                                         | Description                                          |
| -------------------- | ----------------------------------------------------------------- | ---------------------------------------------------- |
| `startTracking`      | `(options?: TrackingOptions) => Promise<string>`                  | Start tracking (auto-generates trip ID)              |
| `startTracking`      | `(tripId?: string, options?: TrackingOptions) => Promise<string>` | Start or resume tracking with a specific trip ID     |
| `stopTracking`       | `() => Promise<void>`                                             | Stop tracking and terminate the background service   |
| `isTracking`         | `() => Promise<TrackingStatus>`                                   | Check if tracking is active                          |
| `getLocations`       | `(tripId: string) => Promise<Coords[]>`                           | Retrieve all stored locations for a trip             |
| `clearTrip`          | `(tripId: string) => Promise<void>`                               | Delete all stored data for a trip                    |
| `updateNotification` | `(title: string, text: string) => Promise<void>`                  | Update notification content while tracking is active |

### TrackingOptions

All fields are optional. Defaults are applied when omitted.

| Field                       | Type                   | Default                                  | Description                                                                     |
| --------------------------- | ---------------------- | ---------------------------------------- | ------------------------------------------------------------------------------- |
| `updateInterval`            | `number`               | `5000`                                   | Interval between location updates (ms)                                          |
| `fastestInterval`           | `number`               | `3000`                                   | Fastest allowed update interval (ms)                                            |
| `maxWaitTime`               | `number`               | `10000`                                  | Max wait before delivering batched updates (ms)                                 |
| `accuracy`                  | `LocationAccuracy`     | `HIGH_ACCURACY`                          | Location accuracy priority                                                      |
| `waitForAccurateLocation`   | `boolean`              | `false`                                  | Delay updates until accurate location is available                              |
| `distanceFilter`            | `number`               | `0`                                      | Minimum distance (meters) between updates. `0` = no filter                      |
| `foregroundOnly`            | `boolean`              | `false`                                  | Track only while app is visible (no background permission needed)               |
| `onUpdateInterval`          | `number`               | `undefined`                              | Throttle callback execution (ms). Locations still collected at `updateInterval` |
| `notificationTitle`         | `string`               | `"Location Tracking"`                    | Notification title                                                              |
| `notificationText`          | `string`               | `"Tracking your location in background"` | Notification body text                                                          |
| `notificationChannelName`   | `string`               | `"Background Location"`                  | Android notification channel name                                               |
| `notificationPriority`      | `NotificationPriority` | `LOW`                                    | Notification priority                                                           |
| `notificationSmallIcon`     | `string`               | system default                           | Drawable resource name for small icon                                           |
| `notificationColor`         | `string`               | `undefined`                              | Hex color for notification accent (e.g. `"#FF5722"`)                            |
| `notificationShowTimestamp` | `boolean`              | `false`                                  | Show timestamp on notification                                                  |
| `notificationLargeIcon`     | `string`               | `undefined`                              | Drawable resource name for large icon                                           |
| `notificationSubtext`       | `string`               | `undefined`                              | Subtext below notification content                                              |
| `notificationChannelId`     | `string`               | `"background_location_channel"`          | Custom notification channel ID                                                  |
| `notificationActions`       | `NotificationAction[]` | `undefined`                              | Up to 3 action buttons on the notification                                      |

## Types

### Coords

```typescript
interface Coords {
  latitude: string;
  longitude: string;
  timestamp: number;
  accuracy?: number;
  altitude?: number;
  speed?: number;
  bearing?: number;
  verticalAccuracyMeters?: number;
  speedAccuracyMetersPerSecond?: number;
  bearingAccuracyDegrees?: number;
  elapsedRealtimeNanos?: number;
  provider?: string;
  isFromMockProvider?: boolean;
}
```

> **Note:** `latitude` and `longitude` are strings to preserve full decimal precision. Parse with `parseFloat()` when using with map libraries.

### TrackingStatus

```typescript
interface TrackingStatus {
  active: boolean;
  tripId?: string;
}
```

### LocationUpdateEvent

```typescript
interface LocationUpdateEvent {
  tripId: string;
  latitude: string;
  longitude: string;
  timestamp: number;
  accuracy?: number;
  altitude?: number;
  speed?: number;
  bearing?: number;
  verticalAccuracyMeters?: number;
  speedAccuracyMetersPerSecond?: number;
  bearingAccuracyDegrees?: number;
  elapsedRealtimeNanos?: number;
  provider?: string;
  isFromMockProvider?: boolean;
}
```

### LocationWarningEvent and LocationWarningType

```typescript
type LocationWarningType =
  | 'SERVICE_TIMEOUT'
  | 'TASK_REMOVED'
  | 'LOCATION_UNAVAILABLE';

interface LocationWarningEvent {
  tripId: string;
  type: LocationWarningType;
  message: string;
  timestamp: number;
}
```

### NotificationAction and NotificationActionEvent

```typescript
interface NotificationAction {
  id: string;
  label: string;
}

interface NotificationActionEvent {
  tripId: string;
  actionId: string;
}
```

### PermissionState

```typescript
interface PermissionState {
  hasPermission: boolean;
  status: LocationPermissionStatus;
  canRequestAgain: boolean;
}
```

### UseLocationPermissionsResult

```typescript
interface UseLocationPermissionsResult {
  permissionStatus: PermissionState;
  requestPermissions: () => Promise<boolean>;
  checkPermissions: () => Promise<boolean>;
  isRequesting: boolean;
}
```

### UseBackgroundLocationResult

```typescript
interface UseBackgroundLocationResult {
  tripId: string | null;
  isTracking: boolean;
  locations: Coords[];
  isLoading: boolean;
  error: Error | null;
  startTracking: (
    customTripId?: string,
    options?: TrackingOptions
  ) => Promise<string | null>;
  stopTracking: () => Promise<void>;
  refreshLocations: () => Promise<void>;
  clearCurrentTrip: () => Promise<void>;
  clearError: () => void;
}
```

### UseLocationTrackingOptions

```typescript
interface UseLocationTrackingOptions {
  autoStart?: boolean;
  tripId?: string;
  options?: TrackingOptions;
  onTrackingStart?: (tripId: string) => void;
  onTrackingStop?: () => void;
  onError?: (error: Error) => void;
}
```

### UseLocationTrackingResult

```typescript
interface UseLocationTrackingResult {
  isTracking: boolean;
  tripId: string | null;
  refresh: () => Promise<void>;
  isLoading: boolean;
}
```

### UseLocationUpdatesOptions

```typescript
interface UseLocationUpdatesOptions {
  tripId?: string;
  onLocationUpdate?: (location: Coords) => void;
  onUpdateInterval?: number;
  onLocationWarning?: (warning: LocationWarningEvent) => void;
  onNotificationAction?: (event: NotificationActionEvent) => void;
  autoLoad?: boolean;
}
```

### UseLocationUpdatesResult

```typescript
interface UseLocationUpdatesResult {
  tripId: string | null;
  isTracking: boolean;
  locations: Coords[];
  lastLocation: Coords | null;
  lastWarning: LocationWarningEvent | null;
  isLoading: boolean;
  error: Error | null;
  clearError: () => void;
  clearLocations: () => Promise<void>;
}
```

## Enums

### LocationAccuracy

| Value                     | Description                                           |
| ------------------------- | ----------------------------------------------------- |
| `HIGH_ACCURACY`           | GPS + sensors. Best accuracy, highest battery usage.  |
| `BALANCED_POWER_ACCURACY` | Balanced accuracy and power consumption.              |
| `LOW_POWER`               | Network-based. Lower accuracy, better battery.        |
| `NO_POWER`                | Only receives updates requested by other apps.        |
| `PASSIVE`                 | Passive updates from other apps. No additional power. |

### NotificationPriority

| Value     | Description                     |
| --------- | ------------------------------- |
| `LOW`     | Minimal notification (default). |
| `DEFAULT` | Default system priority.        |
| `HIGH`    | More prominent notification.    |
| `MAX`     | Urgent notification.            |

### LocationPermissionStatus

| Value          | Description                                                                      |
| -------------- | -------------------------------------------------------------------------------- |
| `GRANTED`      | All required permissions granted (full background access).                       |
| `WHEN_IN_USE`  | iOS only: WhenInUse permission granted. Tracking works but may have limitations. |
| `DENIED`       | Permission denied (can request again).                                           |
| `BLOCKED`      | Permission permanently denied (must open settings).                              |
| `UNDETERMINED` | Permission not yet requested.                                                    |

## Notification Customization

The foreground service notification supports full visual customization through `TrackingOptions` fields (see [TrackingOptions](#trackingoptions) table above).

**Static defaults** can be configured without runtime code using AndroidManifest metadata or convention-named drawables:

```xml
<!-- AndroidManifest.xml -->
<meta-data android:name="com.backgroundlocation.default_notification_icon"
           android:resource="@drawable/ic_notification" />
<meta-data android:name="com.backgroundlocation.default_notification_color"
           android:resource="@color/notification_accent" />
```

Alternatively, place a drawable named `bg_location_notification_icon` in `res/drawable/` for automatic detection.

**Resolution priority:** Runtime options > AndroidManifest metadata > Convention drawable > System default.

**Dynamic updates** allow changing notification text while tracking is active:

```typescript
await BackgroundLocation.updateNotification(
  'Delivery #1234',
  'Arriving in 5 minutes'
);
```

**Action buttons** (max 3) can be added via `notificationActions` and handled through the `onNotificationAction` callback in `useLocationUpdates`.

## Documentation

### Getting Started

- [Quick Start Guide](docs/getting-started/QUICKSTART.md) -- Get running in 5 minutes
- [Integration Guide](docs/getting-started/INTEGRATION_GUIDE.md) -- Detailed setup for existing apps
- [iOS Setup Guide](docs/getting-started/IOS_SETUP.md) -- iOS-specific configuration and requirements
- [Hooks Guide](docs/getting-started/hooks.md) -- Complete hooks documentation
- [Real-Time Updates](docs/getting-started/REAL_TIME_UPDATES.md) -- Event-driven location watching

### Production

- [Google Play Compliance](docs/production/GOOGLE_PLAY_COMPLIANCE.md) -- Required steps for Play Store approval
- [App Store Compliance](docs/production/APP_STORE_COMPLIANCE.md) -- Required steps for App Store approval (iOS)
- [Battery Optimization](docs/production/BATTERY_OPTIMIZATION.md) -- Platform-specific battery management
- [Crash Recovery](docs/production/CRASH_RECOVERY.md) -- Session persistence and recovery strategies
- [Platform Comparison](docs/production/PLATFORM_COMPARISON.md) -- Android vs iOS behavior differences

### Development

- [Testing Guide](docs/development/TESTING.md) -- Test structure and guidelines
- [CI/CD Guide](docs/development/CICD.md) -- Automated pipelines
- [Publishing Guide](docs/development/PUBLISHING.md) -- How to publish to npm
- [Realtime Debug Guide](docs/development/REALTIME_DEBUG_GUIDE.md) -- Debugging location updates
- [Implementation Summary](docs/development/IMPLEMENTATION_SUMMARY.md) -- Technical architecture overview

## Platform Support

| Platform | Status    | Notes                                                               |
| -------- | --------- | ------------------------------------------------------------------- |
| Android  | Supported | Kotlin native implementation. Min SDK 24, target SDK 34.            |
| iOS      | Supported | Swift native implementation. CLLocationManager, Core Data, iOS 13+. |

> **iOS:** Background tracking on iOS uses the system blue status bar indicator instead of a notification. Notification-related `TrackingOptions` (title, text, icon, color, actions, etc.) are Android-only and are silently ignored on iOS. See [Platform Comparison](docs/production/PLATFORM_COMPARISON.md) for detailed differences.

## Contributing

Contributions are welcome. See the [Contributing Guide](CONTRIBUTING.md) for development workflow, coding standards, and how to submit pull requests.

## License

MIT
