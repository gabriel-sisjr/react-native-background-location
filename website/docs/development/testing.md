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
yarn test -- src/__tests__/ios-tracking.test.ts
```

---

## Test Structure

### Configuration Files

| File | Purpose |
| --- | --- |
| `setup-minimal.ts` | Minimal Jest configuration with basic React Native mocks |
| `package.json` | Jest configuration with specific test patterns |

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

---

## Jest Configuration

```json
{
  "jest": {
    "preset": "react-native",
    "setupFilesAfterEnv": ["<rootDir>/src/__tests__/setup-minimal.ts"],
    "testMatch": [
      "<rootDir>/src/__tests__/**/*-simple.test.{js,ts,tsx}",
      "<rootDir>/src/__tests__/**/*-basic.test.{js,ts,tsx}",
      "<rootDir>/src/__tests__/**/*.ios.test.{js,ts,tsx}",
      "<rootDir>/src/__tests__/**/*.test.{js,ts,tsx}"
    ],
    "coverageThreshold": {
      "global": {
        "branches": 0,
        "functions": 0,
        "lines": 0,
        "statements": 0
      }
    }
  }
}
```

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

1. Create a file with the suffix `-simple.test.ts`, `-basic.test.ts`, or `.ios.test.ts`
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
