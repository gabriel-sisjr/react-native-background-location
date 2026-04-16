---
sidebar_position: 6
title: Errors
description: Error classes and error handling patterns for @gabriel-sisjr/react-native-background-location — GeofenceError class and GeofenceErrorCode enum.
keywords:
  - react-native
  - background-location
  - errors
  - GeofenceError
  - GeofenceErrorCode
  - error-handling
---

# Errors

Error classes exported by the library for structured error handling.

```ts
import { GeofenceError, GeofenceErrorCode } from '@gabriel-sisjr/react-native-background-location';
```

---

## `GeofenceError`

A custom error class for geofencing-specific failures. Extends the built-in `Error` class and carries a structured `GeofenceErrorCode` so callers can branch on the failure reason without string-matching the message.

### Class Definition

```ts
class GeofenceError extends Error {
  code: GeofenceErrorCode;

  constructor(code: GeofenceErrorCode, message: string);
}
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` | Always `'GeofenceError'` |
| `code` | `GeofenceErrorCode` | Structured error code identifying the failure reason |
| `message` | `string` | Human-readable error description |
| `stack` | `string` | Standard stack trace (inherited from `Error`) |

### `GeofenceErrorCode`

See the full enum documentation in the [Enums reference](./enums.md#geofenceerrorcode).

| Code | Description |
|------|-------------|
| `INVALID_REGION` | Invalid region parameters (coordinates, radius, or identifier) |
| `DUPLICATE_IDENTIFIER` | Geofence identifier already registered |
| `LIMIT_EXCEEDED` | Platform geofence limit exceeded |
| `MONITORING_FAILED` | Native monitoring failed to start |
| `NOT_AVAILABLE` | Native module not available |
| `PERMISSION_DENIED` | Insufficient location permissions |
| `PLAY_SERVICES_UNAVAILABLE` | Google Play Services unavailable (Android only) |

---

## Error Handling Patterns

### Basic try/catch

```ts
import { addGeofence, GeofenceError, GeofenceErrorCode } from '@gabriel-sisjr/react-native-background-location';

try {
  await addGeofence({
    identifier: 'office',
    latitude: -23.5505,
    longitude: -46.6333,
    radius: 200,
  });
} catch (err) {
  if (err instanceof GeofenceError) {
    console.error(`Geofence error [${err.code}]: ${err.message}`);
  } else {
    console.error('Unexpected error:', err);
  }
}
```

### Branching on error code

```ts
try {
  await addGeofence(region);
} catch (err) {
  if (err instanceof GeofenceError) {
    switch (err.code) {
      case GeofenceErrorCode.DUPLICATE_IDENTIFIER:
        // Already registered -- safe to ignore or update
        console.warn(`Geofence "${region.identifier}" already exists`);
        break;

      case GeofenceErrorCode.LIMIT_EXCEEDED:
        // Platform limit reached -- prompt user to remove old geofences
        Alert.alert(
          'Geofence Limit Reached',
          'Remove some geofences before adding new ones.'
        );
        break;

      case GeofenceErrorCode.INVALID_REGION:
        // Bad parameters -- fix the input
        console.error('Invalid geofence parameters:', err.message);
        break;

      case GeofenceErrorCode.PERMISSION_DENIED:
        // Need to request permissions first
        await requestPermissions();
        break;

      case GeofenceErrorCode.PLAY_SERVICES_UNAVAILABLE:
        // Android-specific: Google Play Services issue
        Alert.alert(
          'Play Services Required',
          'Please update Google Play Services.'
        );
        break;

      case GeofenceErrorCode.NOT_AVAILABLE:
        // Native module not linked
        console.error('Geofencing module not available');
        break;

      case GeofenceErrorCode.MONITORING_FAILED:
        // Native layer could not start monitoring
        console.error('Failed to start geofence monitoring:', err.message);
        break;
    }
  }
}
```

### Using with hooks

The [`useGeofencing`](./hooks/useGeofencing.md) hook exposes an `error` state that captures `GeofenceError` instances automatically:

```tsx
import { useGeofencing, GeofenceError, GeofenceErrorCode } from '@gabriel-sisjr/react-native-background-location';

function GeofenceManager() {
  const { addGeofence, error, clearError } = useGeofencing();

  useEffect(() => {
    if (error && error instanceof GeofenceError) {
      if (error.code === GeofenceErrorCode.DUPLICATE_IDENTIFIER) {
        // Handle duplicate
      }
      clearError();
    }
  }, [error, clearError]);

  const handleAdd = async () => {
    try {
      await addGeofence({
        identifier: 'office',
        latitude: -23.5505,
        longitude: -46.6333,
        radius: 200,
      });
    } catch (err) {
      // Error is also captured in the hook's error state
      // You can handle it here or via the useEffect above
    }
  };

  return <Button onPress={handleAdd} title="Add Geofence" />;
}
```

### Instanceof check

`GeofenceError` correctly sets the prototype chain, so `instanceof` checks work reliably:

```ts
try {
  await addGeofence(region);
} catch (err) {
  if (err instanceof GeofenceError) {
    // err.code is typed as GeofenceErrorCode
    // err.message is a descriptive string
  } else if (err instanceof Error) {
    // Some other error
  }
}
```

---

## Tracking Function Error Behavior

Tracking functions (`startTracking`, `stopTracking`, `isTracking`, `getLocations`, `clearTrip`, `updateNotification`) do **not** throw when the native module is unavailable. Instead, they log a `console.warn` and return safe fallback values:

| Function | Fallback Return |
|----------|----------------|
| `startTracking` | `Promise<string>` with the provided tripId or `'simulator-trip-{timestamp}'` |
| `stopTracking` | `Promise<void>` (resolves immediately) |
| `isTracking` | `Promise<{ active: false }>` |
| `getLocations` | `Promise<[]>` (empty array) |
| `clearTrip` | `Promise<void>` (resolves immediately) |
| `updateNotification` | `Promise<void>` (resolves immediately) |

This graceful degradation allows development and testing in simulators without the native module linked.
