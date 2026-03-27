# Geofencing: Advanced Usage

This guide covers advanced geofencing patterns for production applications. It assumes familiarity with the core geofencing API documented in the [Geofencing Guide](../getting-started/geofencing.md).

## Table of Contents

- [Server-Driven Geofencing](#server-driven-geofencing)
- [Programmatic Callbacks with useGeofenceEvents](#programmatic-callbacks-with-usegeofenceevents)
- [Full Combined Example](#full-combined-example)
- [Hook Stability](#hook-stability)

## Server-Driven Geofencing

In most production deployments, the mobile app does not define geofence coordinates locally. Instead, a backend API owns the geofence definitions -- coordinates, metadata, and notification templates -- and the app acts as a thin executor that registers whatever the server provides.

This pattern separates concerns cleanly:

- **Server** controls the business logic: which locations to monitor, what metadata to attach, how notifications should read.
- **App** handles the platform mechanics: registering geofences with the OS, displaying notifications, reacting to transitions.

### Fetching and Registering Geofences

The typical flow is: fetch the route or assignment from the server, clear any stale geofences, and register the new set.

```typescript
import {
  removeAllGeofences,
  addGeofences,
} from '@gabriel-sisjr/react-native-background-location';
import type { GeofenceRegion } from '@gabriel-sisjr/react-native-background-location';

async function syncGeofencesFromServer(driverId: string): Promise<void> {
  // Server returns GeofenceRegion[] with metadata + notificationOptions
  const response = await fetch(
    `https://api.example.com/drivers/${driverId}/route`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch route: ${response.status}`);
  }

  const regions: GeofenceRegion[] = await response.json();

  // Clear stale geofences from the previous route
  await removeAllGeofences();

  // Register all geofences from the server in a single atomic batch
  await addGeofences(regions);
}
```

### Server Response Format

The server response is a standard `GeofenceRegion[]` array. Each region can include `metadata` for business context and `notificationOptions` for per-geofence notification customization. Here is a realistic example with two delivery stops:

```json
[
  {
    "identifier": "delivery-1587",
    "latitude": -23.5614,
    "longitude": -46.6558,
    "radius": 200,
    "transitionTypes": ["ENTER", "EXIT", "DWELL"],
    "loiteringDelay": 60000,
    "metadata": {
      "orderNumber": "ORD-2024-1587",
      "client": {
        "name": "ACME Corp",
        "address": "Av. Paulista, 1000",
        "phone": "+5511999999999"
      },
      "estimatedArrival": "2026-03-26T14:30:00Z",
      "priority": "high"
    },
    "notificationOptions": {
      "title": "Delivery: {{metadata.client.name}}",
      "text": "Order #{{metadata.orderNumber}} -- {{metadata.client.address}}",
      "priority": "HIGH",
      "channelName": "Priority Deliveries",
      "transitionOverrides": {
        "ENTER": {
          "title": "Arriving: {{metadata.client.name}}",
          "text": "You are near the delivery point for order #{{metadata.orderNumber}}"
        },
        "EXIT": {
          "title": "Departed: {{metadata.client.name}}",
          "text": "Left delivery zone for order #{{metadata.orderNumber}}"
        },
        "DWELL": {
          "title": "At destination: {{metadata.client.name}}",
          "text": "Confirm delivery of order #{{metadata.orderNumber}}"
        }
      }
    }
  },
  {
    "identifier": "delivery-1588",
    "latitude": -23.5433,
    "longitude": -46.6291,
    "radius": 150,
    "transitionTypes": ["ENTER", "EXIT"],
    "metadata": {
      "orderNumber": "ORD-2024-1588",
      "client": {
        "name": "TechParts Ltd",
        "address": "R. Augusta, 500",
        "phone": "+5511988888888"
      },
      "estimatedArrival": "2026-03-26T15:45:00Z",
      "priority": "normal"
    }
  }
]
```

Key observations:

- **First geofence** (`delivery-1587`) includes custom `notificationOptions` with metadata templates and per-transition overrides. When the driver enters this geofence, the notification reads "Arriving: ACME Corp" with the order number and address.
- **Second geofence** (`delivery-1588`) omits `notificationOptions` entirely. It falls back to whatever global notification configuration the app has set via `configureGeofenceNotifications()` or the `useGeofencing` hook's `notificationOptions` option.
- Both geofences carry nested `metadata` that the app can use in callbacks (e.g., displaying the client phone number for a tap-to-call action) and in notification templates (e.g., `{{metadata.client.name}}`).

The server controls everything -- coordinates, metadata, notification templates. The app is the executor.

## Programmatic Callbacks with useGeofenceEvents

The `useGeofenceEvents` hook subscribes to real-time geofence transition events in the JS runtime. Use it to execute application logic when transitions occur -- API calls, navigation, state updates, analytics.

### Reacting to Transitions

```typescript
import { useGeofenceEvents } from '@gabriel-sisjr/react-native-background-location';
import { Alert } from 'react-native';

useGeofenceEvents({
  onTransition: async (event) => {
    switch (event.transitionType) {
      case 'ENTER':
        // POST arrival to the server
        await fetch('https://api.example.com/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            geofenceId: event.geofenceId,
            type: 'arrival',
            timestamp: event.timestamp,
            coordinates: {
              latitude: event.latitude,
              longitude: event.longitude,
            },
          }),
        });
        // Navigate to the delivery screen
        navigation.navigate('DeliveryDetails', {
          orderId: event.metadata?.orderNumber,
        });
        break;

      case 'EXIT':
        // POST departure to the server
        await fetch('https://api.example.com/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            geofenceId: event.geofenceId,
            type: 'departure',
            timestamp: event.timestamp,
          }),
        });
        // Prompt the driver for delivery confirmation
        Alert.alert(
          'Delivery Confirmation',
          `Did you complete the delivery at ${event.metadata?.client?.name ?? event.geofenceId}?`,
          [
            { text: 'Yes', onPress: () => confirmDelivery(event.geofenceId) },
            { text: 'No', style: 'cancel' },
          ]
        );
        break;

      case 'DWELL':
        // Log dwell time for analytics
        await fetch('https://api.example.com/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            geofenceId: event.geofenceId,
            type: 'dwell',
            timestamp: event.timestamp,
            distanceFromCenter: event.distanceFromCenter,
          }),
        });
        break;
    }
  },
});
```

### Notifications vs. Callbacks

It is important to understand the distinction between these two mechanisms, as they serve different purposes and operate under different constraints.

| Aspect              | Notifications                                              | Callbacks (`onTransition`)                                                                     |
| ------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **Execution layer** | Native (Android/iOS)                                       | JavaScript runtime                                                                             |
| **App state**       | Fire even when the app is killed or in the background      | Fire only when the JS runtime is active (app in foreground or background with JS bridge alive) |
| **Purpose**         | User-facing alerts (visual banners, sounds)                | Application logic (API calls, navigation, state updates)                                       |
| **Configuration**   | `notificationOptions` on `GeofenceRegion` or global config | `onTransition` callback in `useGeofenceEvents`                                                 |
| **Reliability**     | High -- handled entirely by the OS notification system     | Depends on JS runtime availability                                                             |

> **Both mechanisms can coexist.** A single geofence transition can trigger a native notification (visible to the user even if the app is killed) and a JS callback (executing application logic when the runtime is active). They are independent pipelines.

> **Design for offline-first.** If your app needs to guarantee that arrival/departure events reach the server, do not rely solely on JS callbacks. Use the native notification + stored transitions (`getGeofenceTransitions()`) as a fallback, and sync stored transitions when the app next opens.

## Full Combined Example

The following `DriverDeliveryScreen` component demonstrates a complete server-driven geofencing flow. It combines:

- `useGeofencing` with a global notification config using metadata templates
- A `syncFromServer()` function that fetches, clears, and registers geofences
- `useGeofenceEvents` with per-transition-type logic (API calls, navigation, alerts)
- A simple UI rendering the delivery route from geofence metadata

```typescript
import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, Alert, StyleSheet } from 'react-native';
import {
  useGeofencing,
  useGeofenceEvents,
} from '@gabriel-sisjr/react-native-background-location';
import type { GeofenceRegion } from '@gabriel-sisjr/react-native-background-location';

interface Props {
  driverId: string;
  navigation: any;
}

export function DriverDeliveryScreen({ driverId, navigation }: Props) {
  const [syncing, setSyncing] = useState(false);

  const { geofences, addGeofences, removeAllGeofences, isLoading, error } =
    useGeofencing({
      notificationOptions: {
        title: 'Delivery: {{metadata.client.name}}',
        text: 'Order #{{metadata.orderNumber}} -- {{metadata.client.address}}',
        channelName: 'Delivery Alerts',
        transitionOverrides: {
          ENTER: {
            title: 'Arriving: {{metadata.client.name}}',
            text: 'Near delivery point for #{{metadata.orderNumber}}',
          },
          EXIT: {
            title: 'Departed: {{metadata.client.name}}',
            text: 'Left zone for #{{metadata.orderNumber}}',
          },
          DWELL: {
            title: 'At destination: {{metadata.client.name}}',
            text: 'Confirm delivery of #{{metadata.orderNumber}}',
          },
        },
      },
    });

  //  Server sync

  const syncFromServer = async () => {
    setSyncing(true);
    try {
      const response = await fetch(
        `https://api.example.com/drivers/${driverId}/route`
      );
      if (!response.ok) throw new Error(`Server error: ${response.status}`);

      const regions: GeofenceRegion[] = await response.json();
      await removeAllGeofences();
      await addGeofences(regions);
    } catch (err) {
      Alert.alert('Sync Failed', (err as Error).message);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    syncFromServer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId]);

  //  Transition callbacks

  useGeofenceEvents({
    onTransition: async (event) => {
      switch (event.transitionType) {
        case 'ENTER':
          await postEvent(event.geofenceId, 'arrival', event.timestamp);
          navigation.navigate('DeliveryDetails', {
            orderId: event.metadata?.orderNumber,
          });
          break;
        case 'EXIT':
          await postEvent(event.geofenceId, 'departure', event.timestamp);
          Alert.alert(
            'Delivery Complete?',
            `Confirm delivery for ${event.metadata?.client?.name ?? event.geofenceId}`,
            [
              { text: 'Yes', onPress: () => confirmDelivery(event.geofenceId) },
              { text: 'No', style: 'cancel' },
            ]
          );
          break;
        case 'DWELL':
          await postEvent(event.geofenceId, 'dwell', event.timestamp);
          break;
      }
    },
  });

  //  UI

  return (
    <View style={styles.container}>
      <Text style={styles.header}>
        Delivery Route ({geofences.length} stops)
      </Text>

      {(syncing || isLoading) && <Text style={styles.status}>Loading...</Text>}
      {error && <Text style={styles.error}>Error: {error.message}</Text>}

      <FlatList
        data={geofences}
        keyExtractor={(item) => item.identifier}
        renderItem={({ item, index }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {index + 1}. {(item.metadata?.client as any)?.name ?? item.identifier}
            </Text>
            <Text style={styles.cardText}>
              Order: {(item.metadata?.orderNumber as string) ?? '--'}
            </Text>
            <Text style={styles.cardText}>
              ETA: {formatTime((item.metadata?.estimatedArrival as string) ?? '')}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

//  Helpers

async function postEvent(
  geofenceId: string,
  type: string,
  timestamp: string
): Promise<void> {
  await fetch('https://api.example.com/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ geofenceId, type, timestamp }),
  });
}

async function confirmDelivery(geofenceId: string): Promise<void> {
  await fetch(`https://api.example.com/deliveries/${geofenceId}/confirm`, {
    method: 'POST',
  });
}

function formatTime(iso: string): string {
  if (!iso) return '--';
  const date = new Date(iso);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: { fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  status: { color: '#666', marginBottom: 8 },
  error: { color: '#d32f2f', marginBottom: 8 },
  card: {
    padding: 12,
    marginBottom: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  cardText: { fontSize: 14, color: '#555', marginTop: 2 },
});
```

### What This Example Demonstrates

| Concern | How it is handled |
| | |
| **Geofence source** | Fetched from the server via `syncFromServer()`. The server owns all coordinates, metadata, and notification templates. |
| **Notification config** | Global config set via `useGeofencing({ notificationOptions })` with metadata templates (`{{metadata.client.name}}`, `{{metadata.orderNumber}}`). Per-geofence overrides from the server response take precedence when present. |
| **Transition callbacks** | `useGeofenceEvents` reacts to ENTER (navigate + API call), EXIT (confirmation alert + API call), and DWELL (analytics API call). |
| **Route display** | `FlatList` renders the geofence list with client name, order number, and ETA extracted from `metadata`. |
| **Error handling** | Sync errors are shown via `Alert`. Hook errors are rendered inline. |

## Hook Stability

Both `useGeofencing` and `useGeofenceEvents` are designed so that consumers do not need to wrap options in `useMemo` or callbacks in `useCallback`. Passing inline objects and arrow functions directly to these hooks is safe and will not cause unnecessary re-subscriptions or native calls.

### Why This Works

- **`useGeofencing`** uses `JSON.stringify` for deep comparison of `notificationOptions`. A new object reference with the same content does not trigger a native reconfiguration. All returned functions (`addGeofence`, `removeGeofence`, etc.) are wrapped in `useCallback`, and the entire return value is wrapped in `useMemo`.
- **`useGeofenceEvents`** stores `onTransition`, `filter`, and `geofenceId` in `useRef` values. The native event subscription is created once on mount and reads current values from refs on every event. New callback instances or new filter arrays do not cause re-subscription.

### Before (unnecessary memoization)

```typescript
// This works but the memoization is redundant
const options = useMemo(
  () => ({
    notificationOptions: {
      title: 'Delivery: {{metadata.client.name}}',
      text: 'Order #{{metadata.orderNumber}}',
    },
  }),
  []
);
useGeofencing(options);

const handleTransition = useCallback((event) => {
  console.log(event.transitionType, event.geofenceId);
}, []);
useGeofenceEvents({ onTransition: handleTransition });
```

### After (recommended)

```typescript
// Inline objects and callbacks work correctly without memoization
useGeofencing({
  notificationOptions: {
    title: 'Delivery: {{metadata.client.name}}',
    text: 'Order #{{metadata.orderNumber}}',
  },
});

useGeofenceEvents({
  onTransition: (event) => {
    console.log(event.transitionType, event.geofenceId);
  },
});
```

Both snippets produce identical behavior. The second form is simpler and recommended.

## See Also

- [Geofencing Guide](../getting-started/geofencing.md) -- Core API reference, hooks, types, and notification customization
- [React Hooks Guide](../getting-started/hooks.md) -- Documentation for all hooks
- [Notification Customization Implementation](NOTIFICATION_CUSTOMIZATION_IMPLEMENTATION.md) -- Internal implementation details for notification template resolution
- [Battery Optimization](../production/BATTERY_OPTIMIZATION.md) -- Handling battery restrictions that affect geofence delivery
- [Platform Comparison](../production/PLATFORM_COMPARISON.md) -- Android vs iOS behavior differences
