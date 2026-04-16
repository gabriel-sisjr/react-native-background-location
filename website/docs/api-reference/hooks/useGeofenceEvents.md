---
sidebar_position: 6
title: useGeofenceEvents
description: API reference for the useGeofenceEvents hook — real-time geofence transition event listener with transition type and geofence ID filtering.
keywords:
  - react-native
  - background-location
  - hook
  - useGeofenceEvents
  - geofence
  - geofence-transitions
  - real-time
  - NativeEventEmitter
---

# useGeofenceEvents

Real-time geofence transition event listener. Subscribes to native geofence transition events via `NativeEventEmitter` and applies optional filters before invoking the callback.

```ts
import { useGeofenceEvents } from '@gabriel-sisjr/react-native-background-location';
```

**Platform:** Android and iOS

---

## Signature

```ts
function useGeofenceEvents(options?: UseGeofenceEventsOptions): void
```

This hook returns `void`. It is a side-effect-only hook that fires the `onTransition` callback.

---

## Parameters

The hook accepts a single optional `UseGeofenceEventsOptions` object.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `onTransition` | `(event: GeofenceTransitionEvent) => void` | — | Callback invoked when a geofence transition is detected (after filters are applied) |
| `filter` | `GeofenceTransitionType[]` | — | Only emit events matching these transition types. If omitted, all transition types fire the callback. |
| `geofenceId` | `string` | — | Only emit events for this specific geofence identifier. If omitted, events from all geofences fire the callback. |

> **Note:** All options are accessed via refs internally. The subscription is created once on mount. Changing `onTransition`, `filter`, or `geofenceId` does **not** cause re-subscription -- the handler always reads the latest values from refs. This means passing inline functions or new arrays is safe and causes no overhead.

---

## Filtering

Filters are applied in sequence before the `onTransition` callback is invoked:

1. **Transition type filter** -- If `filter` is provided and non-empty, the event's `transitionType` must be included in the array
2. **Geofence ID filter** -- If `geofenceId` is provided, the event's `geofenceId` must match exactly

Both filters must pass for the callback to fire. If neither filter is provided, all transition events invoke the callback.

---

## Event Shape

The `onTransition` callback receives a [`GeofenceTransitionEvent`](../types.md#geofencetransitionevent) object:

```ts
interface GeofenceTransitionEvent {
  geofenceId: string;
  transitionType: GeofenceTransitionType;
  latitude: number;
  longitude: number;
  timestamp: string;           // ISO 8601 string
  distanceFromCenter: number;  // meters
  metadata?: Record<string, unknown>;
}
```

---

## Usage

### Listen to all transitions

```tsx
import { useGeofenceEvents } from '@gabriel-sisjr/react-native-background-location';

function GeofenceMonitor() {
  useGeofenceEvents({
    onTransition: (event) => {
      console.log(
        `${event.transitionType} geofence "${event.geofenceId}" ` +
        `at ${event.latitude}, ${event.longitude}`
      );
    },
  });

  return <Text>Monitoring geofence transitions...</Text>;
}
```

### Filter by transition type

```tsx
import {
  useGeofenceEvents,
  GeofenceTransitionType,
} from '@gabriel-sisjr/react-native-background-location';

function EntryExitMonitor() {
  useGeofenceEvents({
    onTransition: (event) => {
      if (event.transitionType === GeofenceTransitionType.ENTER) {
        showWelcomeNotification(event.geofenceId);
      } else {
        showGoodbyeNotification(event.geofenceId);
      }
    },
    filter: [GeofenceTransitionType.ENTER, GeofenceTransitionType.EXIT],
  });

  return <Text>Listening for enter/exit events...</Text>;
}
```

### Filter by specific geofence

```tsx
function OfficeMonitor() {
  useGeofenceEvents({
    onTransition: (event) => {
      console.log('Office transition:', event.transitionType);
      console.log('Distance from center:', event.distanceFromCenter, 'm');
    },
    geofenceId: 'office-hq',
  });

  return <Text>Monitoring office geofence...</Text>;
}
```

### Combined filters

```tsx
function OfficeArrivalMonitor() {
  useGeofenceEvents({
    onTransition: (event) => {
      // Only fires for ENTER events at 'office-hq'
      api.logArrival({
        geofenceId: event.geofenceId,
        timestamp: event.timestamp,
        latitude: event.latitude,
        longitude: event.longitude,
      });
    },
    filter: [GeofenceTransitionType.ENTER],
    geofenceId: 'office-hq',
  });

  return <Text>Watching for office arrivals...</Text>;
}
```

### Dwell detection

```tsx
function DwellMonitor() {
  useGeofenceEvents({
    onTransition: (event) => {
      console.log(
        `Dwelled at "${event.geofenceId}" for the configured duration. ` +
        `Distance from center: ${event.distanceFromCenter}m`
      );
    },
    filter: [GeofenceTransitionType.DWELL],
  });

  return <Text>Monitoring dwell events...</Text>;
}
```

### Using with state

Since the hook returns `void`, use React state to store events if you need to render them:

```tsx
function GeofenceEventLog() {
  const [events, setEvents] = useState<GeofenceTransitionEvent[]>([]);

  useGeofenceEvents({
    onTransition: (event) => {
      setEvents((prev) => [...prev, event]);
    },
  });

  return (
    <FlatList
      data={events}
      keyExtractor={(_, index) => index.toString()}
      renderItem={({ item }) => (
        <Text>
          {item.transitionType} - {item.geofenceId} at {item.timestamp}
        </Text>
      )}
    />
  );
}
```

---

## Relationship with useGeofencing

`useGeofenceEvents` and [`useGeofencing`](./useGeofencing.md) serve complementary purposes:

| Concern | `useGeofencing` | `useGeofenceEvents` |
|---------|----------------|---------------------|
| Register/remove geofences | Yes | No |
| List active geofences | Yes | No |
| Listen for transitions | No | Yes |
| Filter events | N/A | Yes |

A typical pattern combines both hooks:

```tsx
function GeofenceScreen() {
  const { geofences, addGeofence, removeGeofence } = useGeofencing();

  useGeofenceEvents({
    onTransition: (event) => {
      // React to transitions in real time
      showNotification(event);
    },
  });

  return (
    <View>
      <Text>{geofences.length} active geofences</Text>
      {/* CRUD UI here */}
    </View>
  );
}
```
