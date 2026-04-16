---
sidebar_position: 1
title: Background Location Tracking
description: Complete guide to background location tracking lifecycle — starting and stopping trips, configuring TrackingOptions, managing trip IDs, distance filters, and retrieving stored locations.
keywords:
  - background location
  - tracking
  - trip management
  - TrackingOptions
  - startTracking
  - stopTracking
  - distance filter
  - React Native
---

# Background Location Tracking

This guide covers the full lifecycle of background location tracking: starting and stopping trips, configuring accuracy and intervals, managing trip IDs, retrieving stored locations, and clearing trip data.

## Overview

Background location tracking collects GPS coordinates while the app is in the background. On Android, a foreground service with a persistent notification keeps the tracking alive. On iOS, `CLLocationManager` delivers updates in the background with the system-managed blue status bar indicator.

There are two approaches to using the tracking API:

- **Hook-based** (`useBackgroundLocation`) -- Manages state, loading, and error handling for you.
- **Direct API** (`startTracking`, `stopTracking`, `getLocations`, etc.) -- Lower-level functions for custom integrations.

## Starting a Trip

### Using the Hook

The `useBackgroundLocation` hook provides a complete interface for tracking management.

```typescript
import {
  useBackgroundLocation,
  LocationAccuracy,
  NotificationPriority,
} from '@gabriel-sisjr/react-native-background-location';

function TrackingScreen() {
  const {
    isTracking,
    tripId,
    locations,
    isLoading,
    error,
    startTracking,
    stopTracking,
    refreshLocations,
    clearCurrentTrip,
    clearError,
  } = useBackgroundLocation({
    onTrackingStart: (id) => console.log('Started tracking:', id),
    onTrackingStop: () => console.log('Stopped tracking'),
    onError: (err) => console.error('Error:', err),
  });

  return (
    <View>
      <Text>Status: {isTracking ? 'Tracking' : 'Stopped'}</Text>
      {tripId && <Text>Trip ID: {tripId}</Text>}
      <Text>Locations: {locations.length}</Text>

      <Button
        title={isTracking ? 'Stop Tracking' : 'Start Tracking'}
        onPress={isTracking ? stopTracking : () => startTracking()}
        disabled={isLoading}
      />

      {isTracking && (
        <Button title="Refresh Locations" onPress={refreshLocations} />
      )}

      {error && (
        <View>
          <Text>Error: {error.message}</Text>
          <Button title="Dismiss" onPress={clearError} />
        </View>
      )}
    </View>
  );
}
```

### Using the Direct API

For cases where you need more control, use the functions directly.

```typescript
import {
  startTracking,
  stopTracking,
  getLocations,
  clearTrip,
  isTracking,
} from '@gabriel-sisjr/react-native-background-location';

// Start a new trip (auto-generated UUID)
const tripId = await startTracking();

// Check if tracking is active
const status = await isTracking();
console.log(status.active, status.tripId);

// Retrieve stored locations
const locations = await getLocations(tripId);

// Stop tracking
await stopTracking();

// Clear trip data
await clearTrip(tripId);
```

## Trip ID Management

Every tracking session is identified by a trip ID. The library offers two strategies.

### Auto-Generated Trip IDs

When you call `startTracking()` without arguments, the library generates a UUID automatically. This is the recommended approach for new trips.

```typescript
// Library generates a UUID
const tripId = await startTracking();
console.log(tripId); // e.g., "550e8400-e29b-41d4-a716-446655440000"
```

### Custom Trip IDs

You can provide a custom trip ID when resuming an interrupted session. Only use this when you need to resume a trip that was previously started.

```typescript
// Resume an existing trip
const tripId = await startTracking('my-existing-trip-id');
```

> **Warning:** The `existingTripId` parameter in `startTracking()` is intended for resuming interrupted sessions only. For new trips, always let the library generate the ID.

### Overloaded `startTracking` Call

`startTracking` accepts either a `TrackingOptions` object directly, or a trip ID string followed by options.

```typescript
// Option 1: Pass options only (trip ID auto-generated)
const tripId = await startTracking({
  distanceFilter: 100,
  notificationOptions: {
    title: 'Delivery Active',
  },
});

// Option 2: Pass trip ID and options
const tripId = await startTracking('my-trip', {
  distanceFilter: 100,
});
```

## TrackingOptions Configuration

The `TrackingOptions` interface defines all available configuration for a tracking session.

```typescript
interface TrackingOptions {
  updateInterval?: number;        // Interval between updates (ms). Default: 5000
  fastestInterval?: number;       // Minimum interval (ms). Default: 3000
  maxWaitTime?: number;           // Max batch wait time (ms). Default: 10000
  accuracy?: LocationAccuracy;    // Accuracy level. Default: HIGH_ACCURACY
  waitForAccurateLocation?: boolean; // Wait for accurate fix. Default: false
  distanceFilter?: number;        // Min distance between updates (m). Default: 0
  notificationOptions?: NotificationOptions; // Android notification config
  foregroundOnly?: boolean;       // Skip background permission. Default: false
  onUpdateInterval?: number;      // Throttle callback interval (ms)
}
```

### Accuracy Levels

| Level | Description | Battery Impact |
|-------|-------------|----------------|
| `HIGH_ACCURACY` | GPS + sensors. Best for navigation and precise tracking. | High |
| `BALANCED_POWER_ACCURACY` | Network-based. Good for most use cases. | Medium |
| `LOW_POWER` | Cell tower / Wi-Fi. City-level accuracy. | Low |
| `NO_POWER` | Only when other apps request location. | None |
| `PASSIVE` | Receives updates from other apps. | None |

### Platform-Specific Behavior

| Option | Android | iOS | Notes |
|--------|---------|-----|-------|
| `accuracy` | All 5 levels | `HIGH_ACCURACY`, `BALANCED_POWER_ACCURACY`, `LOW_POWER` | iOS maps to `kCLLocationAccuracy*` |
| `updateInterval` | Used directly | Used as hint | iOS may deliver updates more frequently |
| `distanceFilter` | `setMinUpdateDistanceMeters` | `CLLocationManager.distanceFilter` | Works on both platforms |
| `foregroundOnly` | Skips background permission | Limits to WhenInUse | Both platforms |
| `notificationOptions` | Full customization | Ignored | iOS uses system blue bar instead |

> **iOS:** On iOS, the system manages background location behavior. There is no foreground service or notification -- the blue status bar indicator appears automatically when the app uses location in the background.

## Distance Filter

The `distanceFilter` option reduces battery consumption by only delivering location updates when the device has moved a minimum distance.

```typescript
import {
  startTracking,
  LocationAccuracy,
} from '@gabriel-sisjr/react-native-background-location';
import type { TrackingOptions } from '@gabriel-sisjr/react-native-background-location';

// High accuracy with distance filter -- ideal for delivery/navigation
const deliveryConfig: TrackingOptions = {
  accuracy: LocationAccuracy.HIGH_ACCURACY,
  updateInterval: 5000,
  distanceFilter: 25, // Only update if moved 25+ meters
};

// Low power with large distance filter -- for periodic check-ins
const checkInConfig: TrackingOptions = {
  accuracy: LocationAccuracy.BALANCED_POWER_ACCURACY,
  updateInterval: 60000,
  distanceFilter: 500, // Only update if moved 500+ meters
};

await startTracking(deliveryConfig);
```

### Recommended Values

| Use Case | Distance Filter | Accuracy | Update Interval |
|----------|----------------|----------|-----------------|
| Walking / fitness | 10-25 m | `HIGH_ACCURACY` | 5 sec |
| Driving / delivery | 25-100 m | `HIGH_ACCURACY` | 5-10 sec |
| City-level check-in | 200-500 m | `BALANCED_POWER_ACCURACY` | 60 sec |
| Regional monitoring | 500+ m | `LOW_POWER` | 120+ sec |

## Foreground-Only Mode

If your app does not need background tracking, enable `foregroundOnly` to skip the background location permission prompt.

```typescript
await startTracking({
  foregroundOnly: true,
  accuracy: LocationAccuracy.HIGH_ACCURACY,
  updateInterval: 3000,
});
```

When `foregroundOnly` is `true`:
- **Android:** Does not request `ACCESS_BACKGROUND_LOCATION`.
- **iOS:** Limits to `WhenInUse` authorization.

Tracking stops when the app goes to the background.

## Retrieving Stored Locations

Locations are persisted on-device (Room Database on Android, Core Data on iOS) and survive app restarts.

### Using the Hook

```typescript
const { locations, refreshLocations } = useBackgroundLocation();

// locations is automatically populated on mount
// Call refreshLocations() to fetch the latest from the database
await refreshLocations();
```

### Using the Direct API

```typescript
import { getLocations } from '@gabriel-sisjr/react-native-background-location';

const locations = await getLocations('my-trip-id');
console.log(`Retrieved ${locations.length} locations`);
```

### Location Data Structure

Each location is a `Coords` object with required and optional properties.

```typescript
interface Coords {
  latitude: string;          // Decimal degrees (string for precision)
  longitude: string;         // Decimal degrees (string for precision)
  timestamp: number;         // Milliseconds since Unix epoch

  // Optional extended properties
  accuracy?: number;         // Horizontal accuracy in meters
  altitude?: number;         // Altitude in meters
  speed?: number;            // Speed in meters per second
  bearing?: number;          // Bearing in degrees (0-360)
  verticalAccuracyMeters?: number;  // Android API 26+
  speedAccuracyMetersPerSecond?: number; // Android API 26+
  bearingAccuracyDegrees?: number;  // Android API 26+
  elapsedRealtimeNanos?: number;
  provider?: string;         // gps, network, passive, etc.
  isFromMockProvider?: boolean; // Android API 18+
}
```

> **Important:** Coordinates (`latitude`, `longitude`) are returned as strings, not numbers. Always parse them when using with map libraries.

```typescript
// Parse for map libraries
const numericCoords = {
  latitude: parseFloat(location.latitude),
  longitude: parseFloat(location.longitude),
};
```

## Clearing Trip Data

Remove stored locations for a trip when they are no longer needed.

### Using the Hook

```typescript
const { clearCurrentTrip } = useBackgroundLocation();

// Clears locations for the currently active trip
await clearCurrentTrip();
```

### Using the Direct API

```typescript
import { clearTrip } from '@gabriel-sisjr/react-native-background-location';

await clearTrip('my-trip-id');
```

## Auto-Start Tracking

The `useBackgroundLocation` hook supports auto-starting on mount.

```typescript
function AutoTrackingScreen() {
  const { isTracking, locations } = useBackgroundLocation({
    autoStart: true,
    options: {
      accuracy: LocationAccuracy.HIGH_ACCURACY,
      updateInterval: 5000,
      notificationOptions: {
        priority: NotificationPriority.LOW,
      },
    },
    onError: (error) => {
      Alert.alert('Error', error.message);
    },
  });

  return (
    <View>
      <Text>Auto-tracking: {isTracking ? 'Active' : 'Inactive'}</Text>
      <Text>Points collected: {locations.length}</Text>
    </View>
  );
}
```

## Complete Trip Management Example

```typescript
import {
  useBackgroundLocation,
  LocationAccuracy,
  NotificationPriority,
} from '@gabriel-sisjr/react-native-background-location';
import type { TrackingOptions } from '@gabriel-sisjr/react-native-background-location';

function TripManager() {
  const {
    isTracking,
    tripId,
    locations,
    startTracking,
    stopTracking,
    refreshLocations,
    clearCurrentTrip,
  } = useBackgroundLocation();

  const handleStartTrip = async () => {
    const options: TrackingOptions = {
      accuracy: LocationAccuracy.HIGH_ACCURACY,
      updateInterval: 5000,
      distanceFilter: 25,
      notificationOptions: {
        title: 'Trip Tracking',
        text: 'Tracking your trip in background',
        priority: NotificationPriority.LOW,
      },
    };

    const id = await startTracking(undefined, options);
    if (id) {
      console.log('Trip started:', id);
      // Save trip ID to your backend
      await saveTrip({ id, startedAt: Date.now() });
    }
  };

  const handleEndTrip = async () => {
    if (tripId) {
      // Upload locations before stopping
      await uploadLocations(tripId, locations);
      await clearCurrentTrip();
      await stopTracking();
    }
  };

  return (
    <View>
      <Button title="Start Trip" onPress={handleStartTrip} />
      {isTracking && (
        <>
          <Button title="Refresh" onPress={refreshLocations} />
          <Button title="End Trip" onPress={handleEndTrip} />
        </>
      )}
    </View>
  );
}
```

## Lightweight Status Monitoring

If you only need to display tracking status without managing the full lifecycle, use `useLocationTracking`.

```typescript
import { useLocationTracking } from '@gabriel-sisjr/react-native-background-location';

function StatusBadge() {
  const { isTracking, tripId } = useLocationTracking();

  return (
    <View>
      <Text>{isTracking ? 'Tracking' : 'Stopped'}</Text>
      {tripId && <Text>Trip: {tripId}</Text>}
    </View>
  );
}
```

This hook is much lighter than `useBackgroundLocation` and is ideal for header bars, status indicators, or any component that does not need tracking control.

## Memory Management

The `locations` array grows with each collected point. For long tracking sessions, implement cleanup strategies.

### Memory Estimates

| Duration | Interval | Points | Memory |
|----------|----------|--------|--------|
| 1 hour | 5 sec | ~720 | ~360 KB |
| 4 hours | 5 sec | ~2,880 | ~1.4 MB |
| 8 hours | 5 sec | ~5,760 | ~2.8 MB |

### Periodic Upload and Clear

```typescript
import {
  getLocations,
  clearTrip,
  useLocationUpdates,
} from '@gabriel-sisjr/react-native-background-location';

const BATCH_SIZE = 100;

useLocationUpdates({
  onLocationUpdate: async (location) => {
    const allLocations = await getLocations(tripId);
    if (allLocations.length >= BATCH_SIZE) {
      await uploadToServer(tripId, allLocations);
      await clearTrip(tripId);
      // Tracking continues with fresh storage
    }
  },
});
```

### Display Recent Only

```typescript
function RecentLocations({ locations }: { locations: Coords[] }) {
  const recent = locations.slice(-50);
  return <LocationList data={recent} />;
}
```

## Service Wrapper Pattern

For apps that prefer an imperative, class-based architecture over hooks, you can wrap the library's functions in a service class. This centralizes tracking logic, manages the current trip ID, and provides a single import point for the rest of your app.

```typescript
// services/LocationService.ts
import {
  startTracking as nativeStartTracking,
  stopTracking as nativeStopTracking,
  isTracking as nativeIsTracking,
  getLocations as nativeGetLocations,
  clearTrip as nativeClearTrip,
  type Coords,
} from '@gabriel-sisjr/react-native-background-location';

class LocationTrackingService {
  private currentTripId: string | null = null;

  async startTracking(customTripId?: string): Promise<string | null> {
    try {
      const tripId = await nativeStartTracking(customTripId);
      this.currentTripId = tripId;
      return tripId;
    } catch (error) {
      console.error('Failed to start tracking:', error);
      throw error;
    }
  }

  async stopTracking(): Promise<void> {
    try {
      await nativeStopTracking();
      this.currentTripId = null;
    } catch (error) {
      console.error('Failed to stop tracking:', error);
      throw error;
    }
  }

  async isTracking(): Promise<{ active: boolean; tripId?: string }> {
    return nativeIsTracking();
  }

  async getLocations(tripId?: string): Promise<Coords[]> {
    const id = tripId || this.currentTripId;
    if (!id) {
      throw new Error('No trip ID available');
    }
    return nativeGetLocations(id);
  }

  async clearTrip(tripId?: string): Promise<void> {
    const id = tripId || this.currentTripId;
    if (!id) {
      throw new Error('No trip ID available');
    }
    return nativeClearTrip(id);
  }

  getCurrentTripId(): string | null {
    return this.currentTripId;
  }
}

export default new LocationTrackingService();
```

Use the service from any component or non-React code:

```typescript
import LocationService from '../services/LocationService';

// Start tracking
const tripId = await LocationService.startTracking();

// Check status
const status = await LocationService.isTracking();

// Stop tracking
await LocationService.stopTracking();
```

> **When to use this pattern:** The service wrapper is useful when tracking logic is called from outside React components (background tasks, notification handlers, deep link processors) or when you want a single stateful entry point. For typical React screens, the hooks-based approach is simpler and recommended.

## Uploading Locations to a Server

After a trip ends, upload the collected locations to your backend and clear the local data to free storage. This pattern handles the full fetch-upload-cleanup flow with error handling.

```typescript
// services/LocationUploadService.ts
import {
  getLocations,
  clearTrip,
} from '@gabriel-sisjr/react-native-background-location';

export const uploadTripData = async (tripId: string): Promise<void> => {
  try {
    const locations = await getLocations(tripId);

    const response = await fetch('https://your-api.com/trips', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tripId,
        locations: locations.map((loc) => ({
          latitude: parseFloat(loc.latitude),
          longitude: parseFloat(loc.longitude),
          timestamp: loc.timestamp,
        })),
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to upload trip data');
    }

    // Clear local data only after successful upload
    await clearTrip(tripId);
  } catch (error) {
    console.error('Upload error:', error);
    throw error;
  }
};
```

Call the upload service after stopping a trip:

```typescript
import { uploadTripData } from '../services/LocationUploadService';

const handleEndTrip = async (tripId: string) => {
  await stopTracking();
  await uploadTripData(tripId);
};
```

> **Important:** Always `await stopTracking()` before calling `getLocations()`. The stop sequence flushes any buffered writes to the database, ensuring all collected points are available for upload.

## Best Practices

1. **Always check permissions first.** Use `useLocationPermissions` to request permissions before starting tracking. See the [Permission Handling](./permission-handling.md) guide.

2. **Handle errors.** Wrap tracking operations in try/catch or use the `onError` callback.

3. **Use the right hook for the job.** Use `useBackgroundLocation` for tracking control, `useLocationUpdates` for real-time visualization, and `useLocationTracking` for lightweight status display.

4. **Choose appropriate accuracy and intervals.** Higher accuracy means higher battery drain. See the [Battery Optimization](./battery-optimization.md) guide.

5. **Do not generate new trip IDs unnecessarily.** Check `isTracking()` on startup and resume existing sessions when appropriate. See the [Crash Recovery](./crash-recovery.md) guide.

## Next Steps

- [Real-Time Updates](./real-time-updates.md) -- Watch location updates as they arrive
- [Permission Handling](./permission-handling.md) -- Request and manage permissions
- [Notification Customization](./notification-customization.md) -- Configure the Android notification
- [Battery Optimization](./battery-optimization.md) -- Optimize for long tracking sessions
