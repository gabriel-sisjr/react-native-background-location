---
sidebar_position: 5
title: useGeofencing
description: API reference for the useGeofencing hook — geofence region CRUD operations with automatic state management, error handling, and notification configuration.
keywords:
  - react-native
  - background-location
  - hook
  - useGeofencing
  - geofence
  - geofence-management
  - CRUD
---

# useGeofencing

Hook for managing geofence regions with full CRUD operations. Provides automatic state management, error handling, loading indicators, and optional notification configuration.

```ts
import { useGeofencing } from '@gabriel-sisjr/react-native-background-location';
```

**Platform:** Android and iOS

---

## Signature

```ts
function useGeofencing(options?: UseGeofencingOptions): UseGeofencingReturn
```

---

## Parameters

The hook accepts a single optional `UseGeofencingOptions` object.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `autoLoad` | `boolean` | `true` | Whether to automatically load active geofences and platform limit on mount |
| `notificationOptions` | [`NotificationOptions`](../types.md#notificationoptions) | — | Global notification configuration for geofence transitions. When provided, calls `configureGeofenceNotifications()` on mount. Changes to this object trigger reconfiguration. |

---

## Return Value

Returns a `UseGeofencingReturn` object.

### State Properties

| Property | Type | Description |
|----------|------|-------------|
| `geofences` | [`GeofenceRegion[]`](../types.md#geofenceregion) | Currently active geofence regions |
| `isLoading` | `boolean` | Whether an async operation is in progress |
| `error` | `Error \| null` | Last error that occurred (may be a [`GeofenceError`](../errors.md)) |
| `maxGeofences` | `number \| null` | Maximum geofences supported by the platform, or `null` if not yet loaded |

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `addGeofence` | `(region: GeofenceRegion) => Promise<void>` | Register a single geofence region. Automatically refreshes the geofences list on success. |
| `addGeofences` | `(regions: GeofenceRegion[]) => Promise<void>` | Register multiple geofence regions atomically. Automatically refreshes on success. |
| `removeGeofence` | `(identifier: string) => Promise<void>` | Remove a single geofence by identifier. Automatically refreshes on success. |
| `removeGeofences` | `(identifiers: string[]) => Promise<void>` | Remove multiple geofences by identifiers. Automatically refreshes on success. |
| `removeAllGeofences` | `() => Promise<void>` | Remove all registered geofences. Automatically refreshes on success. |
| `refresh` | `() => Promise<void>` | Manually reload active geofences and platform limit from the native module. |
| `clearError` | `() => void` | Reset the `error` state to `null`. |

---

## Behavior Details

### Auto-Load

When `autoLoad` is `true` (the default), the hook loads active geofences and the platform limit on mount by calling `getActiveGeofences()` and `getMaxGeofences()` in parallel.

### Auto-Refresh After Mutations

All mutation methods (`addGeofence`, `addGeofences`, `removeGeofence`, `removeGeofences`, `removeAllGeofences`) automatically call `refresh()` after a successful operation. This keeps the `geofences` array in sync with the native state.

### Notification Configuration

When `notificationOptions` is provided, the hook calls `configureGeofenceNotifications()` on mount. If the `notificationOptions` object changes (deep comparison via JSON serialization), the configuration is re-applied.

### Error Handling

All mutation methods:
1. Clear the previous error before starting
2. Capture errors in the `error` state
3. Re-throw the error so callers can handle it inline with try/catch

---

## Usage

### Basic geofence management

```tsx
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
    try {
      await addGeofence({
        identifier: 'office',
        latitude: -23.5505,
        longitude: -46.6333,
        radius: 200,
      });
      console.log('Geofence added');
    } catch (err) {
      console.error('Failed to add geofence:', err);
    }
  };

  return (
    <View>
      <Text>
        Active: {geofences.length} / {maxGeofences ?? '...'}
      </Text>

      <Button title="Add Office" onPress={handleAdd} disabled={isLoading} />

      {geofences.map((g) => (
        <View key={g.identifier}>
          <Text>{g.identifier}</Text>
          <Button
            title="Remove"
            onPress={() => removeGeofence(g.identifier)}
          />
        </View>
      ))}

      {error && <Text style={{ color: 'red' }}>{error.message}</Text>}
    </View>
  );
}
```

### With notification configuration

```tsx
import {
  useGeofencing,
  GEOFENCE_TEMPLATE_VARS,
  NotificationPriority,
} from '@gabriel-sisjr/react-native-background-location';

function GeofenceWithNotifications() {
  const { geofences, addGeofence } = useGeofencing({
    notificationOptions: {
      title: 'Geofence Alert',
      text: `Transition at ${GEOFENCE_TEMPLATE_VARS.IDENTIFIER}`,
      priority: NotificationPriority.HIGH,
      transitionOverrides: {
        ENTER: {
          title: 'Arrived',
          text: `You entered ${GEOFENCE_TEMPLATE_VARS.IDENTIFIER}`,
        },
        EXIT: {
          title: 'Departed',
          text: `You left ${GEOFENCE_TEMPLATE_VARS.IDENTIFIER}`,
        },
      },
    },
  });

  // Notifications are configured automatically on mount
  return <Text>{geofences.length} geofences active</Text>;
}
```

### Batch operations

```tsx
function BatchGeofenceManager() {
  const { addGeofences, removeGeofences, removeAllGeofences, geofences } =
    useGeofencing();

  const handleAddBatch = async () => {
    await addGeofences([
      {
        identifier: 'office',
        latitude: -23.5505,
        longitude: -46.6333,
        radius: 200,
      },
      {
        identifier: 'home',
        latitude: -23.5629,
        longitude: -46.6544,
        radius: 150,
      },
      {
        identifier: 'gym',
        latitude: -23.5700,
        longitude: -46.6400,
        radius: 100,
      },
    ]);
  };

  const handleRemoveSelected = async () => {
    await removeGeofences(['office', 'gym']);
  };

  const handleClearAll = async () => {
    await removeAllGeofences();
  };

  return (
    <View>
      <Button title="Add 3 Geofences" onPress={handleAddBatch} />
      <Button title="Remove Office & Gym" onPress={handleRemoveSelected} />
      <Button title="Clear All" onPress={handleClearAll} />
    </View>
  );
}
```

### Per-geofence notification overrides

```tsx
function SmartGeofences() {
  const { addGeofence } = useGeofencing({
    notificationOptions: {
      title: 'Location Alert',
      text: 'Geofence transition detected',
    },
  });

  // Silent geofence -- no notification
  await addGeofence({
    identifier: 'silent-zone',
    latitude: 40.7128,
    longitude: -74.006,
    radius: 200,
    notificationOptions: false, // Suppress notifications
  });

  // Custom notification for a specific geofence
  await addGeofence({
    identifier: 'headquarters',
    latitude: 40.7128,
    longitude: -74.006,
    radius: 500,
    notificationOptions: {
      title: 'Welcome to HQ',
      text: 'You arrived at headquarters',
    },
  });
}
```

### Without auto-load

```tsx
function LazyGeofences() {
  const { geofences, refresh } = useGeofencing({ autoLoad: false });

  // Geofences won't be loaded until refresh() is called
  const handleRefresh = async () => {
    await refresh();
    console.log(`Loaded ${geofences.length} geofences`);
  };

  return <Button title="Load Geofences" onPress={handleRefresh} />;
}
```
