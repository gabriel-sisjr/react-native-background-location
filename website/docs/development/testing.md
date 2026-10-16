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

#### Expo Config Plugin Tests (`plugin/src/__tests__/`)

The `plugin` project runs in a Node environment. It runs the plugin's modifiers against in-memory Android manifests and `Info.plist` objects, and the iOS deployment-target modifier against a throwaway Expo-style iOS project created in a temporary directory:

| Test file | Covers |
| --- | --- |
| `index.test.ts` | The published entry point: props reach the mods, the run-once history entry (name and version) and the `PluginError` re-export |
| `validate.test.ts` | Plugin props validation and the `PluginError` codes |
| `withAndroidPermissions.test.ts` | The seven permissions are injected exactly once, unrelated permissions are preserved (snapshot and idempotency) |
| `withIosUsageStrings.test.ts` | Usage string defaults and overrides, `UIBackgroundModes` and the `temporaryUsageDescriptions` merge (snapshot and idempotency) |
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
- **Native Module Tests** -- Focused on availability, not functionality

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
