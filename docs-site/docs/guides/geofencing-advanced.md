---
sidebar_position: 4
title: Advanced Geofencing
description: Advanced geofencing patterns — server-driven geofencing, notification template variables, per-geofence notification overrides, transition-type overrides, metadata in templates, and hook stability.
keywords:
  - geofencing
  - advanced
  - server-driven
  - notification templates
  - metadata
  - transitionOverrides
  - configureGeofenceNotifications
  - useGeofenceEvents
  - React Native
---

# Advanced Geofencing

This guide covers production-ready geofencing patterns: server-driven geofencing, notification template customization, per-geofence notification overrides, and programmatic transition handling. It assumes familiarity with the [Geofencing](./geofencing) guide.

## Server-Driven Geofencing

In production deployments, the backend API typically owns geofence definitions -- coordinates, metadata, and notification templates. The app acts as a thin executor that registers whatever the server provides.

### Fetching and Registering

```typescript
import {
  removeAllGeofences,
  addGeofences,
} from '@gabriel-sisjr/react-native-background-location';
import type { GeofenceRegion } from '@gabriel-sisjr/react-native-background-location';

async function syncGeofencesFromServer(driverId: string): Promise<void> {
  const response = await fetch(
    `https://api.example.com/drivers/${driverId}/route`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch route: ${response.status}`);
  }

  const regions: GeofenceRegion[] = await response.json();

  // Clear stale geofences from the previous route
  await removeAllGeofences();

  // Register all geofences in a single atomic batch
  await addGeofences(regions);
}
```

### Server Response Format

The server response is a standard `GeofenceRegion[]` array. Each region can include `metadata` for business context and `notificationOptions` for per-geofence notification customization.

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
        "address": "Av. Paulista, 1000"
      },
      "priority": "high"
    },
    "notificationOptions": {
      "title": "Delivery: {{metadata.client.name}}",
      "text": "Order #{{metadata.orderNumber}} -- {{metadata.client.address}}",
      "transitionOverrides": {
        "ENTER": {
          "title": "Arriving: {{metadata.client.name}}",
          "text": "Near delivery point for #{{metadata.orderNumber}}"
        },
        "EXIT": {
          "title": "Departed: {{metadata.client.name}}",
          "text": "Left zone for #{{metadata.orderNumber}}"
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
        "address": "R. Augusta, 500"
      }
    }
  }
]
```

Key observations:

- **First geofence** includes custom `notificationOptions` with metadata templates and per-transition overrides.
- **Second geofence** omits `notificationOptions` entirely, falling back to the global notification configuration.
- Both carry nested `metadata` available in both JS callbacks and notification templates.

## Notification Template Variables

The `title` and `text` fields in `NotificationOptions` support template variables that are resolved on the native side at notification time.

| Variable | Example Output | Description |
|----------|----------------|-------------|
| `{{identifier}}` | `warehouse-north` | Geofence identifier from registration |
| `{{transitionType}}` | `ENTER` | Transition type: `ENTER`, `EXIT`, or `DWELL` |
| `{{latitude}}` | `-23.5505` | Device latitude at transition |
| `{{longitude}}` | `-46.6333` | Device longitude at transition |
| `{{radius}}` | `200` | Geofence radius in meters |
| `{{timestamp}}` | `2026-03-25T14:30:00Z` | ISO 8601 timestamp |
| `{{metadata.KEY}}` | *(value)* | Value from the geofence `metadata` object |

### Metadata Variables

Use dot notation to access nested metadata values. Any valid JSON path works.

| Syntax | Description | Example |
|--------|-------------|---------|
| `{{metadata.fieldName}}` | Top-level field | `{{metadata.customerName}}` |
| `{{metadata.parent.child}}` | Nested field | `{{metadata.site.address}}` |
| `{{metadata.a.b.c}}` | Arbitrary depth | `{{metadata.vehicle.driver.name}}` |

If a metadata key does not exist or `metadata` is `undefined`, the placeholder resolves to an empty string. No error is thrown.

### Dev-Mode Validation

In `__DEV__` mode, the library warns on unknown template variables with "did you mean?" suggestions. For example, `{{indentifier}}` (typo) produces a console warning suggesting `{{identifier}}`.

### Autocomplete Helper

```typescript
import { GEOFENCE_TEMPLATE_VARS } from '@gabriel-sisjr/react-native-background-location';

console.log(GEOFENCE_TEMPLATE_VARS.IDENTIFIER);       // '{{identifier}}'
console.log(GEOFENCE_TEMPLATE_VARS.TRANSITION_TYPE);   // '{{transitionType}}'
console.log(GEOFENCE_TEMPLATE_VARS.LATITUDE);          // '{{latitude}}'
console.log(GEOFENCE_TEMPLATE_VARS.LONGITUDE);         // '{{longitude}}'
console.log(GEOFENCE_TEMPLATE_VARS.RADIUS);            // '{{radius}}'
console.log(GEOFENCE_TEMPLATE_VARS.TIMESTAMP);         // '{{timestamp}}'
```

## Configuring Geofence Notifications

### Global Configuration

Configure notifications globally using `configureGeofenceNotifications()`. Configuration persists across app restarts (SharedPreferences on Android, UserDefaults on iOS).

```typescript
import { configureGeofenceNotifications } from '@gabriel-sisjr/react-native-background-location';

await configureGeofenceNotifications({
  title: '{{transitionType}} -- {{identifier}}',
  text: 'Geofence transition at {{latitude}}, {{longitude}}',
  channelName: 'Geofence Alerts',
});
```

### Hook-Based Configuration

The `useGeofencing` hook can configure notifications declaratively.

```typescript
const { geofences, addGeofence } = useGeofencing({
  notificationOptions: {
    title: '{{transitionType}} -- {{identifier}}',
    text: 'Transition detected at {{latitude}}, {{longitude}}',
  },
});
```

The hook calls `configureGeofenceNotifications()` on mount and reconfigures whenever the content of `notificationOptions` changes. It uses JSON serialization for deep comparison -- a new object reference with the same content does not trigger reconfiguration.

> **Important:** When `notificationOptions` is provided to the hook, it overrides any previous imperative call to `configureGeofenceNotifications()`. Use either the hook option or the imperative API, not both simultaneously.

### Disabling Notifications

```typescript
await configureGeofenceNotifications({
  enabled: false,
});
```

Transition events still fire to JS callbacks, but no visual notification is shown.

### Retrieving Current Configuration

```typescript
import { getGeofenceNotificationConfig } from '@gabriel-sisjr/react-native-background-location';

const config = await getGeofenceNotificationConfig();
console.log('Current config:', config);
// Returns {} if no configuration has been set
```

## Per-Geofence Notification Overrides

Individual geofences can override the global notification configuration.

### Custom Notification

```typescript
await addGeofence({
  identifier: 'headquarters',
  latitude: 40.7128,
  longitude: -74.006,
  radius: 500,
  notificationOptions: {
    title: 'Welcome to HQ!',
    text: 'You arrived at {{identifier}}',
  },
});
```

Fields not specified in the override fall through to the global configuration.

### Suppressing Notifications

Set `notificationOptions` to `false` to suppress notifications for a specific geofence. Events still fire to JS callbacks.

```typescript
await addGeofence({
  identifier: 'silent-tracking-zone',
  latitude: -23.5505,
  longitude: -46.6333,
  radius: 300,
  notificationOptions: false,
});
```

### Per-Transition-Type Overrides

Use `transitionOverrides` to customize notification content for specific transition types.

```typescript
import {
  addGeofence,
  GeofenceTransitionType,
} from '@gabriel-sisjr/react-native-background-location';

await addGeofence({
  identifier: 'warehouse-main',
  latitude: -23.5612,
  longitude: -46.6558,
  radius: 250,
  transitionTypes: [
    GeofenceTransitionType.ENTER,
    GeofenceTransitionType.EXIT,
    GeofenceTransitionType.DWELL,
  ],
  loiteringDelay: 120000,
  notificationOptions: {
    title: 'Warehouse Zone',
    text: 'Transition at {{identifier}}',
    transitionOverrides: {
      ENTER: {
        title: 'Arrived at Warehouse',
        text: 'Driver entered {{identifier}} at {{timestamp}}',
        color: '#4CAF50',
      },
      EXIT: {
        title: 'Left Warehouse',
        text: 'Driver exited {{identifier}}',
        color: '#f44336',
      },
      DWELL: {
        title: 'Dwelling at Warehouse',
        text: 'Driver at {{identifier}} for the configured duration',
        color: '#FF9800',
      },
    },
  },
});
```

### Resolution Chain

When a transition fires, notification content is resolved in this order (highest priority first):

1. **Per-geofence `transitionOverrides[type]`** -- Transition-specific override on the geofence
2. **Per-geofence `notificationOptions`** -- The geofence's own options (excluding `transitionOverrides`)
3. **Global `transitionOverrides[type]`** -- Transition-specific override on the global config
4. **Global config** -- Base global configuration
5. **Built-in defaults** -- Title: `{{transitionType}} zone: {{identifier}}`, Text: `Transition detected`

Each field is resolved independently. A geofence could inherit the global `title` but override only `text`.

## Metadata in Notification Templates

The `metadata` field on `GeofenceRegion` accepts any JSON-serializable object. Values in `metadata` are available in notification templates through `{{metadata.KEY}}`.

### Logistics Example

```typescript
const { addGeofence } = useGeofencing({
  notificationOptions: {
    title: 'Delivery Update',
    text: 'Arriving at {{metadata.customerName}}. Order #{{metadata.orderNumber}}.',
  },
});

await addGeofence({
  identifier: 'delivery-42',
  latitude: -23.5505,
  longitude: -46.6333,
  radius: 150,
  transitionTypes: [GeofenceTransitionType.ENTER],
  metadata: {
    customerName: 'Maria Silva',
    orderNumber: '98432',
  },
});

// ENTER notification:
//   Title: "Delivery Update"
//   Text:  "Arriving at Maria Silva. Order #98432."
```

### Nested Metadata Example

```typescript
await addGeofence({
  identifier: 'client-site-7',
  latitude: -23.5612,
  longitude: -46.6558,
  radius: 300,
  transitionTypes: [GeofenceTransitionType.ENTER, GeofenceTransitionType.EXIT],
  metadata: {
    site: {
      name: 'Warehouse Central',
      address: 'Av. Paulista, 1000 - Sao Paulo',
    },
    fleet: { vehicleId: 'VH-042' },
  },
  notificationOptions: {
    transitionOverrides: {
      ENTER: {
        title: 'Arrived',
        text: 'Driver arrived at {{metadata.site.name}} -- {{metadata.site.address}}.',
      },
      EXIT: {
        title: 'Departed',
        text: 'Driver left {{metadata.site.name}}. Vehicle {{metadata.fleet.vehicleId}}.',
      },
    },
  },
});
```

### Cross-Platform Behavior

Template resolution is performed entirely on the native side, so notifications render correctly even when the JS runtime is inactive. Both platforms use the same regex and dot-walk algorithm.

| Aspect | Android | iOS |
|--------|---------|-----|
| Implementation | `GeofenceTemplateResolver.kt` | `GeofenceNotificationConfig.swift` |
| Regex pattern | `\{\{(\w+(?:\.\w+)*)\}\}` | `\{\{(\w+(?:\.\w+)*)\}\}` |
| Missing field result | Empty string `""` | Empty string `""` |

No platform-specific code is needed for metadata templates.

## Programmatic Callbacks with `useGeofenceEvents`

Use `useGeofenceEvents` to execute application logic when transitions occur.

```typescript
import { useGeofenceEvents } from '@gabriel-sisjr/react-native-background-location';
import { Alert } from 'react-native';

useGeofenceEvents({
  onTransition: async (event) => {
    switch (event.transitionType) {
      case 'ENTER':
        await fetch('https://api.example.com/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            geofenceId: event.geofenceId,
            type: 'arrival',
            timestamp: event.timestamp,
          }),
        });
        navigation.navigate('DeliveryDetails', {
          orderId: event.metadata?.orderNumber,
        });
        break;

      case 'EXIT':
        Alert.alert(
          'Delivery Confirmation',
          `Did you complete delivery at ${event.metadata?.client?.name ?? event.geofenceId}?`,
          [
            { text: 'Yes', onPress: () => confirmDelivery(event.geofenceId) },
            { text: 'No', style: 'cancel' },
          ]
        );
        break;

      case 'DWELL':
        await logDwellEvent(event.geofenceId, event.timestamp);
        break;
    }
  },
});
```

### Notifications vs. Callbacks

| Aspect | Notifications | Callbacks (`onTransition`) |
|--------|--------------|---------------------------|
| Execution layer | Native (Android/iOS) | JavaScript runtime |
| App state | Fire even when app is killed | Fire only when JS runtime is active |
| Purpose | User-facing alerts | Application logic (API calls, navigation) |
| Reliability | High (OS notification system) | Depends on JS runtime availability |

Both mechanisms coexist. A single transition can trigger a native notification and a JS callback simultaneously.

> **Tip:** If your app needs to guarantee that events reach the server, do not rely solely on JS callbacks. Use stored transitions (`getGeofenceTransitions()`) as a fallback and sync them when the app next opens.

## Full Combined Example

```typescript
import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, Alert, StyleSheet } from 'react-native';
import {
  useGeofencing,
  useGeofenceEvents,
} from '@gabriel-sisjr/react-native-background-location';
import type { GeofenceRegion } from '@gabriel-sisjr/react-native-background-location';

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
        },
      },
    });

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
  }, [driverId]);

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
          break;
        case 'DWELL':
          await postEvent(event.geofenceId, 'dwell', event.timestamp);
          break;
      }
    },
  });

  return (
    <View style={styles.container}>
      <Text style={styles.header}>
        Delivery Route ({geofences.length} stops)
      </Text>
      {(syncing || isLoading) && <Text>Loading...</Text>}
      {error && <Text style={styles.error}>Error: {error.message}</Text>}
      <FlatList
        data={geofences}
        keyExtractor={(item) => item.identifier}
        renderItem={({ item, index }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {index + 1}. {(item.metadata?.client as any)?.name ?? item.identifier}
            </Text>
            <Text>
              Order: {(item.metadata?.orderNumber as string) ?? '--'}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: { fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  error: { color: '#d32f2f', marginBottom: 8 },
  card: {
    padding: 12,
    marginBottom: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  cardTitle: { fontSize: 16, fontWeight: '600' },
});
```

## Hook Stability

Both `useGeofencing` and `useGeofenceEvents` are designed so that consumers do not need to wrap options in `useMemo` or callbacks in `useCallback`. Passing inline objects and arrow functions directly is safe.

**Why this works:**

- `useGeofencing` uses `JSON.stringify` for deep comparison of `notificationOptions`. Same content = no native reconfiguration.
- `useGeofenceEvents` stores `onTransition`, `filter`, and `geofenceId` in `useRef` values. The subscription is created once on mount and reads current values from refs.

```typescript
// Recommended: inline objects and callbacks work correctly
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

No `useMemo` or `useCallback` wrappers needed.

## Next Steps

- [Geofencing Basics](./geofencing) -- Core API reference and quick start
- [Notification Customization](./notification-customization) -- Full notification configuration reference
- [Permission Handling](./permission-handling) -- Ensure proper permissions for geofencing
- [Battery Optimization](./battery-optimization) -- Handle battery restrictions affecting geofence delivery
