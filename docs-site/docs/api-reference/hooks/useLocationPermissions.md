---
sidebar_position: 4
title: useLocationPermissions
description: API reference for the useLocationPermissions hook — cross-platform location and notification permission management with granular status reporting.
keywords:
  - react-native
  - background-location
  - hook
  - useLocationPermissions
  - permissions
  - location-permission
  - notification-permission
  - android
  - ios
---

# useLocationPermissions

Cross-platform hook for managing location and notification permissions. Provides granular permission state separating location and notification permissions, with platform-specific handling for Android and iOS.

```ts
import { useLocationPermissions } from '@gabriel-sisjr/react-native-background-location';
```

**Platform:** Android and iOS

> **Note:** `useGeofencePermissions` is also exported as an alias for this hook, since geofencing uses the same location permissions.

---

## Signature

```ts
function useLocationPermissions(): UseLocationPermissionsResult
```

This hook takes no parameters.

---

## Return Value

Returns a `UseLocationPermissionsResult` object.

| Property | Type | Description |
|----------|------|-------------|
| `permissionStatus` | [`PermissionState`](../types.md#permissionstate) | Current combined permission state |
| `requestPermissions` | `() => Promise<boolean>` | Request all required permissions. Returns `true` if **location** permissions are granted. |
| `checkPermissions` | `() => Promise<boolean>` | Check current permissions without showing dialogs. Returns `true` if **location** permissions are granted. |
| `isRequesting` | `boolean` | Whether a permission request is currently in progress |

### `permissionStatus` Structure

```ts
{
  hasAllPermissions: boolean;     // true only when BOTH location AND notification are granted
  location: {
    hasPermission: boolean;       // true if GRANTED or WHEN_IN_USE
    status: LocationPermissionStatus;
    canRequestAgain: boolean;
  };
  notification: {
    hasPermission: boolean;       // true if GRANTED
    status: NotificationPermissionStatus;
    canRequestAgain: boolean;
  };
}
```

---

## Platform Behavior

### `requestPermissions()` on Android

The permission request follows a multi-step flow:

1. **Foreground location** -- Requests `ACCESS_FINE_LOCATION` and `ACCESS_COARSE_LOCATION` simultaneously
2. **Background location** (API 29+) -- If foreground is granted, requests `ACCESS_BACKGROUND_LOCATION` with a rationale dialog
3. **Notifications** (API 33+) -- Requests `POST_NOTIFICATIONS` via `PermissionsAndroid`. On older APIs, uses the native module (auto-granted).

If foreground location is denied, background location is not requested, but notification permission is still requested.

### `requestPermissions()` on iOS

1. **Location** -- Calls `requestLocationPermission(foregroundOnly: false)` on the native module, which handles the WhenInUse-to-Always escalation flow via `CLLocationManager.requestAlwaysAuthorization()`
2. **Notifications** -- Calls `requestNotificationPermission()` on the native module

> **Important:** iOS requires a two-step flow for "Always" location permission. The system first grants "When In Use", then the user must explicitly approve "Always" either through the prompt or in Settings. The hook handles this escalation automatically.

### `checkPermissions()` on Android

Checks each permission using `PermissionsAndroid.check()`:
- `ACCESS_FINE_LOCATION`
- `ACCESS_COARSE_LOCATION`
- `ACCESS_BACKGROUND_LOCATION` (API 29+)
- `POST_NOTIFICATIONS` (API 33+) or native module check (older APIs)

### `checkPermissions()` on iOS

Calls the native module's `checkLocationPermission()` and `checkNotificationPermission()` in parallel.

---

## Return Value Semantics

### `requestPermissions()` Return

Returns `true` if **location** permissions are granted, regardless of notification permission status. This design is intentional:

- Background tracking **requires** location permissions
- Notification permission denial **only** affects geofence visual notifications
- Notification denial is non-blocking

Check `permissionStatus.notification` separately for notification-specific state.

### `hasAllPermissions`

`true` only when **both** location and notification permissions are granted. Use this for a strict "everything granted" gate, or check individual states for more nuanced flows.

### `canRequestAgain`

- On Android: `false` when the user has selected "Never Ask Again" (reported as `BLOCKED` status)
- On iOS: `false` when the permission has been denied (user must go to Settings to change)

---

## Usage

### Basic permission gate

```tsx
import { useLocationPermissions } from '@gabriel-sisjr/react-native-background-location';

function App() {
  const { permissionStatus, requestPermissions, isRequesting } = useLocationPermissions();

  if (!permissionStatus.location.hasPermission) {
    return (
      <View>
        <Text>Location permission is required for tracking.</Text>
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

### Granular permission handling

```tsx
import {
  useLocationPermissions,
  LocationPermissionStatus,
} from '@gabriel-sisjr/react-native-background-location';

function PermissionScreen() {
  const { permissionStatus, requestPermissions, checkPermissions } = useLocationPermissions();
  const { location, notification } = permissionStatus;

  useEffect(() => {
    // Check on mount without prompting
    checkPermissions();
  }, [checkPermissions]);

  if (location.status === LocationPermissionStatus.BLOCKED) {
    return (
      <View>
        <Text>Location permission is permanently denied.</Text>
        <Text>Please enable it in your device Settings.</Text>
        <Button title="Open Settings" onPress={() => Linking.openSettings()} />
      </View>
    );
  }

  if (location.status === LocationPermissionStatus.WHEN_IN_USE) {
    return (
      <View>
        <Text>Background location is required for trip recording.</Text>
        <Text>Please upgrade to "Always Allow" in Settings.</Text>
        <Button title="Open Settings" onPress={() => Linking.openSettings()} />
      </View>
    );
  }

  if (!location.hasPermission) {
    return (
      <View>
        <Button title="Grant Location Permission" onPress={requestPermissions} />
      </View>
    );
  }

  if (!notification.hasPermission) {
    return (
      <View>
        <Text>Notifications are disabled. Geofence alerts will not be visible.</Text>
        <Button title="Continue Anyway" onPress={() => navigate('Tracking')} />
      </View>
    );
  }

  return <TrackingScreen />;
}
```

### Check before geofencing

```tsx
function GeofenceSetup() {
  const { permissionStatus, requestPermissions } = useLocationPermissions();

  const handleAddGeofence = async () => {
    if (!permissionStatus.location.hasPermission) {
      const granted = await requestPermissions();
      if (!granted) {
        Alert.alert('Permission Required', 'Location permission is needed for geofencing.');
        return;
      }
    }

    await addGeofence({
      identifier: 'office',
      latitude: -23.5505,
      longitude: -46.6333,
      radius: 200,
    });
  };

  return <Button title="Add Geofence" onPress={handleAddGeofence} />;
}
```

---

## Development Warnings

In `__DEV__` mode, the hook emits a one-time `console.warn` when notification permission is denied:

```
[BackgroundLocation] Notification permission was denied. Geofence visual notifications
will not appear. Background tracking is unaffected.
```

This warning fires once per app session and is suppressed in production builds.
