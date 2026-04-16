---
sidebar_position: 3
title: useLocationUpdates
description: API reference for the useLocationUpdates hook — real-time location event streaming with warning and notification action listeners.
keywords:
  - react-native
  - background-location
  - hook
  - useLocationUpdates
  - real-time
  - location-events
  - NativeEventEmitter
---

# useLocationUpdates

Real-time location update streaming hook. Subscribes to native events via `NativeEventEmitter` and provides locations as they arrive, without requiring manual polling. Also supports warning events and notification action callbacks.

```ts
import { useLocationUpdates } from '@gabriel-sisjr/react-native-background-location';
```

**Platform:** Android and iOS

---

## Signature

```ts
function useLocationUpdates(
  options?: UseLocationUpdatesOptions
): UseLocationUpdatesResult
```

---

## Parameters

The hook accepts a single optional `UseLocationUpdatesOptions` object.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `tripId` | `string` | — | Specific trip ID to watch. If not provided, the hook watches updates for any active trip. |
| `onLocationUpdate` | `(location: Coords) => void` | — | Callback fired for each new location received |
| `onUpdateInterval` | `number` | `undefined` | Throttle interval in milliseconds for the `onLocationUpdate` callback. Locations are still collected and stored at the native update rate, but the callback is only executed at this interval. |
| `onLocationWarning` | `(warning: LocationWarningEvent) => void` | — | Callback fired for service warnings (SERVICE_TIMEOUT, TASK_REMOVED, LOCATION_UNAVAILABLE) |
| `onNotificationAction` | `(event: NotificationActionEvent) => void` | — | Callback fired when a notification action button is pressed |
| `autoLoad` | `boolean` | `true` | Whether to automatically load existing locations from the database on mount |

> **Note:** All callbacks are accessed via refs internally, so passing inline functions is safe and does not cause re-subscriptions.

---

## Return Value

Returns a `UseLocationUpdatesResult` object.

### State Properties

| Property | Type | Description |
|----------|------|-------------|
| `tripId` | `string \| null` | Current trip ID being watched |
| `isTracking` | `boolean` | Whether location tracking is currently active |
| `locations` | [`Coords[]`](../types.md#coords) | All locations received for the current trip, updated in real time as new locations arrive |
| `lastLocation` | [`Coords \| null`](../types.md#coords) | The most recently received location |
| `lastWarning` | [`LocationWarningEvent \| null`](../types.md#locationwarningevent) | The most recent warning from the location service |
| `isLoading` | `boolean` | Whether data is being loaded from the database |
| `error` | `Error \| null` | Last error that occurred |

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `clearError` | `() => void` | Reset the `error` state to `null` |
| `clearLocations` | `() => Promise<void>` | Clear all locations for the current trip from the database and reset the locations array |
| `refreshLocations` | `() => Promise<void>` | Manually reload locations from the database. Useful for pull-to-refresh or on-demand sync. No-op if no tripId is set. |

---

## Event Flow

The hook listens for three types of native events via `NativeEventEmitter`:

### 1. Location Updates (`onLocationUpdate`)

```
Native LocationService → SharedFlow → NativeEventEmitter → useLocationUpdates
```

Each location update:
1. Is filtered by `tripId` (if a specific trip is being watched)
2. Is appended to the `locations` array
3. Updates `lastLocation`
4. Fires the `onLocationUpdate` callback (subject to `onUpdateInterval` throttling)

### 2. Warning Events (`onLocationWarning`)

```
Native LocationService → SharedFlow → NativeEventEmitter → useLocationUpdates
```

Warning events are non-critical notifications about service state changes. They do not stop tracking.

| Warning Type | Meaning |
|-------------|---------|
| `SERVICE_TIMEOUT` | Android 15+ foreground service timeout reached; service is restarting |
| `TASK_REMOVED` | App was swiped from recents; tracking continues in background |
| `LOCATION_UNAVAILABLE` | GPS signal lost or location services disabled |

### 3. Notification Actions (`onNotificationAction`)

```
User taps notification button → BroadcastReceiver → SharedFlow → NativeEventEmitter → useLocationUpdates
```

Fired when the user taps an action button on the foreground service notification.

---

## Hydration and Foreground Resume

### Mount Hydration

When the component mounts (and `autoLoad` is `true`), the hook:

1. Checks current tracking status
2. Loads existing locations from the database for the active trip (one-time operation)
3. Subscribes to real-time updates

This one-time DB read avoids the stale-data problem caused by batched database writes. After hydration, only real-time `NativeEventEmitter` events update the `locations` array.

### Foreground Resume

When the app returns to the foreground (from background or inactive state), the hook re-loads locations from the database. This covers the scenario where the JS thread was destroyed (Activity/process killed) and real-time events were lost.

### Manual Refresh

Call `refreshLocations()` for on-demand database sync, such as pull-to-refresh scenarios. This resets internal cleared-state tracking and performs a fresh DB read.

---

## Usage

### Real-time location display

```tsx
import { useLocationUpdates } from '@gabriel-sisjr/react-native-background-location';

function LiveTrackingMap() {
  const {
    locations,
    lastLocation,
    isTracking,
    lastWarning,
  } = useLocationUpdates({
    onLocationUpdate: (location) => {
      console.log('New location:', location.latitude, location.longitude);
    },
    onLocationWarning: (warning) => {
      console.warn(`[${warning.type}] ${warning.message}`);
    },
  });

  return (
    <View>
      <Text>Tracking: {isTracking ? 'Active' : 'Inactive'}</Text>
      <Text>Locations collected: {locations.length}</Text>
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

### Throttled server sync

```tsx
function ServerSyncTracker() {
  const { locations } = useLocationUpdates({
    onLocationUpdate: (location) => {
      // This callback fires at most every 30 seconds
      api.syncLocation(location);
    },
    onUpdateInterval: 30000, // 30 seconds
  });

  return <Text>{locations.length} locations recorded</Text>;
}
```

### Notification action handling

```tsx
function TrackingWithActions() {
  const { isTracking } = useLocationUpdates({
    onNotificationAction: (event) => {
      switch (event.actionId) {
        case 'pause':
          // Handle pause action
          break;
        case 'stop':
          stopTracking();
          break;
      }
    },
  });

  return <Text>{isTracking ? 'Active' : 'Stopped'}</Text>;
}
```

### Watching a specific trip

```tsx
function TripViewer({ tripId }: { tripId: string }) {
  const { locations, lastLocation, refreshLocations } = useLocationUpdates({
    tripId,
    autoLoad: true,
  });

  return (
    <View>
      <Text>Trip {tripId}: {locations.length} points</Text>
      <Button title="Refresh" onPress={refreshLocations} />
    </View>
  );
}
```

### All callbacks combined

```tsx
function FullFeatureTracker() {
  const {
    locations,
    lastLocation,
    lastWarning,
    isTracking,
    error,
    clearError,
    clearLocations,
    refreshLocations,
  } = useLocationUpdates({
    onLocationUpdate: (location) => {
      console.log('Location:', location);
    },
    onLocationWarning: (warning) => {
      if (warning.type === 'LOCATION_UNAVAILABLE') {
        showAlert('GPS signal lost');
      }
    },
    onNotificationAction: (event) => {
      console.log('Action pressed:', event.actionId);
    },
    onUpdateInterval: 5000,
    autoLoad: true,
  });

  // Component renders with all data available
}
```
