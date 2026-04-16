---
sidebar_position: 1
title: useBackgroundLocation
description: API reference for the useBackgroundLocation hook — full background location tracking control with trip management, stored locations, and lifecycle callbacks.
keywords:
  - react-native
  - background-location
  - hook
  - useBackgroundLocation
  - tracking
  - trip-management
---

# useBackgroundLocation

Full-featured hook for managing background location tracking sessions. Provides start/stop control, trip data management, stored location access, and lifecycle callbacks.

```ts
import { useBackgroundLocation } from '@gabriel-sisjr/react-native-background-location';
```

**Platform:** Android and iOS

---

## Signature

```ts
function useBackgroundLocation(
  options?: UseLocationTrackingOptions
): UseBackgroundLocationResult
```

---

## Parameters

The hook accepts a single optional `UseLocationTrackingOptions` object.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `autoStart` | `boolean` | `false` | Automatically start tracking when the component mounts |
| `tripId` | `string` | — | Custom trip ID to use when `autoStart` is enabled |
| `options` | [`TrackingOptions`](../types.md#trackingoptions) | — | Tracking configuration options applied when `autoStart` triggers or as defaults for `startTracking()` |
| `onTrackingStart` | `(tripId: string) => void` | — | Callback fired when tracking starts successfully |
| `onTrackingStop` | `() => void` | — | Callback fired when tracking stops |
| `onError` | `(error: Error) => void` | — | Callback fired when an error occurs |

> **Note:** Callbacks passed as inline functions are safe. The hook uses refs internally to avoid unnecessary re-renders or re-subscriptions when callback identity changes.

---

## Return Value

Returns a `UseBackgroundLocationResult` object.

### State Properties

| Property | Type | Description |
|----------|------|-------------|
| `tripId` | `string \| null` | Current trip ID if tracking is active, `null` otherwise |
| `isTracking` | `boolean` | Whether location tracking is currently active |
| `locations` | [`Coords[]`](../types.md#coords) | All locations collected for the current trip |
| `isLoading` | `boolean` | Whether an async operation is in progress (start, stop, refresh, clear) |
| `error` | `Error \| null` | Last error that occurred, or `null` |

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `startTracking` | `(customTripId?: string, options?: TrackingOptions) => Promise<string \| null>` | Start tracking. Returns the effective tripId on success, `null` on failure. |
| `stopTracking` | `() => Promise<void>` | Stop tracking and terminate the background service. |
| `refreshLocations` | `() => Promise<void>` | Reload locations from the local database for the current trip. No-op if no tripId is set. |
| `clearCurrentTrip` | `() => Promise<void>` | Clear all stored location data for the current trip. No-op if no tripId is set. |
| `clearError` | `() => void` | Reset the `error` state to `null`. |

---

## Behavior Details

### Mount Hydration

On mount, the hook checks the current tracking status by calling `isTracking()` on the native module. If tracking is already active, it:

1. Sets `isTracking` to `true`
2. Sets `tripId` to the active trip ID
3. Loads existing locations from the database

This means the hook picks up ongoing tracking sessions even when a component remounts.

### Auto-Start

When `autoStart` is `true`, the hook calls `startTracking()` on mount if tracking is not already active. It uses the `tripId` and `options` from the hook parameters.

### startTracking Options

When calling `startTracking(customTripId, options)`:
- The `options` parameter overrides the hook-level `options` if both are provided
- If neither is provided, native defaults apply
- The `customTripId` is optional; if omitted, the native module auto-generates one

### Error Handling

- Errors from `startTracking`, `stopTracking`, `refreshLocations`, and `clearCurrentTrip` are captured in the `error` state
- The `onError` callback is also fired when errors occur
- `stopTracking` re-throws the error after capturing it, allowing callers to handle it inline if preferred
- `startTracking` returns `null` on failure instead of throwing

---

## Usage

### Basic tracking control

```tsx
import { useBackgroundLocation } from '@gabriel-sisjr/react-native-background-location';

function TrackingScreen() {
  const {
    isTracking,
    tripId,
    locations,
    isLoading,
    error,
    startTracking,
    stopTracking,
  } = useBackgroundLocation({
    onTrackingStart: (id) => console.log('Started trip:', id),
    onTrackingStop: () => console.log('Tracking stopped'),
    onError: (err) => console.error('Tracking error:', err),
  });

  const handleToggle = async () => {
    if (isTracking) {
      await stopTracking();
    } else {
      await startTracking();
    }
  };

  return (
    <View>
      <Text>Status: {isTracking ? 'Tracking' : 'Stopped'}</Text>
      {tripId && <Text>Trip: {tripId}</Text>}
      <Text>Locations: {locations.length}</Text>
      {error && <Text>Error: {error.message}</Text>}
      <Button
        title={isTracking ? 'Stop' : 'Start'}
        onPress={handleToggle}
        disabled={isLoading}
      />
    </View>
  );
}
```

### Auto-start with options

```tsx
function AutoTrackingScreen() {
  const { isTracking, locations } = useBackgroundLocation({
    autoStart: true,
    options: {
      accuracy: LocationAccuracy.HIGH_ACCURACY,
      updateInterval: 10000,
      notificationOptions: {
        title: 'Trip Recording',
        text: 'Your route is being recorded',
      },
    },
    onTrackingStart: (tripId) => {
      // Send tripId to your backend
      api.createTrip(tripId);
    },
  });

  return (
    <View>
      <Text>Recording: {locations.length} points</Text>
    </View>
  );
}
```

### Trip data management

```tsx
function TripManager() {
  const {
    tripId,
    locations,
    refreshLocations,
    clearCurrentTrip,
    clearError,
    error,
  } = useBackgroundLocation();

  return (
    <View>
      <Button title="Refresh" onPress={refreshLocations} />
      <Button title="Clear Trip" onPress={clearCurrentTrip} />
      {error && (
        <View>
          <Text>{error.message}</Text>
          <Button title="Dismiss" onPress={clearError} />
        </View>
      )}
    </View>
  );
}
```

---

## Comparison with Other Hooks

| Feature | `useBackgroundLocation` | [`useLocationTracking`](./useLocationTracking.md) | [`useLocationUpdates`](./useLocationUpdates.md) |
|---------|------------------------|------------------------|-----------------------|
| Start/stop control | Yes | No | No |
| Stored locations | Yes (via refresh) | No | Yes (real-time + DB) |
| Real-time events | No | No | Yes |
| Trip management | Yes | No | Yes |
| Warning events | No | No | Yes |
| Auto-start | Yes | N/A | N/A |
| Lightweight | No | Yes | No |

Use `useBackgroundLocation` when you need full control over the tracking lifecycle. Use [`useLocationTracking`](./useLocationTracking.md) when you only need to observe status. Use [`useLocationUpdates`](./useLocationUpdates.md) when you need real-time location events.
