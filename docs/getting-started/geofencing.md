# Geofencing

## Introduction

Geofencing allows your application to define virtual geographic boundaries (circular regions) and receive notifications when the user's device enters, exits, or dwells within those regions. The geofencing module in `@gabriel-sisjr/react-native-background-location` provides a cross-platform API built on top of platform-native implementations:

- **Android:** Google Play Services `GeofencingClient`
- **iOS:** `CLLocationManager` region monitoring

Common use cases include:

- **Store proximity alerts** -- notify users when they approach a retail location
- **Fleet management zones** -- detect when vehicles enter or leave designated areas
- **Attendance tracking** -- automatically record arrival and departure times
- **Delivery area monitoring** -- confirm when a driver enters a delivery zone
- **Safety perimeters** -- alert when a device leaves a defined boundary

Geofencing operates entirely in the background. Once a geofence is registered, the system monitors it even when the app is not in the foreground, delivering transition events through the native event bridge.

## Prerequisites

Before using geofencing, ensure the following requirements are met:

- **Location permissions:** Background location access is recommended for reliable monitoring. Use `useLocationPermissions` (or the aliased `useGeofencePermissions`) to request permissions before registering geofences.
- **Android:** Google Play Services must be installed and available on the device. The `GeofencingClient` API requires it. Without Play Services, a `GeofenceError` with code `PLAY_SERVICES_UNAVAILABLE` is thrown.
- **iOS:** "Always" authorization is recommended for `CLLocationManager` region monitoring. "When In Use" authorization may work when the app is in the foreground, but background delivery requires Always authorization.
- **Minimum platform versions:** iOS 13+, Android SDK 24+ (API level 24).
- **Library installation:** `@gabriel-sisjr/react-native-background-location` must be installed and linked. See the [Quick Start Guide](QUICKSTART.md) for installation instructions.

## Quick Start

A minimal working example that registers a geofence and listens for transitions:

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

## API Reference

### `addGeofence(region)`

Registers a single geofence region for monitoring.

**Behavior:**

1. Validates all region parameters (coordinates, radius, loitering delay)
2. Checks for duplicate identifiers against currently active geofences
3. Serializes the region to JSON with default values applied
4. Sends to the native module for registration

**Parameters:**

| Name     | Type             | Description                                                                                 |
| -------- | ---------------- | ------------------------------------------------------------------------------------------- |
| `region` | `GeofenceRegion` | The geofence region to register. See [GeofenceRegion Reference](#geofenceregion-reference). |

**Returns:** `Promise<void>`

**Throws:**

| Error Code             | Condition                                                   |
| ---------------------- | ----------------------------------------------------------- |
| `DUPLICATE_IDENTIFIER` | A geofence with the same `identifier` is already registered |
| `INVALID_REGION`       | Coordinates or radius are out of valid range                |
| `LIMIT_EXCEEDED`       | Platform geofence limit reached                             |
| `PERMISSION_DENIED`    | Insufficient location permissions                           |

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
  loiteringDelay: 60000, // 60 seconds before DWELL fires
  metadata: { zone: 'loading-dock', priority: 'high' },
});
```

### `addGeofences(regions)`

Registers multiple geofence regions as an atomic batch operation. All regions succeed or all fail. No partial registration occurs.

**Behavior:**

1. Validates all regions in the batch
2. Checks for duplicate identifiers within the batch itself
3. Serializes the entire batch to a single JSON array
4. Sends to the native module for bulk registration

**Parameters:**

| Name      | Type               | Description                           |
| --------- | ------------------ | ------------------------------------- |
| `regions` | `GeofenceRegion[]` | Array of geofence regions to register |

**Returns:** `Promise<void>`

**Throws:**

| Error Code             | Condition                                                    |
| ---------------------- | ------------------------------------------------------------ |
| `DUPLICATE_IDENTIFIER` | Two or more regions in the batch share the same `identifier` |
| `INVALID_REGION`       | Any region in the batch has invalid parameters               |
| `LIMIT_EXCEEDED`       | Adding the batch would exceed the platform limit             |

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
  {
    identifier: 'zone-c',
    latitude: -23.5433,
    longitude: -46.6291,
    radius: 500,
    transitionTypes: [GeofenceTransitionType.DWELL],
    loiteringDelay: 120000,
  },
]);
```

### `removeGeofence(identifier)`

Removes a single geofence by its identifier. Stops native monitoring immediately.

**Parameters:**

| Name         | Type     | Description                                     |
| ------------ | -------- | ----------------------------------------------- |
| `identifier` | `string` | The unique identifier of the geofence to remove |

**Returns:** `Promise<void>`

```typescript
import { removeGeofence } from '@gabriel-sisjr/react-native-background-location';

await removeGeofence('warehouse-north');
```

### `removeGeofences(identifiers)`

Removes multiple geofences by their identifiers in a single native call.

**Parameters:**

| Name          | Type       | Description                             |
| ------------- | ---------- | --------------------------------------- |
| `identifiers` | `string[]` | Array of geofence identifiers to remove |

**Returns:** `Promise<void>`

```typescript
import { removeGeofences } from '@gabriel-sisjr/react-native-background-location';

await removeGeofences(['zone-a', 'zone-b', 'zone-c']);
```

### `removeAllGeofences()`

Removes all registered geofences. Useful for cleanup on logout or app reset.

**Returns:** `Promise<void>`

```typescript
import { removeAllGeofences } from '@gabriel-sisjr/react-native-background-location';

await removeAllGeofences();
```

### `getActiveGeofences()`

Returns all currently monitored geofences. The native module serializes the active geofences as JSON, which is deserialized to an array of `GeofenceRegion` objects.

**Returns:** `Promise<GeofenceRegion[]>`

```typescript
import { getActiveGeofences } from '@gabriel-sisjr/react-native-background-location';

const active = await getActiveGeofences();
console.log(`Monitoring ${active.length} geofences`);
active.forEach((g) => {
  console.log(
    `  ${g.identifier}: (${g.latitude}, ${g.longitude}) r=${g.radius}m`
  );
});
```

### `getMaxGeofences()`

Returns the maximum number of geofences the current platform supports. This is a hard limit imposed by the operating system.

**Returns:** `Promise<number>`

| Platform | Limit |
| -------- | ----- |
| Android  | 100   |
| iOS      | 20    |

```typescript
import { getMaxGeofences } from '@gabriel-sisjr/react-native-background-location';

const limit = await getMaxGeofences();
console.log(`Platform supports up to ${limit} geofences`);
```

### `getGeofenceTransitions(identifier?)`

Retrieves stored geofence transition events from the native database. Transitions are persisted across app restarts.

**Parameters:**

| Name         | Type     | Required | Description                                                                                   |
| ------------ | -------- | -------- | --------------------------------------------------------------------------------------------- |
| `identifier` | `string` | No       | If provided, only returns transitions for this geofence. If omitted, returns all transitions. |

**Returns:** `Promise<GeofenceTransitionEvent[]>`

```typescript
import { getGeofenceTransitions } from '@gabriel-sisjr/react-native-background-location';

// Get all transitions
const allTransitions = await getGeofenceTransitions();

// Get transitions for a specific geofence
const officeTransitions = await getGeofenceTransitions('office');
officeTransitions.forEach((t) => {
  console.log(
    `${t.transitionType} at ${t.timestamp} (${t.distanceFromCenter}m from center)`
  );
});
```

### `clearGeofenceTransitions(identifier?)`

Clears stored geofence transition events from the native database.

**Parameters:**

| Name         | Type     | Required | Description                                                                                 |
| ------------ | -------- | -------- | ------------------------------------------------------------------------------------------- |
| `identifier` | `string` | No       | If provided, only clears transitions for this geofence. If omitted, clears all transitions. |

**Returns:** `Promise<void>`

```typescript
import { clearGeofenceTransitions } from '@gabriel-sisjr/react-native-background-location';

// Clear transitions for a specific geofence
await clearGeofenceTransitions('office');

// Clear all transitions
await clearGeofenceTransitions();
```

## Hooks

### useGeofencing

A complete CRUD hook for managing geofence regions. Handles state management, loading indicators, error tracking, and automatic refresh after mutations.

#### Options

```typescript
interface UseGeofencingOptions {
  /** Whether to automatically load geofences on mount (default: true) */
  autoLoad?: boolean;
}
```

| Option     | Type      | Default | Description                                                      |
| ---------- | --------- | ------- | ---------------------------------------------------------------- |
| `autoLoad` | `boolean` | `true`  | Automatically fetch active geofences and platform limit on mount |

#### Return Values

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

| Value                | Type                             | Description                                                               |
| -------------------- | -------------------------------- | ------------------------------------------------------------------------- |
| `geofences`          | `GeofenceRegion[]`               | Currently active geofence regions                                         |
| `isLoading`          | `boolean`                        | Whether an async operation is in progress                                 |
| `error`              | `Error \| null`                  | Last error that occurred, or `null`                                       |
| `addGeofence`        | `(region) => Promise<void>`      | Register a single geofence. Auto-refreshes on success. Throws on failure. |
| `addGeofences`       | `(regions) => Promise<void>`     | Register multiple geofences atomically. Auto-refreshes on success.        |
| `removeGeofence`     | `(identifier) => Promise<void>`  | Remove a geofence by identifier. Auto-refreshes on success.               |
| `removeGeofences`    | `(identifiers) => Promise<void>` | Remove multiple geofences. Auto-refreshes on success.                     |
| `removeAllGeofences` | `() => Promise<void>`            | Remove all geofences. Auto-refreshes on success.                          |
| `maxGeofences`       | `number \| null`                 | Platform geofence limit, or `null` if not yet loaded                      |
| `refresh`            | `() => Promise<void>`            | Manually reload active geofences and platform limit from native           |
| `clearError`         | `() => void`                     | Clear the current error state                                             |

#### Example: Full CRUD

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
      Alert.alert('Failed to add geofence', (err as Error).message);
    }
  };

  return (
    <View>
      <Text>
        Active Geofences: {geofences.length} / {maxGeofences ?? '...'}
      </Text>

      {error && (
        <View>
          <Text>Error: {error.message}</Text>
          <Button title="Dismiss" onPress={clearError} />
        </View>
      )}

      <Button title="Add Geofence" onPress={handleAdd} disabled={isLoading} />
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

#### Example: Lazy Loading

```typescript
// Disable autoLoad and fetch geofences manually
const { geofences, refresh } = useGeofencing({ autoLoad: false });

// Load geofences when user navigates to the screen
useEffect(() => {
  refresh();
}, [refresh]);
```

### useGeofenceEvents

A listener hook that subscribes to real-time geofence transition events via `NativeEventEmitter`. It does not manage geofence state -- use it alongside `useGeofencing` for a complete solution.

#### Options

```typescript
interface UseGeofenceEventsOptions {
  /** Callback invoked when a geofence transition is detected (after filters) */
  onTransition?: (event: GeofenceTransitionEvent) => void;
  /** Only emit events matching these transition types */
  filter?: GeofenceTransitionType[];
  /** Only emit events for this specific geofence identifier */
  geofenceId?: string;
}
```

| Option         | Type                       | Default     | Description                                                                                             |
| -------------- | -------------------------- | ----------- | ------------------------------------------------------------------------------------------------------- |
| `onTransition` | `(event) => void`          | `undefined` | Callback invoked on each matching transition event                                                      |
| `filter`       | `GeofenceTransitionType[]` | `undefined` | If set, only transitions of these types trigger the callback. If omitted, all types are emitted.        |
| `geofenceId`   | `string`                   | `undefined` | If set, only transitions for this geofence trigger the callback. If omitted, all geofences are emitted. |

#### Return Value

`useGeofenceEvents` returns `void`. It is a side-effect-only hook.

#### Example: Listen to All Transitions

```typescript
import { useGeofenceEvents } from '@gabriel-sisjr/react-native-background-location';

function GeofenceLogger() {
  useGeofenceEvents({
    onTransition: (event) => {
      console.log(
        `[${event.timestamp}] ${event.transitionType} geofence "${event.geofenceId}" ` +
        `at (${event.latitude}, ${event.longitude}), ${event.distanceFromCenter}m from center`
      );
    },
  });

  return <Text>Listening for geofence events...</Text>;
}
```

#### Example: Filter by Transition Type

```typescript
import {
  useGeofenceEvents,
  GeofenceTransitionType,
} from '@gabriel-sisjr/react-native-background-location';

function EntryAlerts() {
  useGeofenceEvents({
    onTransition: (event) => {
      Alert.alert('Entered Zone', `You entered ${event.geofenceId}`);
    },
    filter: [GeofenceTransitionType.ENTER],
  });

  return <Text>Waiting for entry events...</Text>;
}
```

#### Example: Filter by Geofence ID

```typescript
import { useGeofenceEvents } from '@gabriel-sisjr/react-native-background-location';

function OfficeMonitor() {
  useGeofenceEvents({
    onTransition: (event) => {
      if (event.transitionType === 'ENTER') {
        markAttendance(event.timestamp);
      }
    },
    geofenceId: 'office-hq',
  });

  return <Text>Monitoring office geofence...</Text>;
}
```

#### Example: Combined Filters

```typescript
import {
  useGeofenceEvents,
  GeofenceTransitionType,
} from '@gabriel-sisjr/react-native-background-location';

// Only DWELL events for the warehouse geofence
useGeofenceEvents({
  onTransition: (event) => {
    console.log(`Driver dwelling at warehouse for delivery confirmation`);
    confirmDelivery(event);
  },
  filter: [GeofenceTransitionType.DWELL],
  geofenceId: 'warehouse-main',
});
```

## GeofenceRegion Reference

The `GeofenceRegion` interface defines a circular geofence region.

| Property             | Type                       | Required | Default         | Constraints                                   | Description                                                                                                             |
| -------------------- | -------------------------- | -------- | --------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `identifier`         | `string`                   | Yes      | --              | Non-empty, unique across all active geofences | Unique identifier for this geofence. Consumer-provided.                                                                 |
| `latitude`           | `number`                   | Yes      | --              | -90 to 90                                     | Center latitude of the geofence circle                                                                                  |
| `longitude`          | `number`                   | Yes      | --              | -180 to 180                                   | Center longitude of the geofence circle                                                                                 |
| `radius`             | `number`                   | Yes      | --              | Minimum 100 meters                            | Radius of the geofence circle in meters                                                                                 |
| `transitionTypes`    | `GeofenceTransitionType[]` | No       | `[ENTER, EXIT]` | Array of `ENTER`, `EXIT`, `DWELL`             | Which transitions to monitor                                                                                            |
| `loiteringDelay`     | `number`                   | No       | `30000`         | Non-negative (milliseconds)                   | How long the device must remain inside the geofence before a DWELL event fires                                          |
| `expirationDuration` | `number`                   | No       | Indefinite      | Positive (milliseconds)                       | If set, the geofence automatically expires after this duration. If omitted, it remains active until explicitly removed. |
| `metadata`           | `Record<string, unknown>`  | No       | `undefined`     | Must be JSON-serializable                     | Arbitrary data attached to the geofence. Returned in transition events.                                                 |

## GeofenceTransitionEvent Reference

The `GeofenceTransitionEvent` interface represents a detected geofence transition.

| Property             | Type                      | Description                                                                    |
| -------------------- | ------------------------- | ------------------------------------------------------------------------------ |
| `geofenceId`         | `string`                  | Identifier of the geofence that triggered the event                            |
| `transitionType`     | `GeofenceTransitionType`  | Type of transition: `ENTER`, `EXIT`, or `DWELL`                                |
| `latitude`           | `number`                  | Device latitude at the moment of transition                                    |
| `longitude`          | `number`                  | Device longitude at the moment of transition                                   |
| `timestamp`          | `string`                  | ISO 8601 timestamp of the transition                                           |
| `distanceFromCenter` | `number`                  | Distance in meters from the center of the geofence at the moment of transition |
| `metadata`           | `Record<string, unknown>` | Metadata associated with the geofence (if any was set during registration)     |

## Error Handling

All geofencing functions throw `GeofenceError` when an operation fails. `GeofenceError` extends `Error` and adds a `code` property of type `GeofenceErrorCode`.

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
        console.warn('Geofence already exists, skipping');
        break;
      case GeofenceErrorCode.LIMIT_EXCEEDED:
        console.error('Too many geofences, remove some first');
        break;
      case GeofenceErrorCode.PERMISSION_DENIED:
        console.error('Location permission required');
        break;
      default:
        console.error(`Geofence error [${error.code}]: ${error.message}`);
    }
  }
}
```

### Error Codes

| Code                        | Description                                       | Common Cause                                                                                                      |
| --------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `INVALID_REGION`            | Region parameters are invalid                     | Latitude/longitude out of range, radius below 100m, negative loitering delay                                      |
| `DUPLICATE_IDENTIFIER`      | Identifier already in use                         | Attempting to add a geofence with the same identifier as an existing one, or duplicate identifiers within a batch |
| `LIMIT_EXCEEDED`            | Platform geofence limit reached                   | Android: more than 100 geofences. iOS: more than 20 geofences.                                                    |
| `MONITORING_FAILED`         | Native monitoring could not start                 | Device location services disabled, hardware failure, OS-level restriction                                         |
| `NOT_AVAILABLE`             | Native module not available                       | Module not linked, running in a simulator without native setup                                                    |
| `PERMISSION_DENIED`         | Insufficient location permissions                 | Background location permission not granted                                                                        |
| `PLAY_SERVICES_UNAVAILABLE` | Google Play Services not available (Android only) | Device does not have Play Services, or Play Services is outdated                                                  |

## Platform Limitations

| Feature              | Android                                                                  | iOS                                                          |
| -------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------ |
| Maximum geofences    | 100                                                                      | 20                                                           |
| Minimum radius       | 100m                                                                     | 100m                                                         |
| DWELL detection      | Native (`GeofencingClient` loitering)                                    | Custom timer (software-based)                                |
| Geofence persistence | Survives app restart (re-registered on boot via `BootCompletedReceiver`) | Managed by `CLLocationManager` (persists across restarts)    |
| Background delivery  | `BroadcastReceiver` delivers events even when app is killed              | `CLLocationManager` delegate delivers events on app relaunch |
| Requirements         | Google Play Services                                                     | "Always" authorization recommended                           |
| Expiration support   | Native `setExpirationDuration`                                           | Software-based expiration check                              |
| Event storage        | Room Database (`GeofenceTransitionEntity`)                               | Core Data                                                    |

> **Important:** On iOS, the system shares the 20-region limit across all region monitoring, including geofences and iBeacon regions. If your app or other apps are using region monitoring, the effective limit may be lower.

> **Important:** On Android, geofences are cleared when Google Play Services data is cleared or the device is factory reset. The library re-registers geofences on device boot via `BootCompletedReceiver`, but this only works if the app has not been force-stopped.

## Troubleshooting

### Geofence transitions are not firing

1. **Check permissions.** Background location access is required. On iOS, ensure "Always" authorization is granted. On Android, ensure `ACCESS_BACKGROUND_LOCATION` is granted.
2. **Check Google Play Services (Android).** Verify Play Services is installed and up to date. Call `getMaxGeofences()` -- if it throws `PLAY_SERVICES_UNAVAILABLE`, Play Services is the issue.
3. **Verify radius.** The minimum radius is 100 meters. Smaller radii are rejected during validation. In practice, radii under 150-200m may produce unreliable transitions on both platforms.
4. **Test with movement.** Geofence transitions require actual device movement. Simulators and emulators may not trigger transitions reliably. Use mock location tools or test on a physical device.
5. **Check for battery optimization.** On Android, aggressive battery optimization (Doze mode, manufacturer-specific restrictions) can delay or prevent geofence transitions. See the [Battery Optimization Guide](../production/BATTERY_OPTIMIZATION.md).

### DWELL events are not firing

1. **Verify `transitionTypes` includes `DWELL`.** By default, only `ENTER` and `EXIT` are monitored.
2. **Check `loiteringDelay`.** The device must remain inside the geofence for the full loitering delay before a DWELL event fires. The default is 30 seconds.
3. **Stay within the geofence.** If the device exits and re-enters during the loitering period, the timer resets.
4. **iOS behavior.** DWELL detection on iOS uses a custom software timer, not native OS support. It starts when an ENTER event is detected and fires after `loiteringDelay` milliseconds if the device is still inside the region.

### `LIMIT_EXCEEDED` error

- Android supports up to 100 geofences. iOS supports up to 20.
- Call `getMaxGeofences()` to check the platform limit at runtime.
- Call `getActiveGeofences()` to see how many are currently registered.
- Remove unused geofences before adding new ones, or implement a rotation strategy for apps that need to monitor more locations than the platform limit allows.

### Events received after `removeGeofence`

- There may be a brief delay between calling `removeGeofence` and the native module actually stopping monitoring. Events that were already in transit when the removal was requested may still be delivered.
- This is normal behavior on both platforms.

### Geofences lost after device reboot (Android)

- The library registers a `BootCompletedReceiver` that re-registers all persisted geofences when the device boots.
- If the app was force-stopped by the user, `BootCompletedReceiver` will not fire. This is an Android OS restriction.
- Ensure the app has not been excluded from auto-start on manufacturer-modified Android distributions (Xiaomi, Huawei, etc.).

## See Also

- [React Hooks Guide](hooks.md) -- Documentation for all hooks including `useGeofencing` and `useGeofenceEvents`
- [Quick Start Guide](QUICKSTART.md) -- Library installation and basic setup
- [Platform Comparison](../production/PLATFORM_COMPARISON.md) -- Android vs iOS behavior differences
- [Battery Optimization](../production/BATTERY_OPTIMIZATION.md) -- Handling battery restrictions
- [API Reference](../../README.md#api-reference) -- Full API reference in the main README
