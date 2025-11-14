# Real-Time Location Updates

This guide explains how to use the new automatic real-time location update system.

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
  tripId: 'my-trip-123'
});
```

#### `onLocationUpdate` (optional)
Callback executed when a new location is received.

```typescript
useLocationUpdates({
  onLocationUpdate: (location) => {
    console.log('New location:', location);
    // Update map, send to server, etc.
  }
});
```

#### `autoLoad` (optional)
Defines whether to load existing locations when mounting the component. Default: `true`.

```typescript
useLocationUpdates({
  autoLoad: false // Doesn't load existing locations
});
```

### Return Values

| Property | Type | Description |
|----------|------|-------------|
| `tripId` | `string \| null` | ID of the trip being watched |
| `isTracking` | `boolean` | Whether tracking is active |
| `locations` | `Coords[]` | Array with all received locations |
| `lastLocation` | `Coords \| null` | Last location received |
| `isLoading` | `boolean` | Whether data is being loaded |
| `error` | `Error \| null` | Last error that occurred |
| `clearError` | `() => void` | Function to clear the error state |

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

| Feature | useBackgroundLocation | useLocationUpdates |
|---------|----------------------|-------------------|
| Tracking control | ✅ Yes | ❌ No |
| Automatic updates | ❌ No | ✅ Yes |
| Manual refresh | ✅ Yes | ❌ Not needed |
| Error management | ✅ Complete | ✅ Basic |
| Clear trip data | ✅ Yes | ❌ No |
| Recommended use | Tracking control | Real-time visualization |

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
  }
});
```

## Extended Location Properties

Starting from version 0.5.0, location objects include extended properties from the Android location API. All properties are optional and only available when provided by the location provider.

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
  }
});
```

### Best Practices

1. **Always check for undefined** before using optional properties
2. **Format values appropriately** (convert m/s to km/h, nanoseconds to milliseconds)
3. **Handle API-level differences** (some properties require Android API 18+ or 26+)

## Frequently Asked Questions

### Are locations persisted after app restart?
Yes, locations are stored in SharedPreferences (Android) and persist between restarts.

### How many locations are stored?
All locations collected during a trip are stored until you call `clearTrip()`.

### How does the event system work?
The native module emits `onLocationUpdate` events whenever a new location is collected. The `useLocationUpdates` hook automatically subscribes to these events.

### Can I use it on iOS?
Currently, the event implementation is only available for Android. iOS support will be added soon.

### What happens if the app is in the background?
Locations continue to be collected and events are emitted, but React Native will only process them when the app returns to the foreground.

## Next Steps

- Read about [Hooks](./hooks.md)
- See the [Integration Guide](./INTEGRATION_GUIDE.md)
- Check out [Advanced Examples](../../example/README.md)

