---
sidebar_position: 2
title: Testing
description: Testing guide for @gabriel-sisjr/react-native-background-location. Test structure, running tests, iOS-specific tests, mocking patterns, and manual testing procedures.
keywords:
  - testing
  - jest
  - unit-tests
  - ios-tests
  - mocking
  - react-native
  - background-location
---

# Testing Guide

This document describes the testing structure for `@gabriel-sisjr/react-native-background-location`. Tests are organized in a modular way and cover both Android and iOS platforms, focusing on basic functionality, library types, and cross-platform behavior.

---

## Running Tests

### All Tests

```bash
yarn test
```

`yarn test` runs two Jest projects: `lib` (the library, `src/__tests__/`) and `plugin` (the Expo config plugin, `plugin/src/__tests__/`).

### One Project

```bash
yarn test --selectProjects lib
yarn test --selectProjects plugin
```

### With Coverage

```bash
yarn test --coverage
```

### Verbose Output

```bash
yarn test --verbose
```

### Single Test File

```bash
yarn test -- src/__tests__/hooks/useBackgroundLocation.test.ts
```

### iOS-Specific Tests Only

```bash
yarn test -- src/__tests__/hooks/useLocationPermissions.ios.test.ts
yarn test -- src/__tests__/integration/ios-tracking.test.ts
```

### Expo Config Plugin Tests Only

```bash
yarn test --selectProjects plugin
yarn test --selectProjects plugin -u   # update the snapshots, then commit them
```

The plugin sources are in `plugin/src/`, and `plugin/tsconfig.json` excludes their tests, so `yarn typecheck` and `yarn prepare` never type-check them. Run `yarn typecheck:plugin:tests` to type-check the plugin together with its tests.

### Android Unit Tests (Kotlin)

```bash
yarn test:android
```

Runs the Kotlin unit tests of the library module through the example app's Gradle wrapper:

```bash
cd example/android && ./gradlew :gabriel-sisjr_react-native-background-location:testDebugUnitTest --no-daemon --console=plain -PreactNativeArchitectures=arm64-v8a
```

It needs JDK 17 and the Android SDK. The motion classes are `MotionGateTest`, `MotionClassifierTest`, `MotionOptionsTest`, `MotionPermissionsTest`, `MotionPendingIntentsTest` and `MotionSessionTest`; `LocationDatabaseMigrationTest` (Robolectric) migrates a version 1 Room database to version 2 and checks that every row survives. The existing provider, flow and `RecoveryWorker` tests run too. The JUnit XML reports are written to `android/build/test-results/testDebugUnitTest`.

### iOS Motion Unit Tests (Swift)

```bash
yarn test:ios
```

Runs `scripts/run-ios-unit-tests.sh`, which compiles the Foundation-only motion sources (`ios/Motion/MotionGate.swift`, `MotionNormalization.swift`, `MotionOptions.swift`, `MotionPreconditions.swift`) together with `ios-tests/motion-gate/*.swift` using `xcrun swiftc` for macOS, then runs the result. It needs macOS with the Xcode command line tools, but no Xcode project, simulator or CocoaPods, and takes seconds. The runner prints `N passed, F failed` and fails when `F` is greater than 0 or `N` is 0. `ios-tests/` is outside the podspec glob and the npm `files` list, so none of it ships.

---

## Test Structure

### Configuration Files

| File | Purpose |
| --- | --- |
| `setup-minimal.ts` | Minimal Jest configuration with basic React Native mocks (`lib` project) |
| `package.json` | Jest configuration: the `lib` and `plugin` projects, each with its own test patterns (see [Jest Configuration](#jest-configuration)) |
| `plugin/tsconfig.tests.json` | Type-checks the plugin sources together with their tests (`yarn typecheck:plugin:tests`) |

### Test Files

#### Type Tests (`types-basic.test.ts`)

Covers all TypeScript types in the library:

- Structure and validation of `Coords` type
- Structure and validation of `TrackingStatus` type
- Values and usage of `LocationPermissionStatus` enum
- Structure and validation of `PermissionState` type
- Structure and validation of `UseLocationPermissionsResult` type
- Structure and validation of `UseBackgroundLocationResult` type
- Structure and validation of `UseLocationTrackingOptions` type

#### Permission Hook Tests (`useLocationPermissions-simple.test.ts`)

Cross-platform `useLocationPermissions` hook:

- Initialization with correct default state
- iOS platform compatibility
- Existence and type of `checkPermissions` and `requestPermissions` functions

#### iOS Permission Tests (`useLocationPermissions.ios.test.ts`)

iOS-specific permission flow:

- Uses native `checkLocationPermission()` instead of `PermissionsAndroid`
- Uses native `requestLocationPermission()` via TurboModule bridge
- Handles `WHEN_IN_USE` status correctly (`hasPermission = true`)
- Maps iOS authorization statuses to `LocationPermissionStatus` enum
- Handles permission downgrade scenarios

#### iOS Tracking Tests (`ios-tracking.test.ts`)

iOS-specific tracking behavior:

- Notification options are silently ignored on iOS
- `startTracking` works without notification configuration
- iOS warning types (`PERMISSION_REVOKED`, `PERMISSION_DOWNGRADED`)
- Platform detection and conditional behavior

#### Basic Module Tests (`BackgroundLocation-basic.test.ts`)

Basic React Native functionality:

- Platform detection (Android/iOS)
- Native `BackgroundLocation` module availability
- Simulator mode (when native module is not available)
- `PermissionsAndroid` availability and constants
- `Linking` module availability

#### Motion Activity Tests

| Test file | Covers |
| --- | --- |
| `src/__tests__/motion/motionApi.test.ts` | `checkMotionPermission`, `requestMotionPermission`, `getMotionActivityState` and `addMotionActivityListener`, and their fallbacks when the native module is missing |
| `src/__tests__/hooks/useMotionActivity.test.ts` | The `useMotionActivity` hook: hydration on mount, on `tripId` changes, on app activation and on `MOTION_*` warnings; trip filtering; cleanup on unmount; the defaults when the native module is missing |
| `src/__tests__/types/locationWarningType.test.ts` | The 11 `LocationWarningType` members, checked against the literals in the native sources |

The mapping of the `motionActivity` option is covered by additions to `src/__tests__/utils/trackingOptionsMapper.test.ts`, and the new warning types with their `timestamp` by additions to `src/__tests__/hooks/useLocationUpdates.test.ts`.

#### Expo Config Plugin Tests (`plugin/src/__tests__/`)

The `plugin` project runs in a Node environment. It runs the plugin's modifiers against in-memory Android manifests and `Info.plist` objects, and the iOS deployment-target modifier against a throwaway Expo-style iOS project created in a temporary directory:

| Test file | Covers |
| --- | --- |
| `index.test.ts` | The published entry point: props reach the mods (the Podfile mod is registered only with the `motionActivity` prop), the run-once history entry (name and version) and the `PluginError` re-export |
| `validate.test.ts` | Plugin props validation and the `PluginError` codes, including `INVALID_MOTION_ACTIVITY`, `UNKNOWN_PROP` for an unknown key inside `motionActivity`, and a blank or non-string `motionActivity.usageDescription` |
| `withAndroidPermissions.test.ts` | Without the `motionActivity` prop, the seven permissions are injected exactly once; with it, the two activity-recognition permissions are added too (the Play services one capped at `android:maxSdkVersion="28"`). Unrelated permissions are preserved (snapshot and idempotency) |
| `withIosUsageStrings.test.ts` | Usage string defaults and overrides, `UIBackgroundModes`, the `temporaryUsageDescriptions` merge, and `NSMotionUsageDescription` only with the `motionActivity` prop (snapshot and idempotency) |
| `withIosMotionActivity.test.ts` | The Podfile flag line: inserted once right before the first `target`, idempotent, left alone when already set, and one warning with the Podfile unchanged when there is no `target` line |
| `withIosDeploymentTarget.test.ts` | The iOS deployment target is raised to 16.0 in `Podfile.properties.json` and the Xcode project, never lowered, and wins over a lower value written by another plugin's regular mod, such as `expo-build-properties` (plugin order does not matter) |
| `withIosDeploymentTarget.integration.test.ts` | The deployment target through Expo's real mod compiler, with a stand-in for `expo-build-properties` listed before and after the plugin |
| `assertNewArchitectureEnabled.test.ts` | The `NEW_ARCHITECTURE_DISABLED` guard: an explicit `false` is rejected on Expo SDK 54 and earlier and ignored from SDK 55 |
| `warnUnsupportedExpoSdk.test.ts` | The non-fatal warning for Expo SDKs older than 54 |
| `expoSdk.test.ts` | Parsing of the Expo SDK version |

Shared helpers live in `fixtures/` and `utils/makeConfig.ts`. Snapshots are in `__snapshots__/` and are committed.

---

## Jest Configuration

The Jest configuration lives in `package.json` and defines two projects (abridged):

```json
{
  "jest": {
    "projects": [
      {
        "displayName": "lib",
        "preset": "react-native",
        "setupFilesAfterEnv": ["<rootDir>/src/__tests__/setup-minimal.ts"],
        "modulePathIgnorePatterns": [
          "<rootDir>/example/node_modules",
          "<rootDir>/website/",
          "<rootDir>/lib/"
        ],
        "testMatch": ["<rootDir>/src/__tests__/**/*.test.{js,ts,tsx}"]
      },
      {
        "displayName": "plugin",
        "testEnvironment": "node",
        "clearMocks": true,
        "testMatch": ["<rootDir>/plugin/src/__tests__/**/*.test.ts"],
        "transform": {
          "^.+\\.ts$": [
            "babel-jest",
            { "presets": ["module:@babel/preset-typescript"] }
          ]
        }
      }
    ],
    "collectCoverageFrom": [
      "src/**/*.{js,ts,tsx}",
      "!src/__tests__/**",
      "!src/**/*.d.ts"
    ],
    "coverageThreshold": {
      "global": { "branches": 0, "functions": 0, "lines": 0, "statements": 0 }
    }
  }
}
```

Run only the plugin tests with `yarn test --selectProjects plugin` and update their snapshots with `-u`. `yarn typecheck:plugin:tests` type-checks the test files, which `plugin/tsconfig.json` excludes. Coverage (`--coverage`) is collected for `src/` only.

---

## Testing Patterns

### Mocking Platform.OS for iOS

```typescript
jest.mock('react-native/Libraries/Utilities/Platform', () => ({
  OS: 'ios',
  select: jest.fn((obj: Record<string, unknown>) => obj.ios),
}));
```

### Mocking the Native Module for iOS

```typescript
jest.mock('../../NativeBackgroundLocation', () => ({
  __esModule: true,
  default: {
    checkLocationPermission: jest.fn().mockResolvedValue('granted'),
    requestLocationPermission: jest.fn().mockResolvedValue('granted'),
    startTracking: jest.fn().mockResolvedValue('trip-123'),
    stopTracking: jest.fn().mockResolvedValue(undefined),
    isTracking: jest.fn().mockResolvedValue({ active: false }),
    getLocations: jest.fn().mockResolvedValue([]),
    clearTrip: jest.fn().mockResolvedValue(undefined),
    addListener: jest.fn(),
    removeListeners: jest.fn(),
  },
}));
```

### Testing WHEN_IN_USE Permission Status

```typescript
it('should treat WHEN_IN_USE as hasPermission = true', () => {
  // On iOS, WhenInUse is sufficient for basic tracking
  const state = mapPermissionStatus('whenInUse');
  expect(state.hasPermission).toBe(true);
  expect(state.status).toBe('whenInUse');
});
```

---

## Testing Strategy

### Current Approach

1. **Basic Tests** -- Focus on fundamental functionality without complex dependencies
2. **Minimal Mocks** -- Use simple mocks to avoid configuration problems
3. **Type Coverage** -- Complete validation of TypeScript types
4. **Compatibility** -- Tests for different platforms and scenarios

### Current Limitations

- **Integration Tests** -- Not implemented due to mock complexity
- **Complex Hook Tests** -- Limited to basic functionality
- **Native Module Tests** -- The Jest suites mock the native module. Native logic is covered by the Kotlin unit tests (`yarn test:android`) and the Swift motion tests (`yarn test:ios`), and device behaviour by the manual checks below

### Planned Improvements

1. Integration tests that validate component interaction
2. Complete hook tests for all scenarios
3. Native module tests that validate real functionality
4. Performance tests for critical operations

---

## Adding New Tests

1. Create a `*.test.ts` (or `.tsx`) file under `src/__tests__/` for the library, or under `plugin/src/__tests__/` for the Expo config plugin
2. Follow existing naming patterns
3. Use minimal mocks to avoid configuration problems
4. Focus on basic functionality and types

### Updating Existing Tests

1. Maintain compatibility with current configuration
2. Use simple and direct mocks
3. Avoid complex dependencies
4. Focus on real use cases

---

## Manual Testing on iOS

### Simulator Testing

1. Run the example app: `yarn example ios`
2. Use **Features > Location** in the Simulator menu to simulate location
3. Grant permissions when prompted
4. Start tracking and verify locations appear
5. Test background by pressing Home, then returning

### Device Testing

1. Build and run on a physical iOS device
2. Walk around outdoors with the device
3. Test the full permission flow (WhenInUse to Always)
4. Verify background tracking (blue bar indicator should appear)
5. Test crash recovery by force-killing the app, then reopening

### Permission Scenarios

| Scenario | How to Test | Expected Result |
| --- | --- | --- |
| WhenInUse only | Grant "While Using" only | `status: 'whenInUse'`, tracking works in foreground |
| Always | Grant "Always" | `status: 'granted'`, full background tracking |
| Denied | Deny permission | `status: 'denied'`, tracking fails gracefully |
| Revoked while tracking | Start tracking, then revoke in Settings | `PERMISSION_REVOKED` warning emitted |
| Downgraded while tracking | Start with Always, downgrade to WhenInUse in Settings | `PERMISSION_DOWNGRADED` warning emitted |

---

## Manual Testing on Android

### Emulator Testing

1. Run the example app: `yarn example android`
2. Open **Extended Controls** (three dots `...` on the emulator side panel)
3. Go to **Location** and set a specific coordinate or play a route
4. Grant all location permissions including "Allow all the time"
5. Start tracking and verify locations appear

### Device Testing

1. Build and run on a physical Android device
2. Grant all location and notification permissions
3. Test with the "High Accuracy" preset for 2-second updates
4. Background the app and verify the foreground service notification appears
5. Test crash recovery by force-stopping the app in Settings

---

## Motion Activity Device Tests

The reduction of location updates depends on real sensors, Doze and iOS background scheduling, which unit tests and emulators cannot reproduce, so these checks run on physical devices before a release that touches motion activity. Use the example app: it has a motion toggle (off by default), a reduction toggle, permission buttons, and an event and warning log. The expected warning messages are the exact strings in the [Warnings](../guides/motion-activity.md#warnings) section of the Motion Activity guide.

### iOS

Build the example with motion compiled in (`cd example/ios && EXAMPLE_MOTION_ACTIVITY=1 bundle exec pod install`), then run each check once with "Always" and once with "When In Use" location authorization.

1. Start a trip with reduction on, put the app in the background and park for 15 minutes: exactly one `MOTION_LOCATION_REDUCED`; the app is never suspended (debug log timestamps keep advancing); the blue location indicator stays visible.
2. Drive away: `MOTION_LOCATION_RESTORED` ("Movement detected; ...") within seconds.
3. Drive through red lights and stop-and-go traffic: no `MOTION_LOCATION_REDUCED`.
4. Remove `NSMotionUsageDescription` from `Info.plist` and start a trip: no crash, the "NSMotionUsageDescription is missing from Info.plist" warning, full-accuracy tracking.
5. With the Motion & Fitness permission not determined, start a trip: the "has not been requested" warning and no prompt. Then call `requestMotionPermission()` with the app in the foreground: the system prompt appears.
6. During a reduced trip, revoke Motion & Fitness in Settings and return to the app: `MOTION_LOCATION_RESTORED` ("Motion activity stopped; ...") followed by "Motion activity permission was revoked".
7. Kill the app during a trip and let crash recovery restart it: `activityType`, `waitForAccurateLocation` and the motion options are restored, and `getMotionActivityState()` reports `MONITORING`.
8. Build without the flag (plain `bundle exec pod install`) and start a trip with `motionActivity` on: the "is not compiled into this app" warning; `nm -u` on the library binary lists no CoreMotion class.
9. Stay parked longer than `maxReducedDuration`, with the screen locked: about one accurate fix is recorded per period (the maximum-duration timer follows wall-clock time, so time asleep counts), and no warning is emitted for the probe.
10. Informational: compare battery use over 2 hours parked with reduction on and off.

### Android

Use one Android 14 (API 34) or newer device with Google Play services and one Android 9 (API 28) device.

1. Start a trip with reduction on and park for 15 minutes with the screen off: exactly one `MOTION_LOCATION_REDUCED`, the notification text changes to the reduced text, and no fixes are recorded while reduced.
2. Drive away: `MOTION_LOCATION_RESTORED` within 60 seconds, and the base notification text returns.
3. Drive in stop-and-go traffic with red lights of up to 3 minutes: no `MOTION_LOCATION_REDUCED`.
4. Park for 90 minutes: probe fixes are recorded 30 to about 53 minutes apart with the defaults, because the alarms are inexact (later in Doze; note the actual spacing), and no warnings are emitted for the probes.
5. Deny the activity recognition permission and start a trip: the "ACTIVITY_RECOGNITION permission is not granted" warning, full-accuracy tracking.
6. Revoke the permission in Settings during a trip: Android kills the app process; when tracking restarts, the session reports the permission warning and never reduces.
7. On the API 28 device, start a trip with the Play services permission declared (detection runs), then without it (the "is not declared in AndroidManifest.xml" warning).
8. While reduced, run `adb shell dumpsys deviceidle force-idle`, note when the timers fire, then move the device: full accuracy must be restored. Run `adb shell dumpsys deviceidle unforce` afterwards.
9. While reduced, kill the process (`adb shell am kill <package>`): the recovered session starts in `MONITORING` and no stale activity results are delivered.
10. With `motionActivity` off, start a trip: logcat shows no Activity Recognition client, unless a registration left by an earlier session is being removed.
