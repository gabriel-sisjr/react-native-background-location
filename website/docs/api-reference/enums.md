---
sidebar_position: 5
title: Enums
description: All enum definitions for @gabriel-sisjr/react-native-background-location — LocationAccuracy, LocationActivityType, NotificationPriority, LocationPermissionStatus, NotificationPermissionStatus, GeofenceTransitionType, and GeofenceErrorCode.
keywords:
  - react-native
  - background-location
  - enums
  - LocationAccuracy
  - LocationActivityType
  - NotificationPriority
  - LocationPermissionStatus
  - GeofenceTransitionType
  - GeofenceErrorCode
---

# Enums

All runtime enum values exported by the library. Each enum is exported both as a value (for runtime use) and as a type (for type annotations).

```ts
import {
  LocationAccuracy,
  LocationActivityType,
  NotificationPriority,
  LocationPermissionStatus,
  NotificationPermissionStatus,
  GeofenceTransitionType,
  GeofenceErrorCode,
} from '@gabriel-sisjr/react-native-background-location';
```

---

## `LocationAccuracy`

Location accuracy priority levels. Controls the trade-off between accuracy and battery consumption.

```ts
enum LocationAccuracy {
  HIGH_ACCURACY = 'HIGH_ACCURACY',
  BALANCED_POWER_ACCURACY = 'BALANCED_POWER_ACCURACY',
  LOW_POWER = 'LOW_POWER',
  NO_POWER = 'NO_POWER',
  PASSIVE = 'PASSIVE',
}
```

| Value | String | Description | Native Mapping |
|-------|--------|-------------|----------------|
| `HIGH_ACCURACY` | `'HIGH_ACCURACY'` | Highest accuracy using GPS and other sensors. Best for navigation and precise tracking. Highest battery consumption. | Android: `PRIORITY_HIGH_ACCURACY` / iOS: `kCLLocationAccuracyBest` |
| `BALANCED_POWER_ACCURACY` | `'BALANCED_POWER_ACCURACY'` | Balanced accuracy and power consumption. Good for most tracking use cases. | Android: `PRIORITY_BALANCED_POWER_ACCURACY` / iOS: `kCLLocationAccuracyHundredMeters` |
| `LOW_POWER` | `'LOW_POWER'` | Low power consumption using network-based location. Lower accuracy. | Android: `PRIORITY_LOW_POWER` / iOS: `kCLLocationAccuracyKilometer` |
| `NO_POWER` | `'NO_POWER'` | No additional power consumption. Only receives location updates when other apps request them. | Android: `PRIORITY_NO_POWER` / iOS: `kCLLocationAccuracyThreeKilometers` |
| `PASSIVE` | `'PASSIVE'` | Passive location updates from other apps. No additional power consumption. | Android: `PRIORITY_PASSIVE` / iOS: `kCLLocationAccuracyThreeKilometers` |

### Usage

```ts
import { startTracking, LocationAccuracy } from '@gabriel-sisjr/react-native-background-location';

await startTracking({
  accuracy: LocationAccuracy.HIGH_ACCURACY,
});

// For battery-conscious tracking
await startTracking({
  accuracy: LocationAccuracy.BALANCED_POWER_ACCURACY,
});
```

---

## `LocationActivityType`

iOS-only hint passed to `CLLocationManager.activityType`. Tells iOS the nature of the activity being tracked so it can make better power management decisions (when to keep GPS hot, when to pause updates if motion stops, dead-reckoning behavior, etc.). Ignored on Android.

```ts
enum LocationActivityType {
  OTHER = 'OTHER',
  AUTOMOTIVE_NAVIGATION = 'AUTOMOTIVE_NAVIGATION',
  FITNESS = 'FITNESS',
  OTHER_NAVIGATION = 'OTHER_NAVIGATION',
  AIRBORNE = 'AIRBORNE',
}
```

| Value | String | Description | Native Mapping |
|-------|--------|-------------|----------------|
| `OTHER` | `'OTHER'` | Default. General-purpose tracking, including stationary or mixed-motion scenarios. iOS will not aggressively pause updates for inactivity. | iOS: `CLActivityType.other` |
| `AUTOMOTIVE_NAVIGATION` | `'AUTOMOTIVE_NAVIGATION'` | Vehicle navigation. Optimized for driving but iOS may pause updates ~2–3 minutes after the device becomes stationary (e.g. parked car). | iOS: `CLActivityType.automotiveNavigation` |
| `FITNESS` | `'FITNESS'` | Fitness or pedestrian tracking (walking, running, cycling). | iOS: `CLActivityType.fitness` |
| `OTHER_NAVIGATION` | `'OTHER_NAVIGATION'` | Non-automotive navigation, such as boats or trains. | iOS: `CLActivityType.otherNavigation` |
| `AIRBORNE` | `'AIRBORNE'` | Airborne tracking. | iOS: `CLActivityType.airborne` |

**Platform:** iOS only. The value is parsed but ignored on Android.

> **Note:** Unknown strings fall back to `OTHER` and a warning is logged via the iOS guard logger.

### Usage

```ts
import { startTracking, LocationActivityType } from '@gabriel-sisjr/react-native-background-location';

// Default (stationary-friendly): no value or LocationActivityType.OTHER
await startTracking({
  accuracy: LocationAccuracy.HIGH_ACCURACY,
});

// Vehicle navigation: tell iOS this is a driving session
await startTracking({
  accuracy: LocationAccuracy.HIGH_ACCURACY,
  activityType: LocationActivityType.AUTOMOTIVE_NAVIGATION,
});
```

Source: `ios/LocationActivityType.swift:5-26`.

---

## `NotificationPriority`

Notification priority levels for Android foreground service notifications.

```ts
enum NotificationPriority {
  LOW = 'LOW',
  DEFAULT = 'DEFAULT',
  HIGH = 'HIGH',
  MAX = 'MAX',
}
```

| Value | String | Description |
|-------|--------|-------------|
| `LOW` | `'LOW'` | Low priority -- minimal notification |
| `DEFAULT` | `'DEFAULT'` | Default priority |
| `HIGH` | `'HIGH'` | High priority -- more prominent notification |
| `MAX` | `'MAX'` | Maximum priority -- urgent notification |

**Platform:** Android only. iOS does not use notification priority for foreground service-style notifications.

### Usage

```ts
import { startTracking, NotificationPriority } from '@gabriel-sisjr/react-native-background-location';

await startTracking({
  notificationOptions: {
    title: 'Tracking',
    text: 'Location is being recorded',
    priority: NotificationPriority.LOW,
  },
});
```

---

## `LocationPermissionStatus`

Location permission status values.

```ts
enum LocationPermissionStatus {
  GRANTED = 'granted',
  WHEN_IN_USE = 'whenInUse',
  DENIED = 'denied',
  BLOCKED = 'blocked',
  UNDETERMINED = 'undetermined',
}
```

| Value | String | Description |
|-------|--------|-------------|
| `GRANTED` | `'granted'` | Full location access granted (including background on Android, "Always" on iOS) |
| `WHEN_IN_USE` | `'whenInUse'` | Location access granted only while app is in foreground (iOS "When In Use") |
| `DENIED` | `'denied'` | Permission denied but can be requested again |
| `BLOCKED` | `'blocked'` | Permission permanently denied (user selected "Never Ask Again" on Android) |
| `UNDETERMINED` | `'undetermined'` | Permission has not been requested yet |

### Usage

```ts
import { useLocationPermissions, LocationPermissionStatus } from '@gabriel-sisjr/react-native-background-location';

function PermissionGate() {
  const { permissionStatus } = useLocationPermissions();

  switch (permissionStatus.location.status) {
    case LocationPermissionStatus.GRANTED:
      return <TrackingScreen />;
    case LocationPermissionStatus.WHEN_IN_USE:
      return <UpgradeToAlwaysPrompt />;
    case LocationPermissionStatus.BLOCKED:
      return <OpenSettingsPrompt />;
    default:
      return <RequestPermissionButton />;
  }
}
```

---

## `NotificationPermissionStatus`

Notification permission status values.

```ts
enum NotificationPermissionStatus {
  GRANTED = 'granted',
  DENIED = 'denied',
  UNDETERMINED = 'undetermined',
}
```

| Value | String | Description |
|-------|--------|-------------|
| `GRANTED` | `'granted'` | Notification permission granted |
| `DENIED` | `'denied'` | Notification permission denied |
| `UNDETERMINED` | `'undetermined'` | Permission has not been requested yet |

> **Note:** On Android versions below API 33, notification permission is auto-granted and the status will always be `GRANTED`.

### Usage

```ts
const { permissionStatus } = useLocationPermissions();

if (permissionStatus.notification.status === NotificationPermissionStatus.DENIED) {
  console.log('Geofence notifications will not be visible');
}
```

---

## `GeofenceTransitionType`

Types of geofence transitions that can be monitored.

```ts
enum GeofenceTransitionType {
  ENTER = 'ENTER',
  EXIT = 'EXIT',
  DWELL = 'DWELL',
}
```

| Value | String | Description |
|-------|--------|-------------|
| `ENTER` | `'ENTER'` | Device entered the geofence region |
| `EXIT` | `'EXIT'` | Device exited the geofence region |
| `DWELL` | `'DWELL'` | Device dwelled in the geofence region for the configured `loiteringDelay` duration |

### Usage

```ts
import { addGeofence, GeofenceTransitionType } from '@gabriel-sisjr/react-native-background-location';

await addGeofence({
  identifier: 'office',
  latitude: -23.5505,
  longitude: -46.6333,
  radius: 200,
  transitionTypes: [
    GeofenceTransitionType.ENTER,
    GeofenceTransitionType.EXIT,
    GeofenceTransitionType.DWELL,
  ],
  loiteringDelay: 60000, // 1 minute dwell threshold
});
```

---

## `GeofenceErrorCode`

Structured error codes for geofencing operation failures. Used as the `code` property on [`GeofenceError`](./errors.md) instances.

```ts
enum GeofenceErrorCode {
  INVALID_REGION = 'INVALID_REGION',
  DUPLICATE_IDENTIFIER = 'DUPLICATE_IDENTIFIER',
  LIMIT_EXCEEDED = 'LIMIT_EXCEEDED',
  MONITORING_FAILED = 'MONITORING_FAILED',
  NOT_AVAILABLE = 'NOT_AVAILABLE',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  PLAY_SERVICES_UNAVAILABLE = 'PLAY_SERVICES_UNAVAILABLE',
}
```

| Value | String | Description |
|-------|--------|-------------|
| `INVALID_REGION` | `'INVALID_REGION'` | Invalid region parameters (coordinates out of range, radius too small, or missing identifier) |
| `DUPLICATE_IDENTIFIER` | `'DUPLICATE_IDENTIFIER'` | A geofence with the same identifier is already registered |
| `LIMIT_EXCEEDED` | `'LIMIT_EXCEEDED'` | Platform geofence limit exceeded (Android: 100, iOS: 20) |
| `MONITORING_FAILED` | `'MONITORING_FAILED'` | Native monitoring failed to start |
| `NOT_AVAILABLE` | `'NOT_AVAILABLE'` | Native module is not available |
| `PERMISSION_DENIED` | `'PERMISSION_DENIED'` | Insufficient location permissions for geofencing |
| `PLAY_SERVICES_UNAVAILABLE` | `'PLAY_SERVICES_UNAVAILABLE'` | Google Play Services unavailable (Android only) |

### Usage

```ts
import { addGeofence, GeofenceError, GeofenceErrorCode } from '@gabriel-sisjr/react-native-background-location';

try {
  await addGeofence(region);
} catch (err) {
  if (err instanceof GeofenceError) {
    switch (err.code) {
      case GeofenceErrorCode.DUPLICATE_IDENTIFIER:
        console.warn('Geofence already exists');
        break;
      case GeofenceErrorCode.LIMIT_EXCEEDED:
        console.error('Too many geofences');
        break;
      case GeofenceErrorCode.PERMISSION_DENIED:
        console.error('Need location permissions');
        break;
      default:
        console.error('Geofence error:', err.message);
    }
  }
}
```
