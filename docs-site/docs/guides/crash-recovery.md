---
sidebar_position: 7
title: Crash Recovery
description: How the library recovers from app crashes and system kills — Android WorkManager recovery, iOS significant location monitoring, crash loop detection, session persistence, and orphaned trip handling.
keywords:
  - crash recovery
  - session persistence
  - WorkManager
  - RecoveryWorker
  - significant location monitoring
  - crash loop detection
  - isTracking
  - orphaned trips
  - React Native
---

# Crash Recovery

This guide explains how the library handles app crashes, system kills, and device reboots, and how to properly recover tracking sessions in your application.

## How Persistence Works

The library persists tracking state and location data using platform-native storage mechanisms. This data survives app crashes and device reboots.

### What Survives App Restart

| Data | Persisted | Android Storage | iOS Storage |
|------|-----------|----------------|-------------|
| Tracking state | Yes | Room Database | Core Data |
| Current trip ID | Yes | Room Database | Core Data |
| TrackingOptions | Yes | Room Database | Core Data |
| Location data | Yes | Room Database | Core Data |
| React hook state | No | Lost | Lost |

React state is always lost on restart. The library provides tools to reconstruct your UI state from the persisted native data.

## Android Recovery

### Foreground Service Persistence

On Android, the foreground service continues running even after the app's process is killed by the system. Locations continue to be collected. When the user reopens the app, the service is already active and all collected data is available.

### WorkManager Recovery (Android 12+)

Starting with Android 12 (API 31), Google introduced strict background start restrictions. The library handles this with `RecoveryWorker`:

- Uses **WorkManager** to safely recover tracking sessions
- Respects `ForegroundServiceStartNotAllowedException` restrictions
- Executes recovery work in the background with proper foreground promotion
- Implements exponential backoff retry (max 3 attempts)

On Android 11 and below, the library uses direct service recovery in `onHostResume` without WorkManager overhead.

### Crash Loop Detection

The library prevents infinite restart loops that drain battery:

- Tracks restart attempts in SharedPreferences
- Allows a maximum of **5 restarts per hour**
- Automatically stops the service if a loop is detected
- Resets the counter on clean shutdown
- Uses `START_REDELIVER_INTENT` for predictable restart behavior

**Example scenario:**

```
12:00 - Service starts (count: 1)
12:05 - App crashes, service restarts (count: 2)
12:10 - Crash again (count: 3)
12:15 - Crash again (count: 4)
12:20 - Crash again (count: 5)
12:25 - LOOP DETECTED - Service stops, tracking state cleared
```

When a crash loop is detected, the service stops permanently. The app must be restarted by the user, at which point a new tracking session can begin.

## iOS Recovery

### Significant Location Monitoring

On iOS, the library uses `startMonitoringSignificantLocationChanges()` to wake the app after termination. When the system detects a significant location change (typically 500+ meters), it relaunches the app in the background and the `RecoveryManager` checks for active tracking sessions.

### RecoveryManager

The iOS `RecoveryManager` follows these steps:

1. Check stop token (prevents recovery after explicit `stopTracking()`)
2. Verify permissions are still granted
3. Read tracking state from Core Data
4. Resume `CLLocationManager` updates with saved `TrackingOptions`

### Rate Limiting

To prevent excessive battery drain, the iOS `RecoveryManager` limits recoveries to **5 per hour**. If the limit is exceeded, recovery is deferred until the rate resets.

## Platform Comparison

| Aspect | Android | iOS |
|--------|---------|-----|
| Recovery mechanism | WorkManager (API 31+) or direct restart | Significant location monitoring |
| Background restart | Service restarts automatically | App relaunched by system on location change |
| Recovery notification | Shows a recovery notification | No notification (system-managed) |
| Rate limiting | 5 restarts/hour (crash loop detection) | 5 recoveries/hour (RecoveryManager) |
| Stop token | SharedPreferences with 60s TTL | UserDefaults with similar TTL |

## Recovery Scenarios

### Scenario 1: App Killed by System (Memory Pressure)

1. Android kills your app due to memory pressure
2. Foreground service continues running
3. Locations continue to be collected
4. Next app open: tracking is still active

**Your action:** Check `isTracking()` on startup and restore UI state.

### Scenario 2: App Swiped from Recents

1. User swipes app from recent apps
2. React context is destroyed
3. Foreground service continues (usually)
4. `TASK_REMOVED` warning is emitted
5. Locations continue to be collected

**Your action:** Handle `onLocationWarning` for `TASK_REMOVED` if needed.

### Scenario 3: Device Reboot

1. Device is rebooted
2. Foreground service stops
3. Tracking state shows the last trip ID but tracking is inactive
4. Location data is preserved

**Your action:** Decide whether to resume tracking or recover the data.

### Scenario 4: App Crash (Unhandled Exception)

1. App crashes
2. Service uses `START_REDELIVER_INTENT` to restart automatically
3. Crash loop protection monitors restart frequency
4. If crashing repeatedly (5+ times/hour), the service stops permanently
5. All location data up to the crash point is preserved
6. On next successful app start, WorkManager (Android 12+) or direct recovery restores the session

**Your action:** Check for orphaned trips on startup. Monitor crash reports to fix the underlying crash.

## Implementing Recovery

### Basic Recovery

Use `isTracking()` on app startup to detect active or orphaned sessions.

```typescript
import { useEffect, useState } from 'react';
import { isTracking } from '@gabriel-sisjr/react-native-background-location';

function App() {
  const [sessionState, setSessionState] = useState<{
    isRecovered: boolean;
    tripId: string | null;
    isActive: boolean;
  }>({ isRecovered: false, tripId: null, isActive: false });

  useEffect(() => {
    const recoverSession = async () => {
      try {
        const status = await isTracking();

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

### Recovery with User Choice

Present the user with options when an orphaned trip is found.

```typescript
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import {
  isTracking,
  startTracking,
  getLocations,
  clearTrip,
} from '@gabriel-sisjr/react-native-background-location';

function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const handleRecovery = async () => {
      const status = await isTracking();

      if (status.tripId && !status.active) {
        const locations = await getLocations(status.tripId);

        Alert.alert(
          'Previous Trip Found',
          `Found ${locations.length} locations from a previous session.`,
          [
            {
              text: 'Resume Tracking',
              onPress: async () => {
                await startTracking(status.tripId);
                setReady(true);
              },
            },
            {
              text: 'Upload & Clear',
              onPress: async () => {
                await uploadLocations(status.tripId!, locations);
                await clearTrip(status.tripId!);
                setReady(true);
              },
            },
            {
              text: 'Discard',
              style: 'destructive',
              onPress: async () => {
                await clearTrip(status.tripId!);
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

  if (!ready) return <LoadingScreen />;
  return <MainApp />;
}
```

### Hook-Based Recovery

The `useBackgroundLocation` hook automatically checks for active sessions on mount.

```typescript
import { useBackgroundLocation } from '@gabriel-sisjr/react-native-background-location';

function TrackingScreen() {
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

  // Orphaned session: service stopped but data exists
  if (tripId && !isTracking) {
    return <RecoveryPrompt tripId={tripId} locations={locations} />;
  }

  return <TrackingUI />;
}
```

## Persisting Trip ID Externally

For robust recovery, persist the trip ID in your app's storage alongside the library's native persistence.

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  startTracking,
  stopTracking,
  isTracking,
  getLocations,
} from '@gabriel-sisjr/react-native-background-location';

const TRIP_ID_KEY = '@current_trip_id';

// When starting a trip
const startTrip = async () => {
  const tripId = await startTracking();
  await AsyncStorage.setItem(TRIP_ID_KEY, tripId);
  return tripId;
};

// On app startup
const recoverTrip = async () => {
  const savedTripId = await AsyncStorage.getItem(TRIP_ID_KEY);
  const status = await isTracking();

  if (savedTripId && !status.active) {
    const locations = await getLocations(savedTripId);
    return { tripId: savedTripId, locations, needsRecovery: true };
  }

  return { tripId: status.tripId, locations: [], needsRecovery: false };
};

// When ending a trip
const endTrip = async () => {
  await stopTracking();
  await AsyncStorage.removeItem(TRIP_ID_KEY);
};
```

## Monitoring Service Health

Use `onLocationWarning` to detect service issues and log them for analytics.

```typescript
import { useLocationUpdates } from '@gabriel-sisjr/react-native-background-location';

function TrackingWithRecovery() {
  useLocationUpdates({
    onLocationWarning: (warning) => {
      switch (warning.type) {
        case 'SERVICE_TIMEOUT':
          // Android 15+: service hit time limit, auto-restarts
          logAnalytics('service_timeout');
          break;
        case 'TASK_REMOVED':
          // App swiped from recents, tracking continues
          logAnalytics('task_removed');
          break;
        case 'LOCATION_UNAVAILABLE':
          // GPS lost -- notify user
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
import { isTracking } from '@gabriel-sisjr/react-native-background-location';

useEffect(() => {
  isTracking().then((status) => {
    if (status.active) {
      // Sync your UI state with the active session
    }
  });
}, []);
```

### 2. Do Not Generate New Trip IDs Unnecessarily

```typescript
// Bad: always generates a new trip ID
const tripId = await startTracking();

// Good: resume existing or start new
const status = await isTracking();
const tripId = status.tripId
  ? await startTracking(status.tripId)
  : await startTracking();
```

### 3. Handle Orphaned Data

```typescript
const cleanupOrphanedData = async () => {
  const status = await isTracking();

  if (status.tripId && !status.active) {
    const locations = await getLocations(status.tripId);
    if (locations.length > 0) {
      await uploadToServer(status.tripId, locations);
    }
    await clearTrip(status.tripId);
  }
};
```

### 4. Persist Critical State

Use AsyncStorage, MMKV, or your state management solution to persist trip metadata alongside the library's native persistence.

```typescript
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
2. Check that you are not always passing `undefined` to `startTracking()`
3. Ensure the app did not crash immediately after starting

### Duplicate Trips

1. Always check `isTracking()` before starting
2. `startTracking()` is idempotent -- calling it again returns the same trip ID
3. Do not generate custom trip IDs for new trips

### Data Lost After Crash

1. Location data is written to the database as it arrives
2. If data is lost, the crash happened before the first location was collected
3. Check that permissions were granted before tracking started

## Next Steps

- [Battery Optimization](./battery-optimization) -- Why services might be killed and how to prevent it
- [Background Tracking](./background-tracking) -- Full tracking lifecycle
- [Real-Time Updates](./real-time-updates) -- Handling service warnings
