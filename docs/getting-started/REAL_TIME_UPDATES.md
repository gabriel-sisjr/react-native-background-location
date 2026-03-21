# Real-Time Location Updates

This guide explains how to use the automatic real-time location update system on both Android and iOS.

## Overview

The library now offers two ways to receive location updates:

1. **Manual (useBackgroundLocation)**: Requires calling `refreshLocations()` to get the latest locations
2. **Automatic (useLocationUpdates)**: Receives real-time updates automatically

## useLocationUpdates Hook

The new `useLocationUpdates` hook allows you to "watch" location updates in real-time, without needing to manually call the refresh method.

### Features

- ✅ Automatic real-time updates
- ✅ Automatic loading of existing locations
- ✅ Callback for each new location received
- ✅ Filtering by specific tripId (optional)
- ✅ Access to the last received location
- ✅ Automatic event management

### Basic Usage

```typescript
import { useLocationUpdates } from '@gabriel-sisjr/react-native-background-location';

function LiveTrackingScreen() {
  const {
    locations,
    lastLocation,
    isTracking,
    tripId,
    isLoading,
    error,
  } = useLocationUpdates({
    onLocationUpdate: (location) => {
      console.log('New location:', location);
    },
  });

  return (
    <View>
      <Text>Status: {isTracking ? 'Tracking' : 'Stopped'}</Text>
      <Text>Locations collected: {locations.length}</Text>

      {lastLocation && (
        <>
          <Text>
            Last: {lastLocation.latitude}, {lastLocation.longitude}
          </Text>
          {lastLocation.accuracy !== undefined && (
            <Text>Accuracy: {lastLocation.accuracy.toFixed(2)} m</Text>
          )}
          {lastLocation.speed !== undefined && (
            <Text>Speed: {(lastLocation.speed * 3.6).toFixed(2)} km/h</Text>
          )}
        </>
      )}
    </View>
  );
}
```

### Available Options

#### `tripId` (optional)

Specifies a specific tripId to watch. If not provided, watches any active trip.

```typescript
useLocationUpdates({
  tripId: 'my-trip-123',
});
```

#### `onLocationUpdate` (optional)

Callback executed when a new location is received.

```typescript
useLocationUpdates({
  onLocationUpdate: (location) => {
    console.log('New location:', location);
    // Update map, send to server, etc.
  },
});
```

#### `autoLoad` (optional)

Defines whether to load existing locations when mounting the component. Default: `true`.

```typescript
useLocationUpdates({
  autoLoad: false, // Doesn't load existing locations
});
```

### Return Values

| Property         | Type                           | Description                          |
| ---------------- | ------------------------------ | ------------------------------------ |
| `tripId`         | `string \| null`               | ID of the trip being watched         |
| `isTracking`     | `boolean`                      | Whether tracking is active           |
| `locations`      | `Coords[]`                     | Array with all received locations    |
| `lastLocation`   | `Coords \| null`               | Last location received               |
| `lastWarning`    | `LocationWarningEvent \| null` | Last warning event (Android 14+/15+) |
| `isLoading`      | `boolean`                      | Whether data is being loaded         |
| `error`          | `Error \| null`                | Last error that occurred             |
| `clearError`     | `() => void`                   | Function to clear the error state    |
| `clearLocations` | `() => Promise<void>`          | Clear all locations for current trip |

### `onLocationWarning` Callback

Handle service warnings on both platforms:

> **Android:** Warnings include `SERVICE_TIMEOUT` (Android 15+), `TASK_REMOVED`, and `LOCATION_UNAVAILABLE`.

> **iOS:** Warnings include `PERMISSION_REVOKED` (user revoked location permission while tracking) and `PERMISSION_DOWNGRADED` (user downgraded from Always to WhenInUse).

```typescript
useLocationUpdates({
  onLocationWarning: (warning) => {
    console.log(`Warning [${warning.type}]: ${warning.message}`);
  },
});
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
      // Send to server in real-time
      sendToServer(location);

      // Update map marker
      updateMapMarker(location);
    },
  });

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <ErrorView
        error={error}
        onDismiss={clearError}
      />
    );
  }

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
          <Text>Latitude: {lastLocation.latitude}</Text>
          <Text>Longitude: {lastLocation.longitude}</Text>
          <Text>
            Time: {new Date(lastLocation.timestamp).toLocaleString()}
          </Text>
          {lastLocation.accuracy !== undefined && (
            <Text>Accuracy: {lastLocation.accuracy.toFixed(2)} m</Text>
          )}
          {lastLocation.altitude !== undefined && (
            <Text>Altitude: {lastLocation.altitude.toFixed(2)} m</Text>
          )}
          {lastLocation.speed !== undefined && (
            <Text>
              Speed: {(lastLocation.speed * 3.6).toFixed(2)} km/h
              {' '}({lastLocation.speed.toFixed(2)} m/s)
            </Text>
          )}
          {lastLocation.bearing !== undefined && (
            <Text>Bearing: {lastLocation.bearing.toFixed(2)}°</Text>
          )}
          {lastLocation.provider && (
            <Text>Provider: {lastLocation.provider}</Text>
          )}
        </View>
      )}

      <View style={styles.stats}>
        <Text>Total points: {locations.length}</Text>
      </View>

      {/* Render map with locations */}
      <MapView
        locations={locations}
        currentLocation={lastLocation}
      />
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
  stats: { padding: 16, borderTopWidth: 1, borderColor: '#ddd' },
});
```

## Combining with Tracking Control

You can combine `useLocationUpdates` with `useBackgroundLocation` for complete control:

```typescript
import React from 'react';
import {
  useLocationUpdates,
  useBackgroundLocation
} from '@gabriel-sisjr/react-native-background-location';

function AdvancedTrackingScreen() {
  // Controle de tracking (start/stop)
  const {
    startTracking,
    stopTracking,
    isTracking: controlIsTracking,
  } = useBackgroundLocation();

  // Real-time updates
  const {
    locations,
    lastLocation,
    isTracking: liveIsTracking,
  } = useLocationUpdates({
    onLocationUpdate: (location) => {
      console.log('New location:', location);
    },
  });

  return (
    <View>
      {!controlIsTracking ? (
        <Button title="Start Tracking" onPress={startTracking} />
      ) : (
        <Button title="Stop Tracking" onPress={stopTracking} />
      )}

      {liveIsTracking && lastLocation && (
        <>
          <Text>
            Last location: {lastLocation.latitude}, {lastLocation.longitude}
          </Text>
          {lastLocation.accuracy !== undefined && (
            <Text>Accuracy: {lastLocation.accuracy.toFixed(2)} m</Text>
          )}
          {lastLocation.speed !== undefined && (
            <Text>Speed: {(lastLocation.speed * 3.6).toFixed(2)} km/h</Text>
          )}
        </>
      )}

      <Text>Points collected: {locations.length}</Text>
    </View>
  );
}
```

## Differences Between Hooks

| Feature           | useBackgroundLocation | useLocationUpdates        |
| ----------------- | --------------------- | ------------------------- |
| Tracking control  | ✅ Yes                | ❌ No                     |
| Automatic updates | ❌ No                 | ✅ Yes                    |
| Manual refresh    | ✅ Yes                | ❌ Not needed             |
| Error management  | ✅ Complete           | ✅ Basic                  |
| Clear trip data   | ✅ Yes                | ✅ Yes (`clearLocations`) |
| Recommended use   | Tracking control      | Real-time visualization   |

## Best Practices

### 1. Use useLocationUpdates for visualization

```typescript
// ✅ Good: For screens that need to show data in real-time
function MapScreen() {
  const { locations, lastLocation } = useLocationUpdates();
  return <Map locations={locations} />;
}
```

### 2. Use useBackgroundLocation for control

```typescript
// ✅ Good: To control start/stop of tracking
function ControlPanel() {
  const { startTracking, stopTracking } = useBackgroundLocation();
  return <Controls onStart={startTracking} onStop={stopTracking} />;
}
```

### 3. Combine both for complete functionality

```typescript
// ✅ Best: Control + Real-time visualization
function CompleteScreen() {
  const tracking = useBackgroundLocation();
  const updates = useLocationUpdates();

  return (
    <>
      <Controls {...tracking} />
      <LiveMap {...updates} />
    </>
  );
}
```

### 4. Use callbacks for async actions

```typescript
// ✅ Good: Send data to server as it arrives
useLocationUpdates({
  onLocationUpdate: async (location) => {
    try {
      await api.sendLocation(location);
    } catch (error) {
      console.error('Error sending location:', error);
    }
  },
});
```

## Extended Location Properties

Location objects include extended properties from the platform-native location APIs. All properties are optional and only available when provided by the location provider.

### Available Properties

- `accuracy` - Horizontal accuracy in meters
- `altitude` - Altitude in meters above sea level
- `speed` - Speed in meters per second
- `bearing` - Bearing in degrees (0-360)
- `verticalAccuracyMeters` - Vertical accuracy (Android API 26+)
- `speedAccuracyMetersPerSecond` - Speed accuracy (Android API 26+)
- `bearingAccuracyDegrees` - Bearing accuracy (Android API 26+)
- `elapsedRealtimeNanos` - Elapsed realtime in nanoseconds
- `provider` - Location provider (gps, network, passive, etc.)
- `isFromMockProvider` - Whether from mock provider (Android API 18+)

### Example: Using Extended Properties in Real-Time Updates

```typescript
useLocationUpdates({
  onLocationUpdate: (location) => {
    // Basic properties (always available)
    console.log('Coordinates:', location.latitude, location.longitude);
    console.log('Timestamp:', new Date(location.timestamp).toLocaleString());

    // Extended properties (check for undefined)
    if (location.accuracy !== undefined) {
      console.log(`Accuracy: ${location.accuracy.toFixed(2)} meters`);
    }

    if (location.speed !== undefined) {
      const speedKmh = location.speed * 3.6;
      console.log(`Speed: ${speedKmh.toFixed(2)} km/h`);
    }

    if (location.altitude !== undefined) {
      console.log(`Altitude: ${location.altitude.toFixed(2)} meters`);
    }

    if (location.bearing !== undefined) {
      console.log(`Bearing: ${location.bearing.toFixed(2)}°`);
    }

    if (location.provider) {
      console.log(`Provider: ${location.provider}`);
    }
  },
});
```

### Best Practices

1. **Always check for undefined** before using optional properties
2. **Format values appropriately** (convert m/s to km/h, nanoseconds to milliseconds)
3. **Handle platform differences** (some properties require Android API 18+/26+ or iOS 15+)

## Handling Service Warnings

Both platforms emit warnings for different scenarios. On Android, foreground service time limits (Android 14+/15+) produce warnings. On iOS, permission changes while tracking produce warnings.

### Warning Types

| Type                    | Platform | Description                              | When It Occurs                                   |
| ----------------------- | -------- | ---------------------------------------- | ------------------------------------------------ |
| `SERVICE_TIMEOUT`       | Android  | Foreground service timeout reached       | Android 15+: ~6 hour limit for location services |
| `TASK_REMOVED`          | Android  | App was swiped from recents              | User action, tracking continues                  |
| `LOCATION_UNAVAILABLE`  | Both     | GPS signal lost or disabled              | Poor signal, location services off               |
| `PERMISSION_REVOKED`    | iOS      | User revoked location permission         | Settings change while tracking                   |
| `PERMISSION_DOWNGRADED` | iOS      | User downgraded from Always to WhenInUse | Settings change while tracking                   |

### Example: Handling All Warnings

```typescript
import { useLocationUpdates } from '@gabriel-sisjr/react-native-background-location';

function RobustTrackingScreen() {
  const {
    locations,
    lastLocation,
    lastWarning,
  } = useLocationUpdates({
    onLocationWarning: (warning) => {
      switch (warning.type) {
        case 'SERVICE_TIMEOUT':
          // Android 15+ foreground service timeout
          // The service automatically restarts, but you may want to inform the user
          console.log('Service restarting due to Android timeout policy');
          // Optionally: Show subtle notification to user
          break;

        case 'TASK_REMOVED':
          // User swiped app from recents
          // Tracking continues in background, but React context is gone
          console.log('App removed from recents - tracking continues');
          // No action needed - tracking persists
          break;

        case 'LOCATION_UNAVAILABLE':
          // GPS signal lost
          Alert.alert(
            'Location Unavailable',
            'GPS signal is weak. Please ensure:\n' +
            '• Location services are enabled\n' +
            '• You have a clear view of the sky\n' +
            '• Airplane mode is disabled',
            [{ text: 'OK' }]
          );
          break;
      }
    },
  });

  return (
    <View>
      {/* Show warning banner when active */}
      {lastWarning && lastWarning.type === 'LOCATION_UNAVAILABLE' && (
        <View style={styles.warningBanner}>
          <Text style={styles.warningText}>
            ⚠️ {lastWarning.message}
          </Text>
        </View>
      )}

      {/* Rest of your UI */}
    </View>
  );
}
```

## Memory Management

The `locations` array grows unbounded. For long tracking sessions, implement cleanup strategies:

### Memory Estimates

| Duration | Interval | Points  | Memory  |
| -------- | -------- | ------- | ------- |
| 1 hour   | 5 sec    | ~720    | ~360 KB |
| 4 hours  | 5 sec    | ~2,880  | ~1.4 MB |
| 8 hours  | 5 sec    | ~5,760  | ~2.8 MB |
| 24 hours | 5 sec    | ~17,280 | ~8.6 MB |

### Strategy: Periodic Upload and Clear

```typescript
const BATCH_SIZE = 100;

function TrackingWithUpload() {
  const { tripId, clearLocations } = useLocationUpdates({
    onLocationUpdate: async () => {
      if (!tripId) return;

      const locations = await BackgroundLocation.getLocations(tripId);

      if (locations.length >= BATCH_SIZE) {
        try {
          await uploadToServer(tripId, locations);
          await clearLocations();
          console.log('Uploaded and cleared', locations.length, 'locations');
        } catch (error) {
          console.error('Upload failed, will retry:', error);
        }
      }
    },
  });

  return <TrackingUI />;
}
```

### Strategy: Display Recent Only

```typescript
function LocationDisplay({ locations }: { locations: Coords[] }) {
  // Only show last 50 locations in the UI
  const recentLocations = locations.slice(-50);

  return (
    <FlatList
      data={recentLocations}
      keyExtractor={(_, i) => i.toString()}
      renderItem={({ item }) => <LocationItem location={item} />}
    />
  );
}
```

## Coordinate Format

> **Important:** Coordinates are returned as **strings** for precision.

Always parse for map libraries:

```typescript
// ✅ Correct
const numericCoord = {
  latitude: parseFloat(location.latitude),
  longitude: parseFloat(location.longitude),
};

// ✅ Helper
const toNumeric = (loc: Coords) => ({
  latitude: parseFloat(loc.latitude),
  longitude: parseFloat(loc.longitude),
});

// Usage
<Marker coordinate={toNumeric(lastLocation)} />
<Polyline coordinates={locations.map(toNumeric)} />
```

## Frequently Asked Questions

### Are locations persisted after app restart?

Yes. On Android, locations are stored in Room Database. On iOS, locations are stored in Core Data. Both persist between restarts.

### How many locations are stored?

All locations collected during a trip are stored until you call `clearTrip()`.

### How does the event system work?

The native module emits `onLocationUpdate` events whenever a new location is collected. The `useLocationUpdates` hook automatically subscribes to these events. This works identically on both Android and iOS.

### Does it work on iOS?

Yes. Real-time events work identically on both platforms. The native iOS implementation uses `CLLocationManager` delegate callbacks to emit location events through the same `NativeEventEmitter` interface.

### What happens if the app is in the background?

Locations continue to be collected on both platforms. Events are emitted but React Native will only process them when the app returns to the foreground. On Android, a foreground service keeps tracking alive. On iOS, the system manages background location delivery.

## Next Steps

- Read about [Hooks](./hooks.md)
- See the [Integration Guide](./INTEGRATION_GUIDE.md)
- Check out [Advanced Examples](../../example/README.md)
