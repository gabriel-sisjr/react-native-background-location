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
- Opt-in motion activity (off by default): activity events (stationary, walking, running, cycling, automotive) and an optional reduction of location updates while the device is stationary
- React hooks: `useBackgroundLocation`, `useLocationPermissions`, `useLocationUpdates`, `useLocationTracking`, `useMotionActivity`
- Expo config plugin (SDK 54+) that configures permissions, usage strings, background modes and the iOS 16 deployment target on `expo prebuild`

## Requirements

| Requirement     | Version                                                     |
| --------------- | ----------------------------------------------------------- |
| React Native    | >=0.73 (New Architecture required)                          |
| iOS             | >=16.0                                                      |
| Android minSdk  | 24                                                          |
| Expo (optional) | SDK 54+ with a development build (Expo Go is not supported) |

## Installation

### Bare React Native

```bash
yarn add @gabriel-sisjr/react-native-background-location
cd ios && pod install
```

Autolinking registers the library with Gradle and CocoaPods, and Gradle's manifest merger merges the library's manifest into your app manifest. Bare iOS apps must still add `NSLocationWhenInUseUsageDescription`, `NSLocationAlwaysAndWhenInUseUsageDescription`, `NSLocationAlwaysUsageDescription`, and a `UIBackgroundModes` entry containing `location` to their `Info.plist`. See the [iOS setup guide](https://gabriel-sisjr.github.io/react-native-background-location/docs/getting-started/ios-setup) for full details.

### Expo

Requires version 1.1.0 or later of this package (the first release that ships the config plugin), Expo SDK 54 or later and a [development build](https://docs.expo.dev/develop/development-builds/introduction/) (Expo Go is not supported).

```bash
npx expo install @gabriel-sisjr/react-native-background-location
```

Then add the plugin to your `app.json`:

```json
{
  "expo": {
    "plugins": ["@gabriel-sisjr/react-native-background-location"]
  }
}
```

```bash
npx expo prebuild --clean
```

The plugin injects the Android permissions, the iOS `Info.plist` usage strings and `UIBackgroundModes`, and raises the iOS deployment target to 16.0 when it is lower, so `expo-build-properties` is not needed. It stops the prebuild with a `PluginError` if the New Architecture is explicitly disabled (SDK 54 is the last SDK that allows it). The optional `motionActivity` prop also sets up [motion activity](#motion-activity-optional). See the [Expo config plugin guide](https://gabriel-sisjr.github.io/react-native-background-location/docs/guides/expo-config-plugin) for options and supported SDK versions.

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
      onPress={() => startTracking('trip-1', { distanceFilter: 10 })}
    />
  );
}
```

The trip ID is the first argument; call `startTracking({ distanceFilter: 10 })` to let the library generate one. See the documentation site for the full hook reference and the permission flow that must run before tracking starts.

## Motion Activity (optional)

Off by default. With the `motionActivity` tracking option, a session also reports the device's motion activity and can reduce location updates while the device is stationary. Without it, the library creates no activity recognition client (on Android, except to remove a registration left by an earlier session), makes no CoreMotion call and never asks for the motion permission.

```tsx
import {
  requestMotionPermission,
  startTracking,
  useMotionActivity,
} from '@gabriel-sisjr/react-native-background-location';

async function startTrip() {
  // After the location permissions and your motion disclosure (required by
  // Google Play): startTracking never prompts for this permission
  await requestMotionPermission();
  await startTracking('trip-1', {
    motionActivity: { reduceWhenStationary: true },
  });
}

function MotionStatus() {
  const { lastActivity, reduction } = useMotionActivity({ tripId: 'trip-1' });
  return (
    <Text>
      {lastActivity?.activity ?? 'UNKNOWN'} / {reduction}
    </Text>
  );
}
```

| Option                                    | Default                                       | Range (clamped) | Platform     | Description                                                                                   |
| ----------------------------------------- | --------------------------------------------- | --------------- | ------------ | --------------------------------------------------------------------------------------------- |
| `motionActivity`                          | off                                           | —               | Android, iOS | `true` or an object enables `onMotionActivity` events                                          |
| `motionActivity.sampleInterval`           | `30000` ms                                    | 10 s – 5 min    | Android      | Activity Recognition sampling interval (iOS reports changes as they happen)                   |
| `motionActivity.reduceWhenStationary`     | off                                           | —               | Android, iOS | `true` or an object reduces location updates while stationary (a degrade, never a stop)       |
| `reduceWhenStationary.stationaryDelay`    | `300000` ms                                   | 1 min – 1 h     | Android, iOS | Continuous high-confidence stationary time before reducing                                    |
| `reduceWhenStationary.automotiveCooldown` | `600000` ms                                   | 2 min – 1 h     | Android, iOS | Time without vehicle evidence (and since the session started) before reducing                 |
| `reduceWhenStationary.maxReducedDuration` | `1800000` ms                                  | 5 min – 1 h     | Android, iOS | Longest reduced period before one full-accuracy fix is forced and recorded                    |
| `reduceWhenStationary.notificationText`   | `'Location updates reduced while stationary'` | non-blank       | Android      | Foreground notification text while reduced; set it for apps that are not in English          |

Events arrive through `useMotionActivity` or `addMotionActivityListener` as `{ tripId, activity, confidence, timestamp }`. `checkMotionPermission()`, `requestMotionPermission()` and `getMotionActivityState()` complete the API. Four warnings arrive on `onLocationWarning`:

| Warning                         | Meaning                                                                                                       |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `MOTION_LOCATION_REDUCED`       | The device is stationary; location updates were reduced                                                       |
| `MOTION_LOCATION_RESTORED`      | Full-accuracy updates are back (movement, displacement, detection stopped, or an Android service restart)     |
| `MOTION_ACTIVITY_UNAVAILABLE`   | Detection cannot run (no Google Play services, CoreMotion not compiled in, no usage string, no hardware)      |
| `MOTION_PERMISSION_NOT_GRANTED` | The motion permission is missing or was revoked                                                               |

In every failure case `startTracking` still resolves and tracking continues at full accuracy. The reduction trades fixes for battery while the device is parked: read the [risk profile](https://gabriel-sisjr.github.io/react-native-background-location/docs/guides/motion-activity#risk-profile) before enabling it. The defaults are the recommended settings for fleets.

### Setup

**Android.** The library declares no activity recognition permission. Add both to your app's `AndroidManifest.xml` (the first is a runtime permission on Android 10+, the second is granted at install time on Android 9 and earlier), and keep Google Play services available on the device:

```xml
<uses-permission android:name="android.permission.ACTIVITY_RECOGNITION" />
<uses-permission
    android:name="com.google.android.gms.permission.ACTIVITY_RECOGNITION"
    android:maxSdkVersion="28" />
```

**Google Play.** `ACTIVITY_RECOGNITION` is health-related sensitive data for Google Play. Show a prominent in-app disclosure (what is detected, why, and whether it leaves the device) and call `requestMotionPermission()` only after the user accepts it, complete the Health apps declaration in Play Console, and declare motion-derived data that leaves the device in the Data safety form under Health and fitness > Fitness info. See the [Google Play compliance guide](https://gabriel-sisjr.github.io/react-native-background-location/docs/production/google-play-compliance#motion-activity-optional).

**iOS.** The CoreMotion code is compiled only when you opt in. Set the flag before the first `target` in `ios/Podfile`, run `pod install`, and add `NSMotionUsageDescription` to `Info.plist`:

```ruby
$BackgroundLocationMotionActivity = true
```

Without the flag the library contains no CoreMotion code and your app needs no `NSMotionUsageDescription`.

**Expo.** The `motionActivity` plugin prop does all of the above on `expo prebuild`:

```json
{
  "expo": {
    "plugins": [
      [
        "@gabriel-sisjr/react-native-background-location",
        {
          "motionActivity": {
            "usageDescription": "$(PRODUCT_NAME) detects when you are parked to save battery."
          }
        }
      ]
    ]
  }
}
```

See the [Motion Activity guide](https://gabriel-sisjr.github.io/react-native-background-location/docs/guides/motion-activity) for the permission flow, how the reduction works and the warning messages.

## Documentation

- [Getting Started](https://gabriel-sisjr.github.io/react-native-background-location/docs/getting-started/installation)
- [API Reference](https://gabriel-sisjr.github.io/react-native-background-location/docs/api-reference/functions)
- [Hooks](https://gabriel-sisjr.github.io/react-native-background-location/docs/api-reference/hooks/useBackgroundLocation)
- [Geofencing Guide](https://gabriel-sisjr.github.io/react-native-background-location/docs/guides/geofencing)
- [Motion Activity Guide](https://gabriel-sisjr.github.io/react-native-background-location/docs/guides/motion-activity)
- [Expo Config Plugin](https://gabriel-sisjr.github.io/react-native-background-location/docs/guides/expo-config-plugin)
- [Troubleshooting](https://gabriel-sisjr.github.io/react-native-background-location/docs/troubleshooting)

## License

MIT — see [LICENSE](./LICENSE).
