---
sidebar_position: 3
title: Geofencing
description: Getting started with geofencing — define circular regions, monitor ENTER/EXIT/DWELL transitions, manage geofences with the useGeofencing hook, and understand platform limits.
keywords:
  - geofencing
  - geofence
  - GeofenceRegion
  - useGeofencing
  - useGeofenceEvents
  - transition
  - ENTER
  - EXIT
  - DWELL
  - React Native
---

# Geofencing

Geofencing allows your application to define virtual geographic boundaries (circular regions) and receive notifications when the device enters, exits, or dwells within those regions.

## What Is Geofencing?

A geofence is a virtual circular boundary defined by a center coordinate (latitude/longitude) and a radius. When the device crosses the boundary, the system fires a transition event. The library supports three transition types:

- **ENTER** -- The device entered the geofence region.
- **EXIT** -- The device exited the geofence region.
- **DWELL** -- The device remained inside the region for a configured duration.

Common use cases include store proximity alerts, fleet management zones, attendance tracking, delivery area monitoring, and safety perimeters.

Geofencing operates entirely in the background. Once registered, geofences are monitored by the operating system even when the app is not in the foreground.

## Platform Implementations

| Platform | Technology | Max Geofences |
|----------|-----------|---------------|
| Android | Google Play Services `GeofencingClient` | 100 |
| iOS | `CLLocationManager` region monitoring | 20 |

## Prerequisites

Before using geofencing:

1. **Location permissions:** Background location access is required. Use `useLocationPermissions` and call `requestPermissions()` before registering geofences. See the [Permission Handling](./permission-handling.md) guide.
2. **Android:** Google Play Services must be installed. Without it, a `GeofenceError` with code `PLAY_SERVICES_UNAVAILABLE` is thrown.
3. **iOS:** "Always" authorization is required for reliable background monitoring. "When In Use" works only in the foreground.
4. **Minimum versions:** iOS 16+, Android SDK 24+.

## Quick Start

A minimal example that registers a geofence and listens for transitions:

```typescript
import React, { useState } from 'react';
import { View, Text, Button } from 'react-native';
import {
  useGeofencing,
  useGeofenceEvents,
  GeofenceTransitionType,
} from '@gabriel-sisjr/react-native-background-location';

function GeofenceDemo() {
  const [enterCount, setEnterCount] = useState(0);
  const { geofences, addGeofence, maxGeofences } = useGeofencing();

  useGeofenceEvents({
    onTransition: (event) => {
      if (event.transitionType === GeofenceTransitionType.ENTER) {
        setEnterCount((prev) => prev + 1);
      }
    },
  });

  const handleAddGeofence = async () => {
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
      <Text>Enter events: {enterCount}</Text>
      <Button title="Add Office Geofence" onPress={handleAddGeofence} />
    </View>
  );
}
```

## GeofenceRegion Definition

The `GeofenceRegion` interface defines a circular geofence.

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `identifier` | `string` | Yes | -- | Unique identifier (consumer-provided) |
| `latitude` | `number` | Yes | -- | Center latitude (-90 to 90) |
| `longitude` | `number` | Yes | -- | Center longitude (-180 to 180) |
| `radius` | `number` | Yes | -- | Radius in meters (minimum 100) |
| `transitionTypes` | `GeofenceTransitionType[]` | No | `[ENTER, EXIT]` | Which transitions to monitor |
| `loiteringDelay` | `number` | No | `30000` | Milliseconds before DWELL fires |
| `expirationDuration` | `number` | No | Indefinite | Auto-expire after this many ms |
| `metadata` | `Record<string, unknown>` | No | `undefined` | Arbitrary JSON-serializable data |
| `notificationOptions` | `NotificationOptions \| false` | No | `undefined` | Per-geofence notification override |

```typescript
import {
  addGeofence,
  GeofenceTransitionType,
} from '@gabriel-sisjr/react-native-background-location';

await addGeofence({
  identifier: 'warehouse-north',
  latitude: 40.7128,
  longitude: -74.006,
  radius: 300,
  transitionTypes: [
    GeofenceTransitionType.ENTER,
    GeofenceTransitionType.EXIT,
    GeofenceTransitionType.DWELL,
  ],
  loiteringDelay: 60000,
  metadata: { zone: 'loading-dock', priority: 'high' },
});
```

## Adding Geofences

### Single Geofence

```typescript
import { addGeofence } from '@gabriel-sisjr/react-native-background-location';

await addGeofence({
  identifier: 'office',
  latitude: -23.5505,
  longitude: -46.6333,
  radius: 200,
});
```

### Batch Registration

Register multiple geofences atomically. All succeed or all fail -- no partial registration occurs.

```typescript
import { addGeofences } from '@gabriel-sisjr/react-native-background-location';

await addGeofences([
  {
    identifier: 'zone-a',
    latitude: -23.5505,
    longitude: -46.6333,
    radius: 200,
  },
  {
    identifier: 'zone-b',
    latitude: -23.5612,
    longitude: -46.6558,
    radius: 150,
  },
]);
```

## Removing Geofences

```typescript
import {
  removeGeofence,
  removeGeofences,
  removeAllGeofences,
} from '@gabriel-sisjr/react-native-background-location';

// Remove a single geofence
await removeGeofence('office');

// Remove multiple geofences
await removeGeofences(['zone-a', 'zone-b']);

// Remove all geofences
await removeAllGeofences();
```

## Querying Active Geofences

```typescript
import {
  getActiveGeofences,
  getMaxGeofences,
} from '@gabriel-sisjr/react-native-background-location';

const active = await getActiveGeofences();
const limit = await getMaxGeofences();
console.log(`Monitoring ${active.length} / ${limit} geofences`);
```

## The `useGeofencing` Hook

The `useGeofencing` hook provides a complete CRUD interface with state management, loading indicators, and automatic refresh after every mutation.

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `autoLoad` | `boolean` | `true` | Fetch active geofences on mount |
| `notificationOptions` | `NotificationOptions` | `undefined` | Global notification config for transitions |

### Return Values

| Value | Type | Description |
|-------|------|-------------|
| `geofences` | `GeofenceRegion[]` | Currently active geofence regions |
| `isLoading` | `boolean` | Whether an async operation is in progress |
| `error` | `Error \| null` | Last error, or `null` |
| `addGeofence` | `(region) => Promise<void>` | Register a single geofence |
| `addGeofences` | `(regions) => Promise<void>` | Register multiple geofences atomically |
| `removeGeofence` | `(id) => Promise<void>` | Remove a geofence by identifier |
| `removeGeofences` | `(ids) => Promise<void>` | Remove multiple geofences |
| `removeAllGeofences` | `() => Promise<void>` | Remove all geofences |
| `maxGeofences` | `number \| null` | Platform limit, or `null` if not yet loaded |
| `refresh` | `() => Promise<void>` | Manually reload from native |
| `clearError` | `() => void` | Clear error state |

### Full CRUD Example

```typescript
import React from 'react';
import { View, Text, Button, FlatList, Alert } from 'react-native';
import { useGeofencing } from '@gabriel-sisjr/react-native-background-location';

function GeofenceManager() {
  const {
    geofences,
    isLoading,
    error,
    addGeofence,
    removeGeofence,
    removeAllGeofences,
    maxGeofences,
    refresh,
    clearError,
  } = useGeofencing();

  const handleAdd = async () => {
    try {
      await addGeofence({
        identifier: `zone-${Date.now()}`,
        latitude: -23.5505,
        longitude: -46.6333,
        radius: 200,
      });
    } catch (err) {
      Alert.alert('Failed', (err as Error).message);
    }
  };

  return (
    <View>
      <Text>
        Active: {geofences.length} / {maxGeofences ?? '...'}
      </Text>

      {error && (
        <View>
          <Text>Error: {error.message}</Text>
          <Button title="Dismiss" onPress={clearError} />
        </View>
      )}

      <Button title="Add" onPress={handleAdd} disabled={isLoading} />
      <Button title="Remove All" onPress={removeAllGeofences} disabled={isLoading} />
      <Button title="Refresh" onPress={refresh} disabled={isLoading} />

      <FlatList
        data={geofences}
        keyExtractor={(item) => item.identifier}
        renderItem={({ item }) => (
          <View>
            <Text>
              {item.identifier}: ({item.latitude}, {item.longitude}) r={item.radius}m
            </Text>
            <Button
              title="Remove"
              onPress={() => removeGeofence(item.identifier)}
            />
          </View>
        )}
      />
    </View>
  );
}
```

## Listening for Transitions with `useGeofenceEvents`

The `useGeofenceEvents` hook subscribes to real-time geofence transition events. It is a side-effect-only hook that returns `void`. Use it alongside `useGeofencing` for a complete solution.

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `onTransition` | `(event) => void` | `undefined` | Callback on each matching transition |
| `filter` | `GeofenceTransitionType[]` | `undefined` | Only emit these transition types |
| `geofenceId` | `string` | `undefined` | Only emit events for this geofence |

### Listen to All Transitions

```typescript
import { useGeofenceEvents } from '@gabriel-sisjr/react-native-background-location';

useGeofenceEvents({
  onTransition: (event) => {
    console.log(
      `${event.transitionType} at ${event.geofenceId} ` +
      `(${event.distanceFromCenter}m from center)`
    );
  },
});
```

### Filter by Transition Type

```typescript
import {
  useGeofenceEvents,
  GeofenceTransitionType,
} from '@gabriel-sisjr/react-native-background-location';

useGeofenceEvents({
  onTransition: (event) => {
    showNotification(`Entered ${event.geofenceId}`);
  },
  filter: [GeofenceTransitionType.ENTER],
});
```

### Filter by Geofence ID

```typescript
useGeofenceEvents({
  onTransition: (event) => {
    markAttendance(event.timestamp);
  },
  geofenceId: 'office-hq',
});
```

## GeofenceTransitionEvent

The event object received in `onTransition`:

| Property | Type | Description |
|----------|------|-------------|
| `geofenceId` | `string` | Identifier of the triggered geofence |
| `transitionType` | `GeofenceTransitionType` | `ENTER`, `EXIT`, or `DWELL` |
| `latitude` | `number` | Device latitude at transition |
| `longitude` | `number` | Device longitude at transition |
| `timestamp` | `string` | ISO 8601 timestamp |
| `distanceFromCenter` | `number` | Distance from geofence center in meters |
| `metadata` | `Record<string, unknown>` | Metadata from the geofence (if set) |

## Error Handling

All geofencing functions throw `GeofenceError` on failure. The error includes a `code` property.

```typescript
import {
  addGeofence,
  GeofenceError,
  GeofenceErrorCode,
} from '@gabriel-sisjr/react-native-background-location';

try {
  await addGeofence({
    identifier: 'office',
    latitude: -23.5505,
    longitude: -46.6333,
    radius: 200,
  });
} catch (error) {
  if (error instanceof GeofenceError) {
    switch (error.code) {
      case GeofenceErrorCode.DUPLICATE_IDENTIFIER:
        console.warn('Geofence already exists');
        break;
      case GeofenceErrorCode.LIMIT_EXCEEDED:
        Alert.alert('Limit reached', 'Remove some geofences first');
        break;
      case GeofenceErrorCode.PERMISSION_DENIED:
        console.error('Location permission required');
        break;
    }
  }
}
```

### Error Codes

| Code | Description |
|------|-------------|
| `INVALID_REGION` | Coordinates out of range, radius below 100m, or negative loitering delay |
| `DUPLICATE_IDENTIFIER` | Identifier already in use by an active geofence |
| `LIMIT_EXCEEDED` | Platform geofence limit reached (Android: 100, iOS: 20) |
| `MONITORING_FAILED` | Native monitoring could not start |
| `NOT_AVAILABLE` | Native module not linked or not available |
| `PERMISSION_DENIED` | Background location permission not granted |
| `PLAY_SERVICES_UNAVAILABLE` | Google Play Services not available (Android only) |

## Platform Limitations

| Feature | Android | iOS |
|---------|---------|-----|
| Maximum geofences | 100 | 20 |
| Minimum radius | 100m | 100m |
| DWELL detection | Native (`GeofencingClient`) | Software timer |
| Persistence | Room DB + `BootCompletedReceiver` | `CLLocationManager` (system-managed) |
| Background delivery | `BroadcastReceiver` (even when killed) | Delegate (relaunches app) |
| Requirements | Google Play Services | "Always" authorization |
| Event storage | Room Database | Core Data |

> **iOS note:** The 20-region limit is shared across all region monitoring, including iBeacon regions. The effective limit may be lower if other monitoring is active.

> **Android note:** Geofences are cleared when Google Play Services data is cleared. The library re-registers on boot via `BootCompletedReceiver`, but this does not work if the app has been force-stopped.

## Transition Events Storage

Transition events are persisted on-device and survive app restarts.

```typescript
import {
  getGeofenceTransitions,
  clearGeofenceTransitions,
} from '@gabriel-sisjr/react-native-background-location';

// Get all stored transitions
const allTransitions = await getGeofenceTransitions();

// Get transitions for a specific geofence
const officeTransitions = await getGeofenceTransitions('office');

// Clear transitions for a specific geofence
await clearGeofenceTransitions('office');

// Clear all transitions
await clearGeofenceTransitions();
```

## Combining Geofencing with Tracking

Geofencing and location tracking are independent features that can run simultaneously.

```typescript
import React, { useState } from 'react';
import { View, Text, FlatList } from 'react-native';
import {
  useGeofencing,
  useGeofenceEvents,
  useBackgroundLocation,
  GeofenceTransitionType,
} from '@gabriel-sisjr/react-native-background-location';
import type { GeofenceTransitionEvent } from '@gabriel-sisjr/react-native-background-location';

function GeofenceMonitor() {
  const [events, setEvents] = useState<GeofenceTransitionEvent[]>([]);
  const { geofences, maxGeofences } = useGeofencing();
  const { isTracking, startTracking, stopTracking } = useBackgroundLocation();

  useGeofenceEvents({
    onTransition: (event) => {
      setEvents((prev) => [event, ...prev].slice(0, 50));
    },
  });

  return (
    <View>
      <Text>Geofences: {geofences.length} / {maxGeofences}</Text>
      <Text>Tracking: {isTracking ? 'Active' : 'Stopped'}</Text>
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

## Next Steps

- [Advanced Geofencing](./geofencing-advanced.md) -- Server-driven geofencing, notification templates, and metadata
- [Notification Customization](./notification-customization.md) -- Configure geofence transition notifications
- [Permission Handling](./permission-handling.md) -- Ensure proper permissions for geofencing
- [Battery Optimization](./battery-optimization.md) -- Handle battery restrictions that affect geofence delivery
