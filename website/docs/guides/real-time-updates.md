---
sidebar_position: 2
title: Real-Time Location Updates
description: Guide to using the useLocationUpdates hook for real-time location streaming via NativeEventEmitter, callback throttling, foreground re-hydration, and warning handling.
keywords:
  - real-time updates
  - useLocationUpdates
  - NativeEventEmitter
  - location streaming
  - onLocationUpdate
  - onUpdateInterval
  - live tracking
  - React Native
---

# Real-Time Location Updates

This guide covers the `useLocationUpdates` hook, which provides an automatic real-time location event stream without requiring manual refresh.

## Overview

The library offers two ways to receive location updates:

| Approach | Hook | Updates | Use Case |
|----------|------|---------|----------|
| Manual | `useBackgroundLocation` | Call `refreshLocations()` to pull from DB | Tracking control (start/stop) |
| Automatic | `useLocationUpdates` | Real-time via `NativeEventEmitter` | Live visualization, server sync |

`useLocationUpdates` subscribes to native location events and accumulates them in state. You never need to poll -- new locations appear automatically as they are collected by the background service.

## Basic Usage

```typescript
import { useLocationUpdates } from '@gabriel-sisjr/react-native-background-location';

function LiveTrackingScreen() {
  const {
    locations,
    lastLocation,
    lastWarning,
    isTracking,
    tripId,
    isLoading,
    error,
    clearError,
    clearLocations,
    refreshLocations,
  } = useLocationUpdates({
    onLocationUpdate: (location) => {
      console.log('New location:', location);
    },
    onLocationWarning: (warning) => {
      console.log('Warning:', warning.type, warning.message);
    },
  });

  return (
    <View>
      <Text>Status: {isTracking ? 'Tracking' : 'Stopped'}</Text>
      <Text>Locations: {locations.length}</Text>
      {lastLocation && (
        <Text>
          Last: {lastLocation.latitude}, {lastLocation.longitude}
        </Text>
      )}
      {lastWarning && (
        <Text style={{ color: 'orange' }}>
          Warning: {lastWarning.message}
        </Text>
      )}
    </View>
  );
}
```

## Options

```typescript
interface UseLocationUpdatesOptions {
  // Specific trip ID to watch (optional -- watches any active trip if omitted)
  tripId?: string;

  // Callback when a new location is received
  onLocationUpdate?: (location: Coords) => void;

  // Throttle interval for the onLocationUpdate callback (ms)
  // Locations are still collected at the updateInterval rate,
  // but the callback fires at most once per this interval.
  onUpdateInterval?: number;

  // Callback when a service warning is emitted
  onLocationWarning?: (warning: LocationWarningEvent) => void;

  // Callback when a notification action button is pressed
  onNotificationAction?: (event: NotificationActionEvent) => void;

  // Whether to automatically load existing locations on mount (default: true)
  autoLoad?: boolean;
}
```

## Return Values

| Property | Type | Description |
|----------|------|-------------|
| `tripId` | `string \| null` | ID of the trip being watched |
| `isTracking` | `boolean` | Whether tracking is active |
| `locations` | `Coords[]` | All locations received (updates automatically) |
| `lastLocation` | `Coords \| null` | Most recent location |
| `lastWarning` | `LocationWarningEvent \| null` | Most recent warning event |
| `isLoading` | `boolean` | Whether data is being loaded |
| `error` | `Error \| null` | Last error that occurred |
| `clearError` | `() => void` | Clear the error state |
| `clearLocations` | `() => Promise<void>` | Clear all locations for the current trip |
| `refreshLocations` | `() => Promise<void>` | Manually reload locations from the database |

## The `onLocationUpdate` Callback

This callback fires every time a new location is received from the native event emitter.

```typescript
useLocationUpdates({
  onLocationUpdate: (location) => {
    // Update a map marker
    updateMapMarker(location);

    // Send to server
    sendToServer(location);
  },
});
```

The callback receives the full `Coords` object with all available properties (accuracy, altitude, speed, bearing, etc.).

## Throttling with `onUpdateInterval`

Use `onUpdateInterval` to control how often the `onLocationUpdate` callback executes, without changing the underlying location collection rate.

```typescript
// Locations collected every 5 seconds, but callback fires every 30 seconds
useLocationUpdates({
  onLocationUpdate: async (location) => {
    // Called at most once every 30 seconds
    await syncLocationToServer(location);
  },
  onUpdateInterval: 30000,
});
```

This is useful when you want frequent location data in the `locations` array for map rendering, but only need periodic server sync.

```typescript
function ThrottledSync() {
  const [syncCount, setSyncCount] = useState(0);

  const { locations } = useLocationUpdates({
    onLocationUpdate: async (location) => {
      // Called every 60 seconds, not every 5 seconds
      await uploadToServer(location);
      setSyncCount((prev) => prev + 1);
    },
    onUpdateInterval: 60000,
  });

  return (
    <View>
      <Text>Total locations: {locations.length}</Text>
      <Text>Server syncs: {syncCount}</Text>
    </View>
  );
}
```

> **Note:** Throttling only affects the callback execution. The `locations` array and `lastLocation` state still update on every received event.

## Auto-Load and Mount Hydration

When `autoLoad` is `true` (the default), the hook performs a one-time database read on mount to populate `locations` with any locations already collected before the component mounted. This is called mount hydration.

```typescript
// Default: loads existing locations on mount
useLocationUpdates();

// Skip initial load -- start with an empty locations array
useLocationUpdates({ autoLoad: false });
```

After the initial hydration, the hook does **not** poll the database. All subsequent updates come through `NativeEventEmitter` events, which avoids overwriting real-time data with potentially stale batched-write database content.

## Foreground Resume Re-Hydration

When the app returns to the foreground after being backgrounded, the hook automatically re-reads locations from the database. This covers the scenario where the JS thread was destroyed (Activity/process killed) but the native service continued collecting locations.

The re-hydration happens automatically via `AppState` change detection:

- App transitions from `background` or `inactive` to `active`
- A trip ID is currently set
- `autoLoad` is `true`
- Locations have not been explicitly cleared

## Manual Refresh with `refreshLocations`

You can manually trigger a database read at any time using `refreshLocations()`.

```typescript
const { refreshLocations, locations } = useLocationUpdates();

// Manually reload from the database
const handleRefresh = async () => {
  await refreshLocations();
  console.log('Reloaded', locations.length, 'locations');
};
```

This also resets the internal "cleared" flag, allowing future auto re-hydrations to proceed.

## Warning Events

Both platforms emit warnings for non-critical issues that do not stop tracking.

### Warning Types

| Type | Platform | Description | Action |
|------|----------|-------------|--------|
| `SERVICE_TIMEOUT` | Android 15+ | Foreground service timeout reached | Service auto-restarts, no action needed |
| `TASK_REMOVED` | Android | App swiped from recents | Tracking continues, inform user if needed |
| `LOCATION_UNAVAILABLE` | Both | GPS signal lost or disabled | Prompt user to check settings |
| `PERMISSION_REVOKED` | iOS | User revoked location permission | Guide user to Settings |
| `PERMISSION_DOWNGRADED` | iOS | User downgraded from Always to WhenInUse | Guide user to Settings |

### Handling Warnings

```typescript
useLocationUpdates({
  onLocationWarning: (warning) => {
    switch (warning.type) {
      case 'SERVICE_TIMEOUT':
        // Android 15+: service hit time limit, auto-restarts
        console.log('Service restarting due to Android timeout');
        break;

      case 'TASK_REMOVED':
        // User swiped app from recents
        console.log('App removed from recents, tracking continues');
        break;

      case 'LOCATION_UNAVAILABLE':
        Alert.alert(
          'Location Unavailable',
          'Please ensure GPS is enabled and you have a clear view of the sky.'
        );
        break;
    }
  },
});
```

### Displaying Warning Banners

```typescript
function TrackingWithWarnings() {
  const { lastWarning } = useLocationUpdates({
    onLocationWarning: (warning) => {
      // Log for analytics
      logAnalytics('location_warning', { type: warning.type });
    },
  });

  return (
    <View>
      {lastWarning && (
        <View style={styles.warningBanner}>
          <Text>{lastWarning.message}</Text>
          <Text>{new Date(lastWarning.timestamp).toLocaleString()}</Text>
        </View>
      )}
    </View>
  );
}
```

## Notification Action Buttons

Listen for presses on notification action buttons added to the tracking notification.

```typescript
import {
  startTracking,
  stopTracking,
  useLocationUpdates,
} from '@gabriel-sisjr/react-native-background-location';
import type { NotificationActionEvent } from '@gabriel-sisjr/react-native-background-location';

function TrackingWithActions() {
  const { locations } = useLocationUpdates({
    onNotificationAction: (event: NotificationActionEvent) => {
      switch (event.actionId) {
        case 'stop':
          stopTracking();
          break;
        case 'emergency':
          callEmergencyService();
          break;
      }
    },
  });

  const startWithActions = async () => {
    await startTracking('trip-123', {
      notificationOptions: {
        title: 'Delivery in Progress',
        text: 'En route to destination',
        actions: [
          { id: 'stop', label: 'Stop' },
          { id: 'emergency', label: 'Emergency' },
        ],
      },
    });
  };

  return (
    <View>
      <Button title="Start" onPress={startWithActions} />
      <Text>Locations: {locations.length}</Text>
    </View>
  );
}
```

## Combining with Tracking Control

`useLocationUpdates` does not provide start/stop control. Combine it with `useBackgroundLocation` for a complete solution.

```typescript
import {
  useBackgroundLocation,
  useLocationUpdates,
} from '@gabriel-sisjr/react-native-background-location';

function CompleteTracking() {
  // Control (start/stop)
  const { startTracking, stopTracking } = useBackgroundLocation();

  // Live updates
  const { locations, lastLocation } = useLocationUpdates({
    onLocationUpdate: (location) => {
      sendToServer(location);
    },
  });

  return (
    <View>
      <Button title="Start" onPress={() => startTracking()} />
      <Button title="Stop" onPress={stopTracking} />
      <Text>Points: {locations.length}</Text>
    </View>
  );
}
```

### Hook Comparison

| Feature | useBackgroundLocation | useLocationUpdates |
|---------|----------------------|-------------------|
| Tracking control (start/stop) | Yes | No |
| Automatic real-time updates | No | Yes |
| Manual refresh | Yes | Yes (`refreshLocations`) |
| Real-time event callbacks | No | Yes |
| Clear trip data | Yes | Yes (`clearLocations`) |
| Best for | Controlling tracking | Watching live data |

## Real-Time Map Example

```typescript
import { useLocationUpdates } from '@gabriel-sisjr/react-native-background-location';

function LiveMap() {
  const { locations, lastLocation } = useLocationUpdates();

  const toNumeric = (loc: Coords) => ({
    latitude: parseFloat(loc.latitude),
    longitude: parseFloat(loc.longitude),
  });

  return (
    <MapView>
      {locations.map((loc, index) => (
        <Marker key={index} coordinate={toNumeric(loc)} />
      ))}
      {lastLocation && (
        <Circle
          center={toNumeric(lastLocation)}
          radius={lastLocation.accuracy || 100}
        />
      )}
    </MapView>
  );
}
```

## Complete Example

```typescript
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLocationUpdates } from '@gabriel-sisjr/react-native-background-location';

export function LiveMapScreen() {
  const {
    locations,
    lastLocation,
    isTracking,
    tripId,
    isLoading,
    error,
    clearError,
  } = useLocationUpdates({
    onLocationUpdate: (location) => {
      sendToServer(location);
    },
    onLocationWarning: (warning) => {
      console.log(`Warning [${warning.type}]: ${warning.message}`);
    },
  });

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorView error={error} onDismiss={clearError} />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          Tracking {isTracking ? 'Active' : 'Inactive'}
        </Text>
        {tripId && <Text style={styles.tripId}>Trip: {tripId}</Text>}
      </View>

      {lastLocation && (
        <View style={styles.lastLocation}>
          <Text style={styles.label}>Last Location:</Text>
          <Text>Lat: {lastLocation.latitude}</Text>
          <Text>Lng: {lastLocation.longitude}</Text>
          <Text>
            Time: {new Date(lastLocation.timestamp).toLocaleString()}
          </Text>
          {lastLocation.accuracy !== undefined && (
            <Text>Accuracy: {lastLocation.accuracy.toFixed(2)} m</Text>
          )}
          {lastLocation.speed !== undefined && (
            <Text>
              Speed: {(lastLocation.speed * 3.6).toFixed(2)} km/h
            </Text>
          )}
        </View>
      )}

      <Text>Total points: {locations.length}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 16, backgroundColor: '#f5f5f5' },
  title: { fontSize: 20, fontWeight: 'bold' },
  tripId: { fontSize: 14, color: '#666', marginTop: 4 },
  lastLocation: {
    padding: 16,
    backgroundColor: '#e8f5e9',
    borderLeftWidth: 4,
    borderLeftColor: '#4caf50',
  },
  label: { fontWeight: 'bold', marginBottom: 8 },
});
```

## FAQ

**Are locations persisted after app restart?**
Yes. Android uses Room Database; iOS uses Core Data. Both persist between restarts.

**How does the event system work?**
The native module emits `onLocationUpdate` events whenever a new location is collected. The hook subscribes via `NativeEventEmitter`. This works identically on both Android and iOS.

**What happens when the app is in the background?**
Locations continue to be collected on both platforms. Events are emitted but React Native processes them when the app returns to the foreground. On Android, the foreground service keeps tracking alive. On iOS, the system manages background delivery.

**Do I need to call `refreshLocations()` periodically?**
No. The hook automatically receives real-time events and re-hydrates from the database on foreground resume. Manual refresh is only needed in special cases (e.g., after external database changes).

## Next Steps

- [Background Tracking](./background-tracking.md) -- Full tracking lifecycle and TrackingOptions
- [Notification Customization](./notification-customization.md) -- Configure action buttons and notification appearance
- [Battery Optimization](./battery-optimization.md) -- Manage memory and battery for long sessions
