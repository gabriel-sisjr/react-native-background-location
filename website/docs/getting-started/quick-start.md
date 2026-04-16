---
sidebar_position: 3
title: Quick Start
description: Get background location tracking running in your React Native app in 5 minutes with hooks and a complete working example.
keywords:
  - react-native
  - quick-start
  - background-location
  - tutorial
  - hooks
  - useBackgroundLocation
  - useLocationPermissions
  - useLocationUpdates
  - tracking
---

# Quick Start

Get background location tracking running in 5 minutes. This guide uses the hooks-first approach for the simplest integration.

## Prerequisites

Before starting, make sure you have:

- Completed the [Installation](./installation.md) steps (package installed, Android permissions added)
- Completed the [iOS Setup](./ios-setup.md) if targeting iOS
- A physical device for testing (recommended over emulators)

## Minimal Example

The fastest way to get tracking working with three hooks:

```tsx
import React from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import {
  useLocationPermissions,
  useBackgroundLocation,
  useLocationUpdates,
  LocationAccuracy,
} from '@gabriel-sisjr/react-native-background-location';

function TrackingScreen() {
  const { permissionStatus, requestPermissions, isRequesting } =
    useLocationPermissions();

  const { startTracking, stopTracking, isTracking, tripId } =
    useBackgroundLocation();

  const { locations, lastLocation } = useLocationUpdates({
    onLocationUpdate: (location) => {
      console.log('New location:', location.latitude, location.longitude);
    },
  });

  // Step 1: Request permissions if not granted
  if (!permissionStatus.location.hasPermission) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Location Permission Required</Text>
        <Text style={styles.subtitle}>
          Background location access is needed to track your trips.
        </Text>
        <Button
          title={isRequesting ? 'Requesting...' : 'Grant Permissions'}
          onPress={requestPermissions}
          disabled={isRequesting}
        />
      </View>
    );
  }

  // Step 2: Show tracking controls
  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {isTracking ? 'Tracking Active' : 'Ready to Track'}
      </Text>

      {tripId && <Text style={styles.info}>Trip: {tripId}</Text>}
      <Text style={styles.info}>Locations: {locations.length}</Text>

      {lastLocation && (
        <Text style={styles.info}>
          Last: {lastLocation.latitude}, {lastLocation.longitude}
        </Text>
      )}

      <Button
        title={isTracking ? 'Stop Tracking' : 'Start Tracking'}
        onPress={() =>
          isTracking
            ? stopTracking()
            : startTracking(undefined, {
                accuracy: LocationAccuracy.HIGH_ACCURACY,
                distanceFilter: 50,
              })
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20 },
  title: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 12 },
  subtitle: { fontSize: 14, textAlign: 'center', marginBottom: 20, color: '#666' },
  info: { fontSize: 14, textAlign: 'center', marginBottom: 8 },
});

export default TrackingScreen;
```

That is all you need. The hooks handle permissions, tracking lifecycle, session recovery, and real-time location streaming.

## Step-by-Step Breakdown

### 1. Request Permissions

The `useLocationPermissions` hook manages the entire cross-platform permission flow:

```tsx
import { useLocationPermissions } from '@gabriel-sisjr/react-native-background-location';

const { permissionStatus, requestPermissions, isRequesting } =
  useLocationPermissions();

// Check if location permissions are granted
if (permissionStatus.location.hasPermission) {
  // Ready to start tracking
}

// Request all permissions (location + notification)
const granted = await requestPermissions();
```

On Android, `requestPermissions()` handles the multi-step flow automatically:
1. Requests foreground location (fine + coarse)
2. Requests background location separately (Android 10+)
3. Requests notification permission (Android 13+)

On iOS, it handles the WhenInUse-to-Always escalation and notification authorization.

See the [Permissions guide](./permissions.md) for the full breakdown.

### 2. Start Tracking

The `useBackgroundLocation` hook provides tracking control with automatic session recovery:

```tsx
import {
  useBackgroundLocation,
  LocationAccuracy,
} from '@gabriel-sisjr/react-native-background-location';

const { startTracking, stopTracking, isTracking, tripId, locations } =
  useBackgroundLocation();

// Start with default options (auto-generated trip ID)
const id = await startTracking();

// Start with custom options
const id = await startTracking(undefined, {
  accuracy: LocationAccuracy.HIGH_ACCURACY,
  updateInterval: 5000,
  distanceFilter: 50,
});

// Start with a custom trip ID
const id = await startTracking('my-trip-123', {
  accuracy: LocationAccuracy.BALANCED_POWER_ACCURACY,
});
```

> **Note:** The hook automatically checks for an active tracking session on mount. If your app was killed and restarted, `isTracking` and `tripId` will reflect the recovered session.

### 3. Listen for Real-Time Updates

The `useLocationUpdates` hook provides event-driven location streaming:

```tsx
import { useLocationUpdates } from '@gabriel-sisjr/react-native-background-location';

const { locations, lastLocation, isTracking } = useLocationUpdates({
  onLocationUpdate: (location) => {
    console.log('Lat:', location.latitude, 'Lng:', location.longitude);
  },
  onLocationWarning: (warning) => {
    console.warn('Warning:', warning.type, warning.message);
  },
  onNotificationAction: (event) => {
    console.log('Notification action:', event.actionId);
  },
});
```

### 4. Retrieve Stored Locations

Locations are persisted to the device database. You can retrieve them at any time:

```tsx
import { getLocations } from '@gabriel-sisjr/react-native-background-location';

const locations = await getLocations('my-trip-123');

locations.forEach((loc) => {
  console.log({
    lat: parseFloat(loc.latitude),
    lng: parseFloat(loc.longitude),
    time: new Date(loc.timestamp),
    accuracy: loc.accuracy,
  });
});
```

> **Important:** `latitude` and `longitude` are returned as strings to preserve decimal precision. Always use `parseFloat()` when passing coordinates to map libraries.

### 5. Stop Tracking

```tsx
import { stopTracking } from '@gabriel-sisjr/react-native-background-location';

await stopTracking();
```

Or with the hook:

```tsx
const { stopTracking } = useBackgroundLocation();

await stopTracking();
```

### 6. Clean Up Trip Data

After uploading locations to your server, clean up local storage:

```tsx
import { clearTrip } from '@gabriel-sisjr/react-native-background-location';

await clearTrip('my-trip-123');
```

## Complete App Example

A more complete example with error handling, notification customization, and server upload:

```tsx
import React, { useEffect } from 'react';
import { View, Text, Button, Alert, StyleSheet } from 'react-native';
import {
  useLocationPermissions,
  useBackgroundLocation,
  useLocationUpdates,
  LocationAccuracy,
  NotificationPriority,
  type TrackingOptions,
} from '@gabriel-sisjr/react-native-background-location';

const TRACKING_OPTIONS: TrackingOptions = {
  accuracy: LocationAccuracy.HIGH_ACCURACY,
  updateInterval: 5000,
  fastestInterval: 3000,
  distanceFilter: 50,
  notificationOptions: {
    title: 'Trip Recording',
    text: 'Recording your route in the background',
    priority: NotificationPriority.LOW,
    channelName: 'Trip Tracking',
  },
};

export default function App() {
  const { permissionStatus, requestPermissions, isRequesting } =
    useLocationPermissions();

  const {
    startTracking,
    stopTracking,
    isTracking,
    tripId,
    locations,
    error,
    clearError,
    refreshLocations,
    clearCurrentTrip,
  } = useBackgroundLocation({
    onTrackingStart: (id) => console.log('Tracking started:', id),
    onTrackingStop: () => console.log('Tracking stopped'),
    onError: (err) => Alert.alert('Tracking Error', err.message),
  });

  const { lastLocation } = useLocationUpdates({
    onLocationUpdate: (loc) => {
      console.log(`[${new Date(loc.timestamp).toISOString()}]`,
        loc.latitude, loc.longitude);
    },
    onLocationWarning: (warning) => {
      console.warn(`[${warning.type}] ${warning.message}`);
    },
  });

  // Show errors
  useEffect(() => {
    if (error) {
      Alert.alert('Error', error.message, [
        { text: 'Dismiss', onPress: clearError },
      ]);
    }
  }, [error, clearError]);

  const handleToggleTracking = async () => {
    if (isTracking) {
      await stopTracking();
    } else {
      await startTracking(undefined, TRACKING_OPTIONS);
    }
  };

  const handleUploadAndClear = async () => {
    if (!tripId || locations.length === 0) return;

    try {
      // Upload to your server
      await fetch('https://your-api.com/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tripId,
          locations: locations.map((loc) => ({
            latitude: parseFloat(loc.latitude),
            longitude: parseFloat(loc.longitude),
            timestamp: loc.timestamp,
          })),
        }),
      });

      await clearCurrentTrip();
      Alert.alert('Success', 'Trip data uploaded and cleared');
    } catch (err) {
      Alert.alert('Upload Failed', 'Please try again later');
    }
  };

  // Permission screen
  if (!permissionStatus.location.hasPermission) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Location Permission Required</Text>
        <Button
          title={isRequesting ? 'Requesting...' : 'Grant Permissions'}
          onPress={requestPermissions}
          disabled={isRequesting}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {isTracking ? 'Tracking Active' : 'Ready'}
      </Text>

      {tripId && <Text style={styles.info}>Trip: {tripId}</Text>}
      <Text style={styles.info}>Points: {locations.length}</Text>

      {lastLocation && (
        <Text style={styles.info}>
          Last: {lastLocation.latitude}, {lastLocation.longitude}
        </Text>
      )}

      <View style={styles.buttonGroup}>
        <Button
          title={isTracking ? 'Stop' : 'Start'}
          onPress={handleToggleTracking}
        />

        {isTracking && (
          <Button title="Refresh" onPress={refreshLocations} />
        )}

        {!isTracking && locations.length > 0 && (
          <Button title="Upload & Clear" onPress={handleUploadAndClear} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20 },
  title: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 16 },
  info: { fontSize: 14, textAlign: 'center', marginBottom: 8 },
  buttonGroup: { marginTop: 20, gap: 12 },
});
```

## Quick Tips

### Distance Filter for Battery Efficiency

Set `distanceFilter` to reduce battery usage by only recording locations when the device has moved a minimum distance:

| Use Case | Recommended Distance Filter |
|---|---|
| Walking / running | 10 -- 25 meters |
| Driving | 50 -- 100 meters |
| Stationary with movement detection | 5 -- 10 meters |

### Callback Throttling

Use `onUpdateInterval` in hooks to throttle expensive operations (like server sync) without affecting location collection frequency:

```tsx
const { locations } = useLocationUpdates({
  onUpdateInterval: 30000, // Callback fires every 30 seconds
  onLocationUpdate: async (location) => {
    // Expensive server sync -- only called every 30s
    await syncToServer(location);
  },
});
```

Locations are still collected at the native `updateInterval` rate and stored locally.

### Simplified API (v0.8.0+)

The v0.8.0 API is cleaner with auto-generated trip IDs -- no need to generate UUIDs yourself:

```tsx
import { startTracking } from '@gabriel-sisjr/react-native-background-location';

// Before (v0.7.x) -- manual trip ID required
const tripId = uuid.v4();
await startTracking(tripId, options);

// After (v0.8.0+) -- auto-generated trip ID
const tripId = await startTracking(options);
```

### Foreground-Only Mode

If your app does not need background tracking, skip the background location permission entirely:

```tsx
const id = await startTracking(undefined, {
  foregroundOnly: true,
});
```

### Coordinates are Strings

Coordinates are returned as strings to preserve full decimal precision across the TurboModule bridge. Always parse when using with map libraries:

```tsx
// Correct
<MapView.Marker
  coordinate={{
    latitude: parseFloat(location.latitude),
    longitude: parseFloat(location.longitude),
  }}
/>
```

## Testing

### On Android Device

1. Run on a real Android device (recommended)
2. Grant all location permissions when prompted
3. Start tracking and minimize the app
4. Move around with your device
5. Open the app and check collected locations

### On iOS Device

1. Run on a real iOS device (recommended) or use the Simulator with location simulation
2. Grant "While Using" location permission, then grant "Always" when prompted
3. Start tracking and minimize the app
4. Move around with your device
5. Open the app and check collected locations

### On Emulator / Simulator

- **Android Emulator:** Use the extended controls (three dots) to set GPS coordinates or simulate routes
- **iOS Simulator:** Use Debug > Location > Custom Location or set a GPX file in your Xcode scheme

:::warning
Background tracking behavior is difficult to test accurately on emulators. Always validate on a physical device before release.
:::

### Testing Notes

- **Always test on a real device** -- emulator/simulator GPS is unreliable
- **Android:** Background permission is critical for Android 10+
- **Android:** A foreground notification will appear when tracking is active
- **iOS:** A blue status bar indicator will appear when tracking in the background
- **iOS:** Use Xcode's location simulation (GPX files) for consistent test data
- **Battery usage** can be significant with high-frequency updates on both platforms

## Common Issues

| Problem | Cause | Fix |
|---|---|---|
| Not tracking in background (Android) | Missing `ACCESS_BACKGROUND_LOCATION` | Grant "Allow all the time" in settings |
| Not tracking in background (iOS) | Only "While Using" permission | Request "Always" via `requestPermissions()` |
| No locations captured | GPS disabled or poor signal | Enable GPS, test outdoors, wait a few seconds after starting |
| Build error after install (Android) | Stale caches | See Android clean build steps below |
| Build error after install (iOS) | Stale caches or pods | See iOS clean build steps below |

### Build Error Recovery

**Android:**

```bash
cd android && ./gradlew clean && cd ..
yarn start --reset-cache
yarn android
```

**iOS:**

```bash
cd ios && pod install && cd ..
yarn start --reset-cache
yarn example ios
```

## Next Steps

- [Permissions](./permissions.md) -- Deep dive into the cross-platform permission model
- [iOS Setup](./ios-setup.md) -- iOS-specific configuration
- [Hooks Guide](../api-reference/hooks/useBackgroundLocation.md) -- Complete hooks documentation with all options
- [Background Tracking Guide](../guides/background-tracking.md) -- Production patterns and best practices
- [Google Play Compliance](../production/google-play-compliance.md) -- Required steps before publishing to the Play Store
