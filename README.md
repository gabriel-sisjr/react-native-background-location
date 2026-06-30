# react-native-background-location

Background GPS tracking and geofencing for React Native, built on the New Architecture.

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

A TurboModule for the React Native New Architecture. Drives a foreground service on Android and `CLLocationManager` on iOS, persists every fix to Room and Core Data, and ships native geofencing plus crash recovery so trips survive process death.

**[Read the full documentation](https://gabriel-sisjr.github.io/react-native-background-location/)**

## Features

- Background tracking with configurable accuracy and distance filter
- Native geofencing (GeofencingClient on Android, CLCircularRegion on iOS)
- Persistent location storage (Room on Android, Core Data on iOS)
- Crash recovery via WorkManager and significant location monitoring
- **Battery-efficient Activity Recognition** — pauses GPS when device is `STILL`, resumes on motion (Android: Play Services `ActivityRecognitionClient`; iOS: `CoreMotion CMMotionActivityManager`)
- React hooks: `useBackgroundLocation`, `useLocationPermissions`, `useLocationUpdates`, `useLocationTracking`
- Expo config plugin for managed workflows

## Requirements

| Requirement    | Version                            |
| -------------- | ---------------------------------- |
| React Native   | >=0.73 (New Architecture required) |
| iOS            | >=16.0                             |
| Android minSdk | 24                                 |

## Installation

### Bare React Native (recommended)

```bash
yarn add @gabriel-sisjr/react-native-background-location
cd ios && pod install
```

Autolinking handles Android manifest merging and iOS pod registration. Bare iOS apps must still add `NSLocationWhenInUseUsageDescription`, `NSLocationAlwaysAndWhenInUseUsageDescription`, `NSLocationAlwaysUsageDescription`, and a `UIBackgroundModes` entry containing `location` to their `Info.plist`. See the [iOS setup guide](https://gabriel-sisjr.github.io/react-native-background-location/docs/getting-started/ios-setup) for full details.

> **Activity Recognition on iOS:** If you enable `activityTrackingEnabled: true`, you must also add `NSMotionUsageDescription` to your `Info.plist`. Without it, activity tracking will gracefully fall back to standard GPS (no battery optimization) instead of crashing.
>
> ```xml
> <key>NSMotionUsageDescription</key>
> <string>This app requires motion data to optimize location tracking battery usage.</string>
> ```

> **Activity Recognition on Android:** `ACTIVITY_RECOGNITION` permission is automatically merged into your app's manifest by this library. On Android 10+ (API 29), you must request it at runtime before enabling activity tracking.

## Quick Start

```tsx
import {
  startTracking,
  useLocationUpdates,
} from '@gabriel-sisjr/react-native-background-location';

function App() {
  const { locations } = useLocationUpdates();

  return (
    <Button
      title="Start"
      onPress={() =>
        startTracking('my-trip', {
          distanceFilter: 10,
        })
      }
    />
  );
}
```

See the documentation site for the full hook reference and the permission flow that must run before tracking starts.

## Documentation

- [Getting Started](https://gabriel-sisjr.github.io/react-native-background-location/docs/getting-started/installation)
- [API Reference](https://gabriel-sisjr.github.io/react-native-background-location/docs/api-reference/functions)
- [Hooks](https://gabriel-sisjr.github.io/react-native-background-location/docs/api-reference/hooks/useBackgroundLocation)
- [Geofencing Guide](https://gabriel-sisjr.github.io/react-native-background-location/docs/guides/geofencing)
- [Expo Config Plugin](https://gabriel-sisjr.github.io/react-native-background-location/docs/guides/expo-config-plugin)
- [Troubleshooting](https://gabriel-sisjr.github.io/react-native-background-location/docs/troubleshooting)

## License

MIT — see [LICENSE](./LICENSE).
