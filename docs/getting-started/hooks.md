# React Hooks API

`@gabriel-sisjr/react-native-background-location` provides React Hooks for easier integration and better developer experience.

## Overview

The library includes six hooks:

1. **`useLocationPermissions`** - Manage location permissions
2. **`useBackgroundLocation`** - Full tracking management with manual refresh
3. **`useLocationTracking`** - Lightweight status monitoring
4. **`useLocationUpdates`** - Real-time location watching
5. **`useGeofencing`** - Geofence CRUD management (add, remove, query)
6. **`useGeofenceEvents`** - Real-time geofence transition listener

## useLocationPermissions

Manages location permissions on both Android and iOS.

> **Android:** Uses `PermissionsAndroid` API with a multi-step flow: foreground permissions first, then background permission (Android 10+), then notification permission (Android 13+).

> **iOS:** Uses native `CLLocationManager` via the TurboModule bridge. Calls `checkLocationPermission()` and `requestLocationPermission()` methods. Follows the two-step iOS flow: WhenInUse first, then Always authorization.

### Basic Usage

```typescript
import { useLocationPermissions } from '@gabriel-sisjr/react-native-background-location';

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

- **`granted`** - All permissions granted (full background access)
- **`whenInUse`** - iOS only: WhenInUse permission granted. `hasPermission` is `true` at this level, but background tracking may be limited without Always authorization.
- **`denied`** - User denied permissions, can request again
- **`blocked`** - User permanently denied (must open Settings)
- **`undetermined`** - Permissions not yet requested

> **iOS:** On iOS, `whenInUse` is treated as `hasPermission = true` because tracking can still function. However, for reliable background tracking, encourage the user to grant "Always" permission. The hook will automatically request the upgrade from WhenInUse to Always when `requestPermissions()` is called.

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

![Example app using useBackgroundLocation](../assets/background.gif)

_Example app using `useBackgroundLocation` to start/stop a trip and refresh locations._

### Basic Usage

```typescript
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

### TrackingOptions Interface

The `TrackingOptions` interface defines all available configuration options for background location tracking.

```typescript
interface TrackingOptions {
  // Location accuracy level
  accuracy?: LocationAccuracy;

  // Update interval in milliseconds
  updateInterval?: number;

  // Minimum distance in meters between location updates
  // The system will not deliver location updates until the device
  // has moved at least this distance.
  // @default 0 (no distance filter - all updates delivered)
  // @platform Android
  distanceFilter?: number;

  // Notification configuration (Android only - ignored on iOS)
  notificationTitle?: string;
  notificationText?: string;
  notificationPriority?: NotificationPriority;
  notificationChannelName?: string;

  // Notification appearance (Android only, v0.9.0+)
  notificationSmallIcon?: string; // Custom drawable resource name (falls back to manifest metadata → convention drawable → system default)
  notificationColor?: string; // Hex color (e.g., "#FF5722")
  notificationShowTimestamp?: boolean; // Show timestamp
  notificationLargeIcon?: string; // Large icon drawable
  notificationSubtext?: string; // Subtext below content
  notificationChannelId?: string; // Custom channel ID
  notificationActions?: NotificationAction[]; // Up to 3 action buttons
}
```

#### Platform-Specific Options

| Option           | Android                      | iOS                                                     | Notes                                   |
| ---------------- | ---------------------------- | ------------------------------------------------------- | --------------------------------------- |
| `accuracy`       | All 5 levels                 | `HIGH_ACCURACY`, `BALANCED_POWER_ACCURACY`, `LOW_POWER` | iOS maps to `kCLLocationAccuracy*`      |
| `updateInterval` | Used directly                | Used as hint                                            | iOS may deliver updates more frequently |
| `distanceFilter` | `setMinUpdateDistanceMeters` | `CLLocationManager.distanceFilter`                      | Works on both platforms                 |
| `foregroundOnly` | Skips background permission  | Limits to WhenInUse                                     | Both platforms                          |
| `notification*`  | Full customization           | Ignored                                                 | iOS uses system blue bar instead        |

> **iOS:** On iOS, the system manages background location behavior. There is no foreground service or notification -- the blue status bar indicator appears automatically when the app uses location in the background.

> **Tip:** You can set default notification icons via AndroidManifest `<meta-data>` instead of passing them at runtime. See the [README — Static Notification Defaults](../../README.md#static-notification-defaults) for details.

### Options

```typescript
interface UseBackgroundLocationOptions {
  // Auto-start tracking when component mounts
  autoStart?: boolean;

  // Existing trip ID to resume tracking (not for creating new trips)
  // ⚠️ Only provide this when resuming an interrupted session
  tripId?: string;

  // Tracking configuration options (intervals, accuracy, notification, etc.)
  options?: TrackingOptions;

  // Callback when tracking starts
  onTrackingStart?: (tripId: string) => void;

  // Callback when tracking stops
  onTrackingStop?: () => void;

  // Callback when error occurs
  onError?: (error: Error) => void;
}
```

> **Note:** The options parameter is named `options` (not `trackingOptions`) to match the implementation.

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
  // ⚠️ existingTripId is for RESUMING interrupted sessions only
  startTracking: (
    existingTripId?: string,
    options?: TrackingOptions
  ) => Promise<string | null>;

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
import { LocationAccuracy, NotificationPriority } from '@gabriel-sisjr/react-native-background-location';

function AutoTrackingScreen() {
  const { isTracking, locations } = useBackgroundLocation({
    autoStart: true, // Start immediately on mount
    // Don't provide tripId for new trips - let the library generate a UUID
    options: {
      accuracy: LocationAccuracy.HIGH_ACCURACY,
      updateInterval: 5000,
      notificationPriority: NotificationPriority.LOW,
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

### Example: Complete Trip Management

```typescript
import { LocationAccuracy, NotificationPriority, type TrackingOptions } from '@gabriel-sisjr/react-native-background-location';

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
      distanceFilter: 25, // Only update if moved 25+ meters
      notificationTitle: 'Trip Tracking',
      notificationText: 'Tracking your trip in background',
      notificationPriority: NotificationPriority.LOW,
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

### Example: Distance Filter for Battery Optimization

```typescript
// Only track when user moves 50+ meters
await startTracking('delivery-trip', {
  distanceFilter: 50,
  updateInterval: 5000,
  accuracy: LocationAccuracy.HIGH_ACCURACY,
});
```

### Example: New startTracking Overload

```typescript
// New: Start with just options (tripId auto-generated)
const tripId = await startTracking({
  distanceFilter: 100,
  notificationTitle: 'Delivery Active',
});

// Existing: Start with tripId and options
const tripId = await startTracking('my-trip', {
  distanceFilter: 100,
});
```

### Battery Optimization with Distance Filter

Use `distanceFilter` to reduce battery consumption by only receiving updates when the device has moved a significant distance:

```typescript
// High accuracy with distance filter - great for delivery/navigation
const deliveryConfig: TrackingOptions = {
  accuracy: LocationAccuracy.HIGH_ACCURACY,
  updateInterval: 5000,
  distanceFilter: 25, // Only update if moved 25+ meters
};

// Low power with large distance filter - for check-ins
const checkInConfig: TrackingOptions = {
  accuracy: LocationAccuracy.BALANCED_POWER_ACCURACY,
  updateInterval: 60000,
  distanceFilter: 500, // Only update if moved 500+ meters
};

// Start tracking with optimized configuration
await startTracking(deliveryConfig);
```

## useLocationTracking

Lightweight hook that only monitors tracking status. Use this when you don't need full tracking management.

### Basic Usage

```typescript
import { useLocationTracking } from '@gabriel-sisjr/react-native-background-location';

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

## useLocationUpdates

Hook for watching location updates in real-time. This hook automatically receives location updates as they are collected by the background service, without requiring manual refresh.

![Real-time updates using useLocationUpdates](../assets/background.gif)

_Real‑time updates using `useLocationUpdates`, receiving new locations automatically._

### Basic Usage

```typescript
import { useLocationUpdates } from '@gabriel-sisjr/react-native-background-location';

function LiveMapScreen() {
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
      {lastWarning && (
        <Text style={{ color: 'orange' }}>
          Warning: {lastWarning.message}
        </Text>
      )}
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
      <Button title="Clear Locations" onPress={clearLocations} />
    </View>
  );
}
```

### Options

```typescript
interface UseLocationUpdatesOptions {
  // Specific trip ID to watch
  tripId?: string;

  // Callback when a new location is received
  onLocationUpdate?: (location: Coords) => void;

  // Interval in milliseconds to throttle the onLocationUpdate callback.
  // Locations are still collected at the updateInterval rate, but the
  // callback is only executed at this interval. Useful for syncing to
  // servers without overwhelming the network.
  // @default undefined (callback called on every location update)
  onUpdateInterval?: number;

  // Callback when a service warning is emitted (Android 14+/15+)
  onLocationWarning?: (warning: LocationWarningEvent) => void;

  // Callback when a notification action button is pressed (v0.9.0+)
  onNotificationAction?: (event: NotificationActionEvent) => void;

  // Whether to automatically load existing locations on mount
  autoLoad?: boolean; // Default: true
}
```

### Return Values

```typescript
interface UseLocationUpdatesResult {
  // Current trip ID being watched
  tripId: string | null;

  // Whether location tracking is currently active
  isTracking: boolean;

  // All locations received for the current trip (updates automatically)
  locations: Coords[];

  // The most recent location received
  lastLocation: Coords | null;

  // The most recent warning event (SERVICE_TIMEOUT, TASK_REMOVED, LOCATION_UNAVAILABLE)
  lastWarning: LocationWarningEvent | null;

  // Whether data is being loaded
  isLoading: boolean;

  // Last error that occurred
  error: Error | null;

  // Clear error state
  clearError: () => void;

  // Clear all locations for the current trip
  clearLocations: () => Promise<void>;
}
```

### Handling Service Warnings

On Android 14+ and especially Android 15+, foreground services have stricter time limits. The hook provides warnings for these events:

```typescript
import { useLocationUpdates } from '@gabriel-sisjr/react-native-background-location';

function TrackingWithWarnings() {
  const { lastWarning } = useLocationUpdates({
    onLocationWarning: (warning) => {
      switch (warning.type) {
        case 'SERVICE_TIMEOUT':
          // Android 15+: foreground service hit time limit
          // The service will automatically restart
          console.log('Service restarting due to Android timeout');
          break;

        case 'TASK_REMOVED':
          // User swiped app from recents
          // Tracking continues but app context is gone
          console.log('App removed from recents, tracking continues');
          break;

        case 'LOCATION_UNAVAILABLE':
          // GPS signal lost or location services disabled
          Alert.alert(
            'Location Unavailable',
            'Please ensure GPS is enabled and you have a clear view of the sky.'
          );
          break;
      }
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

### Warning Types

| Type                   | Description                                    | Action                                    |
| ---------------------- | ---------------------------------------------- | ----------------------------------------- |
| `SERVICE_TIMEOUT`      | Android 15+ foreground service timeout reached | Service auto-restarts, no action needed   |
| `TASK_REMOVED`         | App swiped from recents                        | Tracking continues, inform user if needed |
| `LOCATION_UNAVAILABLE` | GPS signal lost or disabled                    | Prompt user to check settings             |

### Notification Action Buttons (v0.9.0+)

Add interactive buttons to the tracking notification and listen for presses:

```typescript
import BackgroundLocation, {
  useLocationUpdates,
  type NotificationActionEvent,
} from '@gabriel-sisjr/react-native-background-location';

function TrackingWithActions() {
  const { locations } = useLocationUpdates({
    onNotificationAction: (event: NotificationActionEvent) => {
      switch (event.actionId) {
        case 'stop':
          BackgroundLocation.stopTracking();
          break;
        case 'emergency':
          callEmergencyService();
          break;
      }
    },
  });

  const startWithActions = async () => {
    await BackgroundLocation.startTracking('trip-123', {
      notificationTitle: 'Delivery in Progress',
      notificationText: 'En route to destination',
      notificationActions: [
        { id: 'stop', label: 'Stop' },
        { id: 'emergency', label: 'Emergency' },
      ],
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

### Key Differences from useBackgroundLocation

| Feature           | useBackgroundLocation | useLocationUpdates |
| ----------------- | --------------------- | ------------------ |
| Tracking control  | ✅ Yes                | ❌ No              |
| Automatic updates | ❌ No                 | ✅ Yes             |
| Manual refresh    | ✅ Yes                | ❌ Not needed      |
| Real-time events  | ❌ No                 | ✅ Yes             |
| Use case          | Control tracking      | Watch live data    |

### Example: Real-Time Map Updates

```typescript
function LiveMap() {
  const { locations, lastLocation } = useLocationUpdates();

  return (
    <MapView>
      {locations.map((loc, index) => (
        <Marker
          key={index}
          coordinate={{
            latitude: parseFloat(loc.latitude),
            longitude: parseFloat(loc.longitude),
          }}
        />
      ))}
      {lastLocation && (
        <Circle
          center={{
            latitude: parseFloat(lastLocation.latitude),
            longitude: parseFloat(lastLocation.longitude),
          }}
          radius={lastLocation.accuracy || 100}
        />
      )}
    </MapView>
  );
}
```

### Example: Combine with Control

```typescript
function CompleteTracking() {
  // Control (start/stop)
  const { startTracking, stopTracking } = useBackgroundLocation();

  // Live updates
  const { locations, lastLocation } = useLocationUpdates({
    onLocationUpdate: (location) => {
      // Send to server in real-time
      sendToServer(location);
    },
  });

  return (
    <View>
      <Button onPress={startTracking}>Start</Button>
      <Button onPress={stopTracking}>Stop</Button>
      <Text>Points: {locations.length}</Text>
    </View>
  );
}
```

### Example: Throttling Server Sync with onUpdateInterval

Use `onUpdateInterval` to control how often the callback is executed without changing the location collection rate:

```typescript
// Throttle server sync to every 30 seconds
const { locations, lastLocation } = useLocationUpdates({
  onLocationUpdate: async (location) => {
    // This is only called every 30 seconds, even if locations
    // are collected more frequently (e.g., every 5 seconds)
    await syncLocationToServer(location);
  },
  onUpdateInterval: 30000, // 30 seconds
});

// Example: Collect every 5 seconds, sync every minute
function ThrottledSync() {
  const [syncCount, setSyncCount] = useState(0);

  const { locations } = useLocationUpdates({
    onLocationUpdate: async (location) => {
      // Called every 60 seconds, not every 5 seconds
      await uploadToServer(location);
      setSyncCount(prev => prev + 1);
    },
    onUpdateInterval: 60000, // Sync every 1 minute
  });

  return (
    <View>
      <Text>Total locations: {locations.length}</Text>
      <Text>Server syncs: {syncCount}</Text>
    </View>
  );
}
```

For more details, see the [Real-Time Updates Guide](REAL_TIME_UPDATES.md).

## useGeofencing

Complete CRUD hook for managing geofence regions. Handles state management, loading indicators, error tracking, and automatic refresh after every mutation.

> **Note:** `useGeofencing` uses the same location permissions as the tracking hooks. Use `useLocationPermissions` (or the aliased `useGeofencePermissions`) to request permissions before registering geofences.

### Basic Usage

```typescript
import { useGeofencing } from '@gabriel-sisjr/react-native-background-location';

function GeofenceScreen() {
  const {
    geofences,
    isLoading,
    error,
    addGeofence,
    removeGeofence,
    maxGeofences,
  } = useGeofencing();

  const handleAdd = async () => {
    await addGeofence({
      identifier: 'office',
      latitude: -23.5505,
      longitude: -46.6333,
      radius: 200,
    });
  };

  return (
    <View>
      <Text>Active: {geofences.length} / {maxGeofences}</Text>
      <Button title="Add Geofence" onPress={handleAdd} disabled={isLoading} />
      {error && <Text>Error: {error.message}</Text>}
    </View>
  );
}
```

### Options

```typescript
interface UseGeofencingOptions {
  /** Whether to automatically load geofences on mount (default: true) */
  autoLoad?: boolean;
  /**
   * Global notification configuration for geofence transitions.
   * When provided, calls configureGeofenceNotifications() on mount.
   * Changes to this object trigger reconfiguration.
   *
   * @since 0.11.0
   */
  notificationOptions?: NotificationOptions;
}
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `autoLoad` | `boolean` | `true` | Automatically fetch active geofences and platform limit on mount |
| `notificationOptions` | `NotificationOptions` | `undefined` | Global notification config for geofence transitions. Applied on mount; reconfigured when content changes. |

> **Deep comparison:** The hook serializes `notificationOptions` to JSON for dependency tracking. If you pass a new object reference with the same content, no native reconfiguration occurs. Only actual content changes trigger a call to `configureGeofenceNotifications()`.

> **Overrides imperative config:** When `notificationOptions` is provided to the hook, it calls `configureGeofenceNotifications()` on mount and on every content change. This overrides any previous imperative call you may have made. Use either the hook option or the imperative API, not both simultaneously.

### Return Values

```typescript
interface UseGeofencingReturn {
  geofences: GeofenceRegion[];
  isLoading: boolean;
  error: Error | null;
  addGeofence: (region: GeofenceRegion) => Promise<void>;
  addGeofences: (regions: GeofenceRegion[]) => Promise<void>;
  removeGeofence: (identifier: string) => Promise<void>;
  removeGeofences: (identifiers: string[]) => Promise<void>;
  removeAllGeofences: () => Promise<void>;
  maxGeofences: number | null;
  refresh: () => Promise<void>;
  clearError: () => void;
}
```

| Value | Type | Description |
|-------|------|-------------|
| `geofences` | `GeofenceRegion[]` | Currently active geofence regions |
| `isLoading` | `boolean` | Whether an async operation is in progress |
| `error` | `Error \| null` | Last error that occurred, or `null` |
| `addGeofence` | `(region) => Promise<void>` | Register a single geofence. Auto-refreshes on success. |
| `addGeofences` | `(regions) => Promise<void>` | Register multiple geofences atomically. Auto-refreshes on success. |
| `removeGeofence` | `(id) => Promise<void>` | Remove a geofence by identifier. Auto-refreshes on success. |
| `removeGeofences` | `(ids) => Promise<void>` | Remove multiple geofences. Auto-refreshes on success. |
| `removeAllGeofences` | `() => Promise<void>` | Remove all geofences. Auto-refreshes on success. |
| `maxGeofences` | `number \| null` | Platform geofence limit (Android: 100, iOS: 20), or `null` if not yet loaded |
| `refresh` | `() => Promise<void>` | Manually reload active geofences and platform limit |
| `clearError` | `() => void` | Clear the current error state |

### Example: Batch Registration

```typescript
import {
  useGeofencing,
  GeofenceTransitionType,
} from '@gabriel-sisjr/react-native-background-location';

function DeliveryZones() {
  const { geofences, addGeofences, removeAllGeofences } = useGeofencing();

  const registerDeliveryZones = async () => {
    await addGeofences([
      {
        identifier: 'warehouse',
        latitude: -23.5505,
        longitude: -46.6333,
        radius: 300,
        transitionTypes: [GeofenceTransitionType.ENTER, GeofenceTransitionType.DWELL],
        loiteringDelay: 60000,
      },
      {
        identifier: 'customer-a',
        latitude: -23.5612,
        longitude: -46.6558,
        radius: 150,
      },
    ]);
  };

  return (
    <View>
      <Text>Zones: {geofences.length}</Text>
      <Button title="Register Zones" onPress={registerDeliveryZones} />
      <Button title="Clear All" onPress={removeAllGeofences} />
    </View>
  );
}
```

### Example: Error Handling

```typescript
import {
  useGeofencing,
  GeofenceError,
  GeofenceErrorCode,
} from '@gabriel-sisjr/react-native-background-location';

function SafeGeofenceAdd() {
  const { addGeofence, error, clearError } = useGeofencing();

  const handleAdd = async () => {
    try {
      await addGeofence({
        identifier: 'office',
        latitude: -23.5505,
        longitude: -46.6333,
        radius: 200,
      });
    } catch (err) {
      if (err instanceof GeofenceError) {
        if (err.code === GeofenceErrorCode.DUPLICATE_IDENTIFIER) {
          console.warn('Geofence already exists');
        } else if (err.code === GeofenceErrorCode.LIMIT_EXCEEDED) {
          Alert.alert('Limit reached', 'Remove some geofences first');
        }
      }
    }
  };

  return (
    <View>
      <Button title="Add Office" onPress={handleAdd} />
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

## useGeofenceEvents

Hook for listening to geofence transition events in real-time. Subscribes to native events via `NativeEventEmitter` and applies optional filters before invoking the callback.

This is a side-effect-only hook that returns `void`. Use it alongside `useGeofencing` for a complete geofencing solution.

### Basic Usage

```typescript
import {
  useGeofenceEvents,
  GeofenceTransitionType,
} from '@gabriel-sisjr/react-native-background-location';

function TransitionLogger() {
  useGeofenceEvents({
    onTransition: (event) => {
      console.log(`${event.transitionType} at ${event.geofenceId}`);
    },
  });

  return <Text>Listening for geofence transitions...</Text>;
}
```

### Options

```typescript
interface UseGeofenceEventsOptions {
  /** Callback invoked on each matching transition event */
  onTransition?: (event: GeofenceTransitionEvent) => void;
  /** Only emit events matching these transition types */
  filter?: GeofenceTransitionType[];
  /** Only emit events for this specific geofence identifier */
  geofenceId?: string;
}
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `onTransition` | `(event) => void` | `undefined` | Callback invoked on each matching transition |
| `filter` | `GeofenceTransitionType[]` | `undefined` | If set, only transitions of these types are emitted |
| `geofenceId` | `string` | `undefined` | If set, only transitions for this geofence are emitted |

### Return Value

`useGeofenceEvents` returns `void`. It is a pure listener hook with no state.

### Example: Filter by Transition Type

```typescript
import {
  useGeofenceEvents,
  GeofenceTransitionType,
} from '@gabriel-sisjr/react-native-background-location';

// Only listen for ENTER events
useGeofenceEvents({
  onTransition: (event) => {
    showNotification(`Entered ${event.geofenceId}`);
  },
  filter: [GeofenceTransitionType.ENTER],
});
```

### Example: Filter by Geofence ID

```typescript
import { useGeofenceEvents } from '@gabriel-sisjr/react-native-background-location';

// Only listen to a specific geofence
useGeofenceEvents({
  onTransition: (event) => {
    markAttendance(event.timestamp);
  },
  geofenceId: 'office-hq',
});
```

### Example: Combined with useGeofencing

```typescript
import React, { useState } from 'react';
import { View, Text, FlatList, Button } from 'react-native';
import {
  useGeofencing,
  useGeofenceEvents,
  GeofenceTransitionType,
  type GeofenceTransitionEvent,
} from '@gabriel-sisjr/react-native-background-location';

function GeofenceMonitor() {
  const [events, setEvents] = useState<GeofenceTransitionEvent[]>([]);
  const { geofences, addGeofence, removeAllGeofences, maxGeofences } = useGeofencing();

  useGeofenceEvents({
    onTransition: (event) => {
      setEvents((prev) => [event, ...prev].slice(0, 50));
    },
  });

  return (
    <View>
      <Text>Geofences: {geofences.length} / {maxGeofences}</Text>
      <Text>Events: {events.length}</Text>
      <FlatList
        data={events}
        keyExtractor={(_, i) => i.toString()}
        renderItem={({ item }) => (
          <Text>
            {item.transitionType} {item.geofenceId} at {item.timestamp}
          </Text>
        )}
      />
    </View>
  );
}
```

### useGeofencing vs useGeofenceEvents

| Feature | useGeofencing | useGeofenceEvents |
|---------|---------------|-------------------|
| Purpose | Geofence CRUD operations | Real-time transition listening |
| State management | Yes (geofences, loading, error) | No (void return) |
| Add/remove geofences | Yes | No |
| Receive transition events | No | Yes |
| Auto-refresh | Yes (after mutations) | N/A |
| Platform limit query | Yes (`maxGeofences`) | No |
| Use case | Managing geofence lifecycle | Reacting to enter/exit/dwell events |
| Combine with | `useGeofenceEvents` for full solution | `useGeofencing` for full solution |

## Complete Example

Here's a complete example using all hooks together:

```typescript
import {
  useLocationPermissions,
  useBackgroundLocation,
  useLocationTracking,
} from '@gabriel-sisjr/react-native-background-location';

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
            {item.accuracy !== undefined && (
              <Text>Accuracy: {item.accuracy.toFixed(2)} m</Text>
            )}
            {item.speed !== undefined && (
              <Text>Speed: {(item.speed * 3.6).toFixed(2)} km/h</Text>
            )}
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

## Extended Location Properties

Location objects (`Coords`) include extended properties from the platform-native location APIs. All properties are optional and only available when provided by the location provider.

> **Android:** Extended properties come from the Android Location API. Properties like `verticalAccuracyMeters`, `speedAccuracyMetersPerSecond`, and `bearingAccuracyDegrees` require Android API 26+.

> **iOS:** Extended properties come from `CLLocation`. Properties like `verticalAccuracyMeters` and `speedAccuracyMetersPerSecond` are available on iOS 15+. The `provider` field on iOS is always `"cllocation"` and `isFromMockProvider` is always `false`.

### Available Properties

```typescript
interface Coords {
  // Required properties
  latitude: string;
  longitude: string;
  timestamp: number;

  // Extended properties (optional)
  accuracy?: number; // Horizontal accuracy in meters
  altitude?: number; // Altitude in meters above sea level
  speed?: number; // Speed in meters per second
  bearing?: number; // Bearing in degrees (0-360)
  verticalAccuracyMeters?: number; // Vertical accuracy (Android API 26+)
  speedAccuracyMetersPerSecond?: number; // Speed accuracy (Android API 26+)
  bearingAccuracyDegrees?: number; // Bearing accuracy (Android API 26+)
  elapsedRealtimeNanos?: number; // Elapsed realtime in nanoseconds
  provider?: string; // Location provider (gps, network, passive, etc.)
  isFromMockProvider?: boolean; // Whether from mock provider (Android API 18+)
}
```

### Example: Using Extended Properties

```typescript
function LocationDetails({ location }: { location: Coords }) {
  return (
    <View>
      <Text>Coordinates: {location.latitude}, {location.longitude}</Text>
      <Text>Time: {new Date(location.timestamp).toLocaleString()}</Text>

      {/* Always check for undefined before using optional properties */}
      {location.accuracy !== undefined && (
        <Text>Accuracy: {location.accuracy.toFixed(2)} meters</Text>
      )}

      {location.altitude !== undefined && (
        <Text>Altitude: {location.altitude.toFixed(2)} meters</Text>
      )}

      {location.speed !== undefined && (
        <Text>
          Speed: {(location.speed * 3.6).toFixed(2)} km/h
          {' '}({location.speed.toFixed(2)} m/s)
        </Text>
      )}

      {location.bearing !== undefined && (
        <Text>Bearing: {location.bearing.toFixed(2)}°</Text>
      )}

      {location.provider && (
        <Text>Provider: {location.provider}</Text>
      )}

      {location.isFromMockProvider !== undefined && (
        <Text>
          Mock Provider: {location.isFromMockProvider ? 'Yes' : 'No'}
        </Text>
      )}
    </View>
  );
}
```

### Best Practices

1. **Always check for undefined**: Optional properties may not be available on all devices or Android versions.

```typescript
// ✅ Good
if (location.accuracy !== undefined) {
  console.log(`Accuracy: ${location.accuracy} m`);
}

// ❌ Bad - may be undefined
console.log(`Accuracy: ${location.accuracy} m`);
```

2. **Handle API-level differences**: Some properties require specific Android API levels (18+, 26+).

```typescript
// Properties available on Android API 26+
if (location.verticalAccuracyMeters !== undefined) {
  console.log(`Vertical accuracy: ${location.verticalAccuracyMeters} m`);
}
```

3. **Format values appropriately**: Convert units for better readability.

```typescript
// Convert m/s to km/h for speed
if (location.speed !== undefined) {
  const speedKmh = location.speed * 3.6;
  console.log(`Speed: ${speedKmh.toFixed(2)} km/h`);
}

// Convert nanoseconds to milliseconds
if (location.elapsedRealtimeNanos !== undefined) {
  const elapsedMs = location.elapsedRealtimeNanos / 1000000;
  console.log(`Elapsed: ${elapsedMs.toFixed(2)} ms`);
}
```

## Coordinate Format

> **Important:** Coordinates (`latitude`, `longitude`) are returned as **strings**, not numbers.

Always parse coordinates when using with map libraries:

```typescript
// ✅ Correct: Parse for map libraries
const numericCoords = {
  latitude: parseFloat(location.latitude),
  longitude: parseFloat(location.longitude),
};

// ✅ Helper function
const toNumericCoords = (loc: Coords) => ({
  latitude: parseFloat(loc.latitude),
  longitude: parseFloat(loc.longitude),
});

// Usage with react-native-maps
<Marker coordinate={toNumericCoords(location)} />
<Polyline coordinates={locations.map(toNumericCoords)} />

// ❌ Wrong: Strings will cause errors in map libraries
<Marker coordinate={{ latitude: location.latitude, longitude: location.longitude }} />
```

## Memory Management

The `locations` array grows with each collected point. For long tracking sessions:

### Memory Estimates

| Duration | Interval | Points | Memory  |
| -------- | -------- | ------ | ------- |
| 1 hour   | 5 sec    | ~720   | ~360 KB |
| 4 hours  | 5 sec    | ~2,880 | ~1.4 MB |
| 8 hours  | 5 sec    | ~5,760 | ~2.8 MB |

### Strategies

```typescript
// Strategy 1: Upload and clear periodically
const BATCH_SIZE = 100;

useLocationUpdates({
  onLocationUpdate: async (location) => {
    const allLocations = await BackgroundLocation.getLocations(tripId);

    if (allLocations.length >= BATCH_SIZE) {
      await uploadToServer(tripId, allLocations);
      await BackgroundLocation.clearTrip(tripId);
      // Tracking continues with fresh storage
    }
  },
});

// Strategy 2: Display only recent locations
function RecentLocations({ locations }: { locations: Coords[] }) {
  const recent = locations.slice(-50); // Last 50 only
  return <LocationList data={recent} />;
}

// Strategy 3: Use virtualized list
import { FlashList } from '@shopify/flash-list';

function AllLocations({ locations }: { locations: Coords[] }) {
  return (
    <FlashList
      data={locations}
      renderItem={({ item }) => <LocationItem location={item} />}
      estimatedItemSize={80}
    />
  );
}
```

## TypeScript Support

All hooks are fully typed. Import types and enums as needed:

```typescript
import type {
  // Hook result types
  UseLocationPermissionsResult,
  UseBackgroundLocationResult,
  UseLocationTrackingResult,
  UseLocationUpdatesOptions,
  UseLocationUpdatesResult,
  UseGeofencingOptions,
  UseGeofencingReturn,
  UseGeofenceEventsOptions,

  // Data types
  PermissionState,
  TrackingOptions,
  Coords,
  LocationUpdateEvent,
  LocationWarningEvent,
  LocationWarningType,
  NotificationAction,
  NotificationActionEvent,

  // Geofencing data types
  GeofenceRegion,
  GeofenceTransitionEvent,
} from '@gabriel-sisjr/react-native-background-location';

import {
  // Enums
  LocationPermissionStatus,
  LocationAccuracy,
  NotificationPriority,

  // Geofencing enums
  GeofenceTransitionType,
  GeofenceErrorCode,
} from '@gabriel-sisjr/react-native-background-location';
```

## See Also

- [Quick Start Guide](QUICKSTART.md)
- [Geofencing Guide](geofencing.md)
- [Real-Time Updates Guide](REAL_TIME_UPDATES.md)
- [Integration Guide](INTEGRATION_GUIDE.md)
- [API Reference](../../README.md#api-reference)
- [Example App](../../example/src/App.tsx)
