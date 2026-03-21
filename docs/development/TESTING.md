# Testing Guide for React Native Background Location Library

## Overview

This document describes the testing structure implemented for the `@gabriel-sisjr/react-native-background-location` library. Tests are organized in a modular way and cover both Android and iOS platforms, focusing on basic functionality, library types, and cross-platform behavior.

## Test Structure

### Configuration Files

- **`setup-minimal.ts`**: Minimal Jest configuration with basic React Native mocks
- **`package.json`**: Jest configuration with specific test patterns

### Test Files

#### 1. Type Tests (`types-basic.test.ts`)

- **Coverage**: All TypeScript types in the library
- **Tests**:
  - Structure and validation of `Coords` type
  - Structure and validation of `TrackingStatus` type
  - Values and usage of `LocationPermissionStatus` enum
  - Structure and validation of `PermissionState` type
  - Structure and validation of `UseLocationPermissionsResult` type
  - Structure and validation of `UseBackgroundLocationResult` type
  - Structure and validation of `UseLocationTrackingOptions` type

#### 2. Permission Hook Tests (`useLocationPermissions-simple.test.ts`)

- **Coverage**: `useLocationPermissions` hook (cross-platform)
- **Tests**:
  - Initialization with correct default state
  - iOS platform compatibility
  - Existence and type of `checkPermissions` and `requestPermissions` functions

#### 2b. iOS Permission Tests (`useLocationPermissions.ios.test.ts`)

- **Coverage**: `useLocationPermissions` hook on iOS
- **Tests**:
  - Uses native `checkLocationPermission()` instead of `PermissionsAndroid`
  - Uses native `requestLocationPermission()` via TurboModule bridge
  - Handles `WHEN_IN_USE` status correctly (`hasPermission = true`)
  - Maps iOS authorization statuses to `LocationPermissionStatus` enum
  - Handles permission downgrade scenarios

#### 2c. iOS Tracking Tests (`ios-tracking.test.ts`)

- **Coverage**: iOS-specific tracking behavior
- **Tests**:
  - Notification options are silently ignored on iOS
  - `startTracking` works without notification configuration
  - iOS warning types (`PERMISSION_REVOKED`, `PERMISSION_DOWNGRADED`)
  - Platform detection and conditional behavior

#### 3. Basic Module Tests (`BackgroundLocation-basic.test.ts`)

- **Coverage**: Basic React Native functionality
- **Tests**:
  - Platform detection (Android/iOS)
  - Native `BackgroundLocation` module availability
  - Simulator mode (when native module is not available)
  - `PermissionsAndroid` availability and constants
  - `Linking` module availability

## Test Configuration

### Test Dependencies

```json
{
  "devDependencies": {
    "@testing-library/react-native": "^13.3.3",
    "react-test-renderer": "^19.1.0"
  }
}
```

### Jest Configuration

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

## Running Tests

### Main Command

```bash
yarn test
```

### Coverage Command

```bash
yarn test --coverage
```

### Verbose Command

```bash
yarn test --verbose
```

## Test Results

### Current Status

- ✅ **3 test suites passing**
- ✅ **27 tests passing**
- ✅ **0 tests failing**
- ✅ **Fast execution: ~0.2s**

### Test Details

#### Type Tests (15 tests)

- Data structure validation
- TypeScript type verification
- Compatibility tests

#### Permission Hook Tests (4 tests)

- Hook initialization
- Platform compatibility
- Function availability

#### Basic Module Tests (8 tests)

- Platform detection
- Native modules
- Android permissions
- Linking functionality

## Testing Strategy

### Adopted Approach

1. **Basic Tests**: Focus on fundamental functionality without complex dependencies
2. **Minimal Mocks**: Use simple mocks to avoid configuration problems
3. **Type Coverage**: Complete validation of TypeScript types
4. **Compatibility**: Tests for different platforms and scenarios

### Current Limitations

- **Integration Tests**: Not implemented due to mock complexity
- **Complex Hook Tests**: Limited to basic functionality
- **Native Module Tests**: Focused on availability, not functionality

### Next Steps

1. **Integration Tests**: Implement tests that validate component interaction
2. **Complete Hook Tests**: Add tests for all hook scenarios
3. **Native Module Tests**: Implement tests that validate real functionality
4. **Performance Tests**: Add performance tests for critical operations

## Test Maintenance

### Adding New Tests

1. Create file with suffix `-simple.test.ts` or `-basic.test.ts`
2. Follow existing naming pattern
3. Use minimal mocks to avoid configuration problems
4. Focus on basic functionality and types

### Updating Existing Tests

1. Maintain compatibility with current configuration
2. Use simple and direct mocks
3. Avoid complex dependencies
4. Focus on real use cases

## Conclusion

The implemented test structure provides a solid foundation for validating the basic functionality of the library. Tests cover the most important aspects: TypeScript types, basic hooks, and fundamental React Native functionality.

The minimalist approach adopted ensures that tests run reliably and quickly, providing immediate feedback on code quality.

## iOS Testing

### iOS-Specific Test Files

| File                                 | Purpose                                                     |
| ------------------------------------ | ----------------------------------------------------------- |
| `useLocationPermissions.ios.test.ts` | Tests iOS permission flow using native TurboModule methods  |
| `ios-tracking.test.ts`               | Tests iOS-specific tracking behavior and platform detection |

### Running iOS Tests

All tests (including iOS-specific ones) run with the same command:

```bash
yarn test
```

To run only iOS-specific tests:

```bash
yarn test -- src/__tests__/hooks/useLocationPermissions.ios.test.ts
yarn test -- src/__tests__/ios-tracking.test.ts
```

### iOS Test Patterns

#### Mocking Platform.OS for iOS

```typescript
jest.mock('react-native/Libraries/Utilities/Platform', () => ({
  OS: 'ios',
  select: jest.fn((obj: Record<string, unknown>) => obj.ios),
}));
```

#### Mocking Native Module for iOS

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

#### Testing WHEN_IN_USE Permission Status

```typescript
it('should treat WHEN_IN_USE as hasPermission = true', () => {
  // On iOS, WhenInUse is sufficient for basic tracking
  const state = mapPermissionStatus('whenInUse');
  expect(state.hasPermission).toBe(true);
  expect(state.status).toBe('whenInUse');
});
```

### Manual Testing on iOS

#### Simulator Testing

1. Run the example app: `yarn example ios`
2. Use **Features > Location** in the Simulator menu to simulate location
3. Grant permissions when prompted
4. Start tracking and verify locations appear
5. Test background by pressing Home, then returning

#### Device Testing

1. Build and run on a physical iOS device
2. Walk around outdoors with the device
3. Test the full permission flow (WhenInUse → Always)
4. Verify background tracking (blue bar indicator should appear)
5. Test crash recovery by force-killing the app, then reopening

#### Testing Permission Scenarios

| Scenario                  | How to Test                                           | Expected Result                                     |
| ------------------------- | ----------------------------------------------------- | --------------------------------------------------- |
| WhenInUse only            | Grant "While Using" only                              | `status: 'whenInUse'`, tracking works in foreground |
| Always                    | Grant "Always"                                        | `status: 'granted'`, full background tracking       |
| Denied                    | Deny permission                                       | `status: 'denied'`, tracking fails gracefully       |
| Revoked while tracking    | Start tracking, then revoke in Settings               | `PERMISSION_REVOKED` warning emitted                |
| Downgraded while tracking | Start with Always, downgrade to WhenInUse in Settings | `PERMISSION_DOWNGRADED` warning emitted             |
