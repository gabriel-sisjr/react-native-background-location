# Crash Recovery & Session Persistence

This guide explains how the library handles app crashes, restarts, and how to properly recover tracking sessions.

## How Persistence Works

The library persists data across app restarts using platform-native mechanisms:

### Android

1. **Room Database**: Stores tracking state and all collected location data
2. **Foreground Service**: Continues running even after app crash
3. **WorkManager**: Safely recovers sessions on Android 12+ respecting background restrictions
4. **Crash Loop Protection**: Prevents infinite restart loops with SharedPreferences tracking

### iOS

1. **Core Data**: Stores tracking state and all collected location data (SQLite backend)
2. **CLLocationManager**: Continues delivering location updates in the background
3. **Significant Location Monitoring**: Wakes the app after termination to recover tracking sessions
4. **RecoveryManager**: Manages recovery with stop token pattern and rate limiting (5 recoveries/hour)

### What Survives App Restart

| Data            | Persisted | Android Location    | iOS Location        |
| --------------- | --------- | ------------------- | ------------------- |
| Tracking state  | Yes       | Room Database       | Core Data           |
| Current tripId  | Yes       | Room Database       | Core Data           |
| TrackingOptions | Yes       | Room Database       | Core Data           |
| Location data   | Yes       | Room Database       | Core Data           |
| Hook state      | No        | React state is lost | React state is lost |

## Android 12+ Background Recovery

Starting with Android 12 (API 31), Google introduced strict background start restrictions. The library handles this automatically:

### Recovery Mechanism

**Android 12+ (API 31+):**

- Uses **WorkManager** to safely recover tracking sessions
- Respects ForegroundServiceStartNotAllowedException restrictions
- Executes recovery work in the background with proper foreground promotion
- Implements exponential backoff retry (max 3 attempts)

**Android 11 and below:**

- Direct service recovery in `onHostResume`
- No WorkManager overhead for older devices

### Crash Loop Protection

The library prevents infinite restart loops that can drain battery:

- Tracks restart attempts in SharedPreferences
- Allows maximum 5 restarts per hour
- Automatically stops service if loop detected
- Resets counter on clean shutdown
- Uses `START_REDELIVER_INTENT` for predictable restart behavior

**Example scenario:**

```
12:00 - Service starts (count: 1)
12:05 - App crashes, service restarts (count: 2)
12:10 - Crash again (count: 3)
12:15 - Crash again (count: 4)
12:20 - Crash again (count: 5)
12:25 - LOOP DETECTED - Service stops permanently, tracking state cleared
```

## iOS Recovery Mechanism

### Significant Location Monitoring

On iOS, the library uses `startMonitoringSignificantLocationChanges()` to wake the app after termination. When the system detects a significant location change (typically 500+ meters), it relaunches the app in the background and the `RecoveryManager` checks for active tracking sessions.

### RecoveryManager

The iOS `RecoveryManager` follows a similar pattern to Android's `RecoveryWorker`:

1. Check stop token (prevents recovery after explicit `stopTracking()`)
2. Verify permissions are still granted
3. Read tracking state from Core Data
4. Resume `CLLocationManager` updates with saved `TrackingOptions`

### Rate Limiting

To prevent excessive recovery attempts (which would drain battery), the iOS `RecoveryManager` limits recoveries to **5 per hour**. If the limit is exceeded, recovery is deferred until the rate resets.

### Differences from Android

| Aspect                | Android                                 | iOS                                         |
| --------------------- | --------------------------------------- | ------------------------------------------- |
| Recovery mechanism    | WorkManager (API 31+) or direct restart | Significant location monitoring             |
| Background restart    | Service restarts automatically          | App relaunched by system on location change |
| Recovery notification | Shows a recovery notification           | No notification (system-managed)            |
| Rate limiting         | 5 restarts/hour (crash loop detection)  | 5 recoveries/hour (RecoveryManager)         |
| Stop token            | SharedPreferences with 60s TTL          | UserDefaults with similar TTL               |

## Scenarios

### Scenario 1: App Killed by System (Memory Pressure)

**What happens:**

1. Android kills your app due to memory pressure
2. Foreground service continues running
3. Locations continue to be collected
4. Next app open: tracking is still active

**Your action:** Check `isTracking()` on startup and restore UI state.

### Scenario 2: App Swiped from Recents

**What happens:**

1. User swipes app from recent apps
2. React context is destroyed
3. Foreground service continues (usually)
4. `TASK_REMOVED` warning is emitted
5. Locations continue to be collected

**Your action:** Handle `onLocationWarning` for `TASK_REMOVED` if needed.

### Scenario 3: Device Reboot

**What happens:**

1. Device is rebooted
2. Foreground service stops
3. Tracking state shows last tripId but inactive
4. Location data is preserved

**Your action:** Decide whether to resume tracking or just recover data.

### Scenario 4: App Crash (Exception)

**What happens:**

1. App crashes due to unhandled exception
2. Service uses `START_REDELIVER_INTENT` to restart automatically
3. Crash loop protection monitors restart frequency
4. If crashing repeatedly (5+ times/hour), service stops permanently
5. All location data up to crash point is preserved in Room Database
6. On next successful app start, WorkManager (Android 12+) or direct recovery restores session

**Your action:**

- Check for orphaned trips on startup
- Monitor crash reports to fix the underlying crash
- Library will automatically stop service if crash loop detected

## Implementation

### Basic Recovery

```typescript
import { useEffect, useState } from 'react';
import BackgroundLocation from '@gabriel-sisjr/react-native-background-location';

function App() {
  const [sessionState, setSessionState] = useState<{
    isRecovered: boolean;
    tripId: string | null;
    isActive: boolean;
  }>({ isRecovered: false, tripId: null, isActive: false });

  useEffect(() => {
    const recoverSession = async () => {
      try {
        const status = await BackgroundLocation.isTracking();

        setSessionState({
          isRecovered: true,
          tripId: status.tripId || null,
          isActive: status.active,
        });

        if (status.active && status.tripId) {
          console.log('Recovered active session:', status.tripId);
        } else if (status.tripId && !status.active) {
          console.log('Found orphaned trip:', status.tripId);
        }
      } catch (error) {
        console.error('Recovery failed:', error);
        setSessionState({ isRecovered: true, tripId: null, isActive: false });
      }
    };

    recoverSession();
  }, []);

  if (!sessionState.isRecovered) {
    return <LoadingScreen />;
  }

  return <MainApp initialTripId={sessionState.tripId} />;
}
```

### Advanced Recovery with User Choice

```typescript
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import BackgroundLocation from '@gabriel-sisjr/react-native-background-location';

function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const handleRecovery = async () => {
      const status = await BackgroundLocation.isTracking();

      if (status.tripId && !status.active) {
        // Orphaned trip found - ask user what to do
        const locations = await BackgroundLocation.getLocations(status.tripId);

        Alert.alert(
          'Previous Trip Found',
          `Found ${locations.length} locations from a previous session.\n\nWhat would you like to do?`,
          [
            {
              text: 'Resume Tracking',
              onPress: async () => {
                await BackgroundLocation.startTracking(status.tripId);
                setReady(true);
              },
            },
            {
              text: 'Upload & Clear',
              onPress: async () => {
                await uploadLocations(status.tripId!, locations);
                await BackgroundLocation.clearTrip(status.tripId!);
                setReady(true);
              },
            },
            {
              text: 'Discard',
              style: 'destructive',
              onPress: async () => {
                await BackgroundLocation.clearTrip(status.tripId!);
                setReady(true);
              },
            },
          ]
        );
      } else {
        setReady(true);
      }
    };

    handleRecovery();
  }, []);

  if (!ready) {
    return <LoadingScreen />;
  }

  return <MainApp />;
}
```

### Using Hooks for Recovery

```typescript
import { useBackgroundLocation } from '@gabriel-sisjr/react-native-background-location';

function TrackingScreen() {
  // The hook automatically checks for active sessions on mount
  const {
    isTracking,
    tripId,
    locations,
    isLoading,
  } = useBackgroundLocation();

  // isLoading is true while checking for existing sessions
  if (isLoading) {
    return <LoadingSpinner />;
  }

  // tripId will be set if there was an active session
  if (tripId && !isTracking) {
    // Orphaned session - service stopped but data exists
    return <RecoveryPrompt tripId={tripId} locations={locations} />;
  }

  return <TrackingUI />;
}
```

## Persisting TripId Externally

For robust recovery, persist the tripId in your app's storage:

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

const TRIP_ID_KEY = '@current_trip_id';

// When starting a trip
const startTrip = async () => {
  const tripId = await BackgroundLocation.startTracking();
  await AsyncStorage.setItem(TRIP_ID_KEY, tripId);
  return tripId;
};

// On app startup
const recoverTrip = async () => {
  const savedTripId = await AsyncStorage.getItem(TRIP_ID_KEY);
  const status = await BackgroundLocation.isTracking();

  if (savedTripId && !status.active) {
    // We have a saved tripId but tracking stopped
    const locations = await BackgroundLocation.getLocations(savedTripId);
    return { tripId: savedTripId, locations, needsRecovery: true };
  }

  return { tripId: status.tripId, locations: [], needsRecovery: false };
};

// When ending a trip
const endTrip = async () => {
  await BackgroundLocation.stopTracking();
  await AsyncStorage.removeItem(TRIP_ID_KEY);
};
```

## Handling Warning Events

Use `onLocationWarning` to monitor service health:

```typescript
import { useLocationUpdates } from '@gabriel-sisjr/react-native-background-location';

function TrackingWithRecovery() {
  const { lastWarning } = useLocationUpdates({
    onLocationWarning: (warning) => {
      switch (warning.type) {
        case 'SERVICE_TIMEOUT':
          // Android 15+: Service hit time limit
          // Service auto-restarts, log for analytics
          logAnalytics('service_timeout', { tripId: warning.tripId });
          break;

        case 'TASK_REMOVED':
          // App swiped from recents
          // Tracking continues, but React is gone
          // This callback runs if app reopens before service dies
          logAnalytics('task_removed', { tripId: warning.tripId });
          break;

        case 'LOCATION_UNAVAILABLE':
          // GPS lost - might want to notify user
          showNotification('GPS signal lost');
          break;
      }
    },
  });

  return <TrackingUI />;
}
```

## Best Practices

### 1. Always Check on Startup

```typescript
// In your App.tsx or root component
useEffect(() => {
  BackgroundLocation.isTracking().then((status) => {
    if (status.active) {
      // Sync your UI state
    }
  });
}, []);
```

### 2. Don't Generate New TripIds Unnecessarily

```typescript
// ❌ Bad: Always generates new tripId
const tripId = await BackgroundLocation.startTracking();

// ✅ Good: Resume existing or start new
const status = await BackgroundLocation.isTracking();
const tripId = status.tripId
  ? await BackgroundLocation.startTracking(status.tripId)
  : await BackgroundLocation.startTracking();
```

### 3. Handle Orphaned Data

```typescript
// On app startup, before showing main UI
const cleanupOrphanedData = async () => {
  const status = await BackgroundLocation.isTracking();

  if (status.tripId && !status.active) {
    const locations = await BackgroundLocation.getLocations(status.tripId);

    if (locations.length > 0) {
      // Upload before clearing
      await uploadToServer(status.tripId, locations);
    }

    await BackgroundLocation.clearTrip(status.tripId);
  }
};
```

### 4. Persist Critical State

```typescript
// Use AsyncStorage, MMKV, or your state management
const persistTrackingState = async (tripId: string, metadata: any) => {
  await AsyncStorage.setItem(
    '@tracking_state',
    JSON.stringify({
      tripId,
      startedAt: Date.now(),
      metadata,
    })
  );
};
```

## Troubleshooting

### Session Not Recovered

1. Verify `isTracking()` is called before any `startTracking()`
2. Check that you're not always passing `undefined` to `startTracking()`
3. Ensure the app didn't crash immediately after starting

### Duplicate Trips

1. Always check `isTracking()` before starting
2. `startTracking()` is idempotent - calling it again returns same tripId
3. Don't generate custom tripIds for new trips

### Data Lost After Crash

1. Location data is written to Room database immediately
2. If data is lost, the crash happened before first location
3. Check that permissions were granted before tracking started

## See Also

- [Hooks Guide](../getting-started/hooks.md) - Hook behavior on mount
- [Integration Guide](../getting-started/INTEGRATION_GUIDE.md) - Full implementation example
- [Battery Optimization](./BATTERY_OPTIMIZATION.md) - Why services might be killed
- [Platform Comparison](./PLATFORM_COMPARISON.md) - Android vs iOS behavior differences
