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
[
![Bundlephobia](https://img.shields.io/bundlephobia/minzip/%40gabriel-sisjr%2Freact-native-background-location?label=size)
](https://bundlephobia.com/package/@gabriel-sisjr/react-native-background-location)
![Platform](https://img.shields.io/badge/platform-Android-green)
![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue)

A React Native library for tracking location in the background using TurboModules (New Architecture). Track user location even when the app is minimized or in the background.

![Tracking demo](docs/assets/tracking.gif)

## Features

- ✅ **Background location tracking** - Continues tracking when app is in background
- ✅ **Real-time location updates** - Automatic event-driven location watching
- ✅ **TurboModule** - Built with React Native's New Architecture for better performance
- ✅ **Session-based tracking** - Organize location data by trip/session IDs
- ✅ **TypeScript support** - Fully typed API
- ✅ **Android support** - Native Kotlin implementation (iOS coming soon)
- ✅ **Persistent storage** - Locations are stored and survive app restarts
- ✅ **Foreground service** - Uses Android foreground service for reliable tracking

## Installation

```sh
npm install @gabriel-sisjr/react-native-background-location
# or
yarn add @gabriel-sisjr/react-native-background-location
```

## Platform Configuration

### Android

1. **Add permissions to your `android/app/src/main/AndroidManifest.xml`:**

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

  <!-- Location permissions -->
  <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
  <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />

  <!-- Background location for Android 10+ -->
  <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />

  <!-- Foreground service permissions -->
  <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
  <uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />

  <application>
    <!-- Your app configuration -->
  </application>
</manifest>
```

2. **Request permissions at runtime:** _(not recommended, should use hook instead)_

```typescript
import { PermissionsAndroid, Platform } from 'react-native';

const requestLocationPermissions = async () => {
  if (Platform.OS === 'android') {
    const granted = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
      PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
    ]);

    return (
      granted['android.permission.ACCESS_FINE_LOCATION'] === 'granted' &&
      granted['android.permission.ACCESS_COARSE_LOCATION'] === 'granted' &&
      granted['android.permission.ACCESS_BACKGROUND_LOCATION'] === 'granted'
    );
  }
  return true;
};
```

### iOS

iOS support is coming in a future release.

## Usage

### Using React Hooks (Recommended)

The easiest way to use the library is with React Hooks:

```typescript
import {
  useLocationPermissions,
  useBackgroundLocation,
  useLocationUpdates,
  LocationAccuracy,
  NotificationPriority,
  type TrackingOptions,
} from '@gabriel-sisjr/react-native-background-location';

function TrackingScreen() {
  // Manage permissions
  const { permissionStatus, requestPermissions } = useLocationPermissions();

  // Configure tracking options
  const trackingOptions: TrackingOptions = {
    updateInterval: 5000, // 5 seconds
    fastestInterval: 3000, // 3 seconds
    maxWaitTime: 10000, // 10 seconds
    accuracy: LocationAccuracy.HIGH_ACCURACY,
    waitForAccurateLocation: false,
    notificationTitle: 'Location Tracking',
    notificationText: 'Tracking your location in background',
    notificationPriority: NotificationPriority.LOW,
  };

  // Manage tracking (for start/stop control)
  const {
    startTracking,
    stopTracking,
    isTracking,
  } = useBackgroundLocation({
    onError: (err) => console.error(err),
  });

  // Watch real-time location updates
  const {
    locations,
    lastLocation,
  } = useLocationUpdates({
    onLocationUpdate: (location) => {
      console.log('New location:', location);
    },
  });

  // Request permissions first
  if (!permissionStatus.hasPermission) {
    return <Button title="Grant Permissions" onPress={requestPermissions} />;
  }

  const handleStartTracking = () => {
    startTracking(undefined, trackingOptions);
  };

  return (
    <View>
      <Text>Status: {isTracking ? 'Tracking' : 'Stopped'}</Text>
      <Text>Locations: {locations.length}</Text>
      {lastLocation && (
        <Text>Last: {lastLocation.latitude}, {lastLocation.longitude}</Text>
      )}
      <Button
        title={isTracking ? 'Stop' : 'Start'}
        onPress={isTracking ? stopTracking : handleStartTracking}
      />
    </View>
  );
}
```

#### Real-Time Updates Hook

The `useLocationUpdates` hook provides automatic, real-time location updates:

```typescript
import { useLocationUpdates } from '@gabriel-sisjr/react-native-background-location';

function LiveTrackingScreen() {
  const {
    locations,
    lastLocation,
    isTracking,
    tripId,
    error,
  } = useLocationUpdates({
    onLocationUpdate: (location) => {
      console.log('New location received:', location);
    },
  });

  return (
    <View>
      <Text>Locations: {locations.length}</Text>
      {lastLocation && (
        <Text>Last: {lastLocation.latitude}, {lastLocation.longitude}</Text>
      )}
    </View>
  );
}
```

See the [Hooks Guide](docs/getting-started/hooks.md) for complete hook documentation.  
See the [Real-Time Updates Guide](docs/getting-started/REAL_TIME_UPDATES.md) for real-time location watching.

### Using Direct API

You can also use the module API directly:

```typescript
import BackgroundLocation, {
  type Coords,
  LocationAccuracy,
  NotificationPriority,
  type TrackingOptions,
} from '@gabriel-sisjr/react-native-background-location';

// Configure tracking options
const options: TrackingOptions = {
  updateInterval: 5000,
  fastestInterval: 3000,
  maxWaitTime: 10000,
  accuracy: LocationAccuracy.HIGH_ACCURACY,
  waitForAccurateLocation: false,
  notificationTitle: 'Location Tracking',
  notificationText: 'Tracking your location in background',
  notificationPriority: NotificationPriority.LOW,
};

// Recommended: Let the library generate a unique trip ID
const tripId = await BackgroundLocation.startTracking(undefined, options);

// Optional: Resume tracking with an existing trip ID (for crash recovery)
// Only use this to resume a previously interrupted tracking session
const resumedTripId =
  await BackgroundLocation.startTracking('existing-trip-123', options);

// Check if tracking is active
const status = await BackgroundLocation.isTracking();
console.log(status.active); // true/false
console.log(status.tripId); // current trip ID if active

// Get all locations for a trip
const locations: Coords[] = await BackgroundLocation.getLocations(tripId);
locations.forEach((location) => {
  console.log(location.latitude); // string
  console.log(location.longitude); // string
  console.log(location.timestamp); // number (Unix timestamp in ms)
});

// Stop tracking
await BackgroundLocation.stopTracking();

// Clear stored data for a trip
await BackgroundLocation.clearTrip(tripId);
```

## API Reference

### `startTracking(tripId?: string, options?: TrackingOptions): Promise<string>`

Starts location tracking in background for a new or existing trip.

- **Parameters:**
  - `tripId` (optional): Existing trip identifier to resume tracking. If omitted, a new UUID will be generated.

    **⚠️ Important:** Only provide a `tripId` when resuming an interrupted tracking session (e.g., after app crash, battery drain, etc.). For new trips, always omit this parameter to let the library generate a unique UUID. This prevents data overwriting and ensures each trip has a unique identifier.

  - `options` (optional): Configuration options for location tracking. See [TrackingOptions](#trackingoptions) for details.

- **Returns:** Promise resolving to the effective trip ID being used.

- **Behavior:**
  - If tracking is already active, returns the current trip ID (idempotent).
  - Starts a foreground service on Android with a persistent notification.
  - Requires location permissions to be granted.
  - **New trips:** Generates a unique UUID to prevent collisions.
  - **Resuming trips:** Continues collecting locations to the existing trip data.
  - Uses provided `options` or defaults if not specified.

- **Best Practice:**

  ```typescript
  // ✅ Good: Start a new trip with default options
  const newTripId = await startTracking();

  // ✅ Good: Start a new trip with custom options
  const customTripId = await startTracking(undefined, {
    accuracy: LocationAccuracy.HIGH_ACCURACY,
    updateInterval: 2000,
  });

  // ✅ Good: Resume after interruption
  const resumedTripId = await startTracking(previousTripId);

  // ❌ Avoid: Don't create new trips with custom IDs
  const badTripId = await startTracking('my-custom-id');
  ```

- **Throws:**
  - `PERMISSION_DENIED` if location permissions are not granted.
  - `START_TRACKING_ERROR` if unable to start the service.

### `stopTracking(): Promise<void>`

Stops all location tracking and terminates the background service.

- **Returns:** Promise that resolves when tracking is stopped.

- **Behavior:**
  - Removes the foreground service and notification.
  - Does not clear stored location data (use `clearTrip()` for that).

### `isTracking(): Promise<TrackingStatus>`

Checks if location tracking is currently active.

- **Returns:** Promise resolving to an object:
  ```typescript
  {
    active: boolean;      // Whether tracking is active
    tripId?: string;      // Current trip ID if tracking
  }
  ```

### `getLocations(tripId: string): Promise<Coords[]>`

Retrieves all stored location points for a specific trip.

- **Parameters:**
  - `tripId`: The trip identifier.

- **Returns:** Promise resolving to array of location coordinates:

  ```typescript
  {
    latitude: string; // Latitude as string
    longitude: string; // Longitude as string
    timestamp: number; // Unix timestamp in milliseconds
  }
  [];
  ```

- **Throws:**
  - `INVALID_TRIP_ID` if trip ID is empty.
  - `GET_LOCATIONS_ERROR` if unable to retrieve data.

### `clearTrip(tripId: string): Promise<void>`

Clears all stored location data for a specific trip.

- **Parameters:**
  - `tripId`: The trip identifier to clear.

- **Returns:** Promise that resolves when data is cleared.

- **Throws:**
  - `INVALID_TRIP_ID` if trip ID is empty.
  - `CLEAR_TRIP_ERROR` if unable to clear data.

## Types

```typescript
interface Coords {
  latitude: string;
  longitude: string;
  timestamp: number;
}

interface TrackingStatus {
  active: boolean;
  tripId?: string;
}

interface TrackingOptions {
  updateInterval?: number; // Interval between location updates in milliseconds (default: 5000)
  fastestInterval?: number; // Fastest interval between location updates in milliseconds (default: 3000)
  maxWaitTime?: number; // Maximum wait time in milliseconds before delivering location updates (default: 10000)
  accuracy?: LocationAccuracy; // Location accuracy priority (default: LocationAccuracy.HIGH_ACCURACY)
  waitForAccurateLocation?: boolean; // Whether to wait for accurate location before delivering updates (default: false)
  notificationTitle?: string; // Notification title for foreground service (default: "Location Tracking")
  notificationText?: string; // Notification text for foreground service (default: "Tracking your location in background")
  notificationChannelName?: string; // Notification channel name (Android) (default: "Background Location")
  notificationPriority?: NotificationPriority; // Notification priority (Android) (default: NotificationPriority.LOW)
}
```

## Enums

### LocationAccuracy

Location accuracy priority levels:

```typescript
enum LocationAccuracy {
  HIGH_ACCURACY = 'HIGH_ACCURACY', // Highest accuracy - uses GPS and other sensors (default)
  BALANCED_POWER_ACCURACY = 'BALANCED_POWER_ACCURACY', // Balanced accuracy and power consumption
  LOW_POWER = 'LOW_POWER', // Low power consumption - uses network-based location
  NO_POWER = 'NO_POWER', // No power consumption - only receives location updates when other apps request them
  PASSIVE = 'PASSIVE', // Passive location updates - receives location updates from other apps
}
```

### NotificationPriority

Notification priority levels for Android:

```typescript
enum NotificationPriority {
  LOW = 'LOW', // Low priority - minimal notification (default)
  DEFAULT = 'DEFAULT', // Default priority
  HIGH = 'HIGH', // High priority - more prominent notification
  MAX = 'MAX', // Maximum priority - urgent notification
}
```

### LocationPermissionStatus

Location permission status:

```typescript
enum LocationPermissionStatus {
  GRANTED = 'granted',
  DENIED = 'denied',
  BLOCKED = 'blocked',
  UNDETERMINED = 'undetermined',
}
```

## Configuration

The library provides configurable tracking options through `TrackingOptions`. You can customize location update intervals, accuracy, and notification settings.

### Default Configuration

The library uses the following default settings:

- **Update interval:** 5 seconds (5000ms)
- **Fastest interval:** 3 seconds (3000ms)
- **Max wait time:** 10 seconds (10000ms)
- **Accuracy:** `LocationAccuracy.HIGH_ACCURACY`
- **Wait for accurate location:** `false`
- **Notification title:** "Location Tracking"
- **Notification text:** "Tracking your location in background"
- **Notification channel name:** "Background Location"
- **Notification priority:** `NotificationPriority.LOW`

### Customizing Configuration

You can customize tracking options when starting tracking:

```typescript
import {
  BackgroundLocation,
  LocationAccuracy,
  NotificationPriority,
  type TrackingOptions,
} from '@gabriel-sisjr/react-native-background-location';

// High accuracy preset (for navigation)
const highAccuracyOptions: TrackingOptions = {
  updateInterval: 2000,
  fastestInterval: 1000,
  maxWaitTime: 5000,
  accuracy: LocationAccuracy.HIGH_ACCURACY,
  waitForAccurateLocation: true,
  notificationTitle: 'High Accuracy Tracking',
  notificationText: 'Using GPS for precise location tracking',
  notificationPriority: NotificationPriority.DEFAULT,
};

// Balanced preset (for most tracking use cases)
const balancedOptions: TrackingOptions = {
  updateInterval: 10000,
  fastestInterval: 5000,
  maxWaitTime: 15000,
  accuracy: LocationAccuracy.BALANCED_POWER_ACCURACY,
  waitForAccurateLocation: false,
  notificationPriority: NotificationPriority.LOW,
};

// Low power preset (for battery efficiency)
const lowPowerOptions: TrackingOptions = {
  updateInterval: 30000,
  fastestInterval: 15000,
  maxWaitTime: 60000,
  accuracy: LocationAccuracy.LOW_POWER,
  waitForAccurateLocation: false,
  notificationTitle: 'Low Power Tracking',
  notificationText: 'Power-efficient location tracking',
  notificationPriority: NotificationPriority.LOW,
};

// Start tracking with custom options
const tripId = await BackgroundLocation.startTracking(undefined, highAccuracyOptions);
```

### Configuration Presets

The example app includes predefined configuration presets that you can use as a reference:

- **High Accuracy:** Optimized for navigation and precise tracking (2s interval, GPS)
- **Balanced:** Good balance between accuracy and battery (10s interval, balanced accuracy)
- **Low Power:** Optimized for battery efficiency (30s interval, network-based)

See the [example app](example/src/App.tsx) for complete implementation examples.

## Battery Optimization

⚠️ **Important:** Background location tracking can significantly impact battery life. Consider:

- Only tracking when necessary
- Stopping tracking when done
- Informing users about battery usage
- Testing on real devices (not emulators)

On Android, some manufacturers (Xiaomi, Huawei, etc.) have aggressive battery optimization that may kill background services. Users may need to whitelist your app in battery settings.

## Simulator/Emulator Support

When the native module is not available (e.g., running in simulator without proper setup), all methods will:

- Log a warning to the console
- Return safe fallback values
- Not crash the app

This allows development without constant native setup.

## React Hooks

The library provides four React Hooks for easier integration:

### `useLocationPermissions()`

Manages location permissions including background permissions.

```typescript
const {
  permissionStatus, // Current permission state
  requestPermissions, // Request all permissions
  checkPermissions, // Check without requesting
  isRequesting, // Loading state
} = useLocationPermissions();
```

### `useBackgroundLocation(options?)`

Complete hook for managing tracking, locations, and state.

```typescript
const {
  isTracking, // Whether tracking is active
  tripId, // Current trip ID
  locations, // Array of locations
  isLoading, // Loading state
  error, // Last error
  startTracking, // Start tracking
  stopTracking, // Stop tracking
  refreshLocations, // Refresh locations
  clearCurrentTrip, // Clear trip data
  clearError, // Clear error
} = useBackgroundLocation({
  autoStart: false, // Auto-start on mount
  onTrackingStart: (id) => {}, // Callback
  onTrackingStop: () => {}, // Callback
  onError: (err) => {}, // Callback
});
```

### `useLocationTracking(autoRefresh?)`

Lightweight hook for monitoring tracking status.

```typescript
const {
  isTracking, // Whether tracking is active
  tripId, // Current trip ID
  refresh, // Refresh status
  isLoading, // Loading state
} = useLocationTracking(true);
```

### `useLocationUpdates(options?)`

Real-time location updates with automatic event-driven updates.

```typescript
const {
  locations,            // Array of locations (updates automatically)
  lastLocation,         // Most recent location
  isTracking,           // Tracking status
  tripId,               // Current trip ID
  isLoading,            // Loading state
  error,                // Error state
  clearError,           // Clear error
} = useLocationUpdates({
  tripId?: string,                          // Filter by tripId
  onLocationUpdate?: (location) => void,    // Callback per update
  autoLoad?: boolean                         // Auto-load existing data
});
```

See the **[Hooks Guide](docs/getting-started/hooks.md)** for complete documentation and examples.

## Documentation

### Getting Started

- **[Quick Start Guide](docs/getting-started/QUICKSTART.md)** - Get up and running in 5 minutes
- **[Integration Guide](docs/getting-started/INTEGRATION_GUIDE.md)** - Detailed integration steps for existing apps
- **[Hooks Guide](docs/getting-started/hooks.md)** - Complete hooks documentation
- **[Real-Time Updates Guide](docs/getting-started/REAL_TIME_UPDATES.md)** - Automatic location watching with useLocationUpdates

### Development

- **[Publishing Guide](docs/development/PUBLISHING.md)** - How to publish updates to npm
- **[Implementation Summary](docs/development/IMPLEMENTATION_SUMMARY.md)** - Technical overview of the implementation
- **[Testing Guide](docs/development/TESTING.md)** - Testing structure and guidelines

## Example App

The library includes a complete example app demonstrating all features:

```bash
# Run the example app
cd example
yarn install

# Android
yarn android

# iOS (coming soon)
yarn ios
```

## Troubleshooting

### Android: Location not updating in background

1. Ensure all permissions are granted, including `ACCESS_BACKGROUND_LOCATION`
2. Check that the foreground service is running (you should see a notification)
3. Test on a real device (emulator GPS simulation is unreliable)
4. Check device battery optimization settings
5. Verify Google Play Services is installed and up to date

### Build errors

1. Make sure you're using React Native 0.70+
2. Clean build: `cd android && ./gradlew clean`
3. Clear Metro cache: `yarn start --reset-cache`
4. Rebuild: `yarn android`

### TypeScript errors

Make sure your `tsconfig.json` includes:

```json
{
  "compilerOptions": {
    "moduleResolution": "node"
  }
}
```

## Roadmap

- [ ] iOS implementation with Swift
- [ ] Customizable location update intervals
- [ ] Geofencing support
- [ ] Distance filtering for GPS coordinates
- [ ] SQLite storage option for large datasets
- [ ] Configurable notification appearance
- [ ] Battery optimization modes
- [ ] Web support (Geolocation API)

## Contributing

See the [contributing guide](CONTRIBUTING.md) to learn how to contribute to the repository and the development workflow.

## Support & Sponsorship

If you find this library useful, please consider:

- ⭐ **Star the repository** - It helps others discover the project
- 🐛 **Report bugs** - Help me improve the library
- 💻 **Contribute code** - Pull requests are always welcome
- ☕ **Sponsor on GitHub** - Support ongoing development and maintenance

[**Sponsor this project**](https://github.com/sponsors/gabriel-sisjr) to help me continue building and maintaining open source tools for the React Native community.

See the [Sponsor page](SPONSOR.md) for more details about sponsorship benefits and how your support helps the project.

## License

MIT
