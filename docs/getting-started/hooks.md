# React Hooks API

`react-native-background-location` provides React Hooks for easier integration and better developer experience.

## Overview

The library includes three main hooks:

1. **`useLocationPermissions`** - Manage location permissions
2. **`useBackgroundLocation`** - Full tracking management
3. **`useLocationTracking`** - Lightweight status monitoring

## useLocationPermissions

Manages location permissions including foreground and background permissions.

### Basic Usage

```typescript
import { useLocationPermissions } from 'react-native-background-location';

function PermissionScreen() {
  const {
    permissionStatus,
    requestPermissions,
    checkPermissions,
    isRequesting
  } = useLocationPermissions();

  if (!permissionStatus.hasPermission) {
    return (
      <View>
        <Text>Location permissions required</Text>
        <Button
          title="Grant Permissions"
          onPress={requestPermissions}
          disabled={isRequesting}
        />
      </View>
    );
  }

  return <TrackingScreen />;
}
```

### Return Values

```typescript
interface UseLocationPermissionsResult {
  // Current permission state
  permissionStatus: {
    hasPermission: boolean;
    status: 'granted' | 'denied' | 'blocked' | 'undetermined';
    canRequestAgain: boolean;
  };

  // Request all required permissions
  requestPermissions: () => Promise<boolean>;

  // Check current permissions without requesting
  checkPermissions: () => Promise<boolean>;

  // Whether a request is in progress
  isRequesting: boolean;
}
```

### Permission Status

- **`granted`** - All permissions granted
- **`denied`** - User denied permissions, can request again
- **`blocked`** - User permanently denied (never ask again)
- **`undetermined`** - Permissions not yet requested

### Example: Handling Permission States

```typescript
function PermissionHandler() {
  const { permissionStatus, requestPermissions } = useLocationPermissions();

  if (permissionStatus.status === 'blocked') {
    return (
      <View>
        <Text>Permissions permanently denied</Text>
        <Button
          title="Open Settings"
          onPress={() => Linking.openSettings()}
        />
      </View>
    );
  }

  if (permissionStatus.status === 'denied') {
    return (
      <View>
        <Text>We need location permissions to track your trips</Text>
        <Button title="Grant Permissions" onPress={requestPermissions} />
      </View>
    );
  }

  return <TrackingScreen />;
}
```

## useBackgroundLocation

Complete hook for managing background location tracking, including starting/stopping tracking and managing location data.

### Basic Usage

```typescript
import { useBackgroundLocation } from 'react-native-background-location';

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
        <Button
          title="Refresh Locations"
          onPress={refreshLocations}
        />
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

### Options

```typescript
interface UseLocationTrackingOptions {
  // Auto-start tracking when component mounts
  autoStart?: boolean;

  // Custom trip ID to use
  tripId?: string;

  // Callback when tracking starts
  onTrackingStart?: (tripId: string) => void;

  // Callback when tracking stops
  onTrackingStop?: () => void;

  // Callback when error occurs
  onError?: (error: Error) => void;
}
```

### Return Values

```typescript
interface UseBackgroundLocationResult {
  // Current trip ID (null if not tracking)
  tripId: string | null;

  // Whether tracking is active
  isTracking: boolean;

  // All locations for current trip
  locations: Coords[];

  // Whether an operation is in progress
  isLoading: boolean;

  // Last error that occurred
  error: Error | null;

  // Start tracking (returns trip ID or null on error)
  startTracking: (customTripId?: string) => Promise<string | null>;

  // Stop tracking
  stopTracking: () => Promise<void>;

  // Refresh locations for current trip
  refreshLocations: () => Promise<void>;

  // Clear all data for current trip
  clearCurrentTrip: () => Promise<void>;

  // Clear error state
  clearError: () => void;
}
```

### Example: Auto-Start Tracking

```typescript
function AutoTrackingScreen() {
  const { isTracking, locations } = useBackgroundLocation({
    autoStart: true, // Start immediately on mount
    tripId: 'my-trip-123', // Use custom trip ID
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

### Example: Complete Trip Management

```typescript
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
    const id = await startTracking();
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

## useLocationTracking

Lightweight hook that only monitors tracking status. Use this when you don't need full tracking management.

### Basic Usage

```typescript
import { useLocationTracking } from 'react-native-background-location';

function StatusBadge() {
  const { isTracking, tripId, refresh } = useLocationTracking();

  return (
    <View>
      <Text>Status: {isTracking ? '🟢 Tracking' : '🔴 Stopped'}</Text>
      {tripId && <Text>Trip: {tripId}</Text>}
      <Button title="Refresh" onPress={refresh} />
    </View>
  );
}
```

### Parameters

```typescript
useLocationTracking(autoRefresh?: boolean): UseLocationTrackingResult
```

- **`autoRefresh`** (default: `true`) - Whether to check status on mount

### Return Values

```typescript
interface UseLocationTrackingResult {
  // Whether tracking is active
  isTracking: boolean;

  // Current trip ID (null if not tracking)
  tripId: string | null;

  // Manually refresh status
  refresh: () => Promise<void>;

  // Whether status is being checked
  isLoading: boolean;
}
```

### Example: Multiple Components

```typescript
// Header component
function Header() {
  const { isTracking } = useLocationTracking();

  return (
    <View style={styles.header}>
      <Text>App Header</Text>
      <StatusIndicator active={isTracking} />
    </View>
  );
}

// Footer component
function Footer() {
  const { isTracking, tripId } = useLocationTracking();

  return (
    <View style={styles.footer}>
      {isTracking && <Text>Recording trip: {tripId}</Text>}
    </View>
  );
}
```

## Complete Example

Here's a complete example using all three hooks together:

```typescript
import {
  useLocationPermissions,
  useBackgroundLocation,
  useLocationTracking,
} from 'react-native-background-location';

function App() {
  // Permission management
  const {
    permissionStatus,
    requestPermissions,
    isRequesting
  } = useLocationPermissions();

  // Full tracking management
  const {
    isTracking,
    tripId,
    locations,
    startTracking,
    stopTracking,
    refreshLocations,
    error,
  } = useBackgroundLocation({
    onError: (err) => Alert.alert('Error', err.message),
  });

  // Step 1: Check permissions
  if (!permissionStatus.hasPermission) {
    return (
      <View style={styles.container}>
        <Text>Location Permissions Required</Text>
        <Button
          title="Grant Permissions"
          onPress={requestPermissions}
          disabled={isRequesting}
        />
      </View>
    );
  }

  // Step 2: Main tracking UI
  return (
    <View style={styles.container}>
      <Text style={styles.status}>
        Status: {isTracking ? 'Tracking' : 'Stopped'}
      </Text>

      {tripId && <Text>Trip ID: {tripId}</Text>}

      <Text>Locations: {locations.length}</Text>

      <Button
        title={isTracking ? 'Stop Tracking' : 'Start Tracking'}
        onPress={isTracking ? stopTracking : () => startTracking()}
      />

      {isTracking && (
        <Button title="Refresh Locations" onPress={refreshLocations} />
      )}

      {error && <Text style={styles.error}>{error.message}</Text>}

      <FlatList
        data={locations}
        keyExtractor={(_, index) => index.toString()}
        renderItem={({ item, index }) => (
          <View style={styles.locationItem}>
            <Text>
              #{index + 1}: {item.latitude}, {item.longitude}
            </Text>
            <Text>{new Date(item.timestamp).toLocaleString()}</Text>
          </View>
        )}
      />
    </View>
  );
}
```

## Best Practices

### 1. Request Permissions First

Always check and request permissions before starting tracking:

```typescript
const { permissionStatus, requestPermissions } = useLocationPermissions();
const { startTracking } = useBackgroundLocation();

const handleStart = async () => {
  if (!permissionStatus.hasPermission) {
    const granted = await requestPermissions();
    if (!granted) return;
  }

  await startTracking();
};
```

### 2. Handle Errors

Always handle errors from tracking operations:

```typescript
const { startTracking, error, clearError } = useBackgroundLocation({
  onError: (err) => {
    console.error('Tracking error:', err);
    Alert.alert('Error', err.message);
  },
});

useEffect(() => {
  if (error) {
    // Display error to user
    // Auto-clear after some time
    setTimeout(clearError, 5000);
  }
}, [error]);
```

### 3. Clean Up on Unmount

Stop tracking when component unmounts if appropriate:

```typescript
function TrackingScreen() {
  const { stopTracking } = useBackgroundLocation();

  useEffect(() => {
    return () => {
      // Optional: stop tracking when screen unmounts
      // Only if this is the intended behavior
      // stopTracking();
    };
  }, []);
}
```

### 4. Use Lightweight Hook for Status Display

Use `useLocationTracking` for components that only need to display status:

```typescript
// ❌ Don't use full hook just for status
function StatusIcon() {
  const { isTracking } = useBackgroundLocation(); // Too heavy
  return <Icon name={isTracking ? 'gps' : 'gps-off'} />;
}

// ✅ Use lightweight hook
function StatusIcon() {
  const { isTracking } = useLocationTracking();
  return <Icon name={isTracking ? 'gps' : 'gps-off'} />;
}
```

## TypeScript Support

All hooks are fully typed. Import types as needed:

```typescript
import type {
  UseLocationPermissionsResult,
  UseBackgroundLocationResult,
  UseLocationTrackingResult,
  PermissionState,
  LocationPermissionStatus,
  Coords,
} from 'react-native-background-location';
```

## See Also

- [Quick Start Guide](QUICKSTART.md)
- [Integration Guide](INTEGRATION_GUIDE.md)
- [API Reference](../../README.md#api-reference)
- [Example App](../../example/src/App.tsx)

