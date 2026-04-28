---
sidebar_position: 4
title: Types & Interfaces
description: Complete TypeScript type and interface reference for @gabriel-sisjr/react-native-background-location — tracking, geofencing, notifications, permissions, and hook types.
keywords:
  - react-native
  - background-location
  - typescript
  - types
  - interfaces
  - Coords
  - TrackingOptions
  - GeofenceRegion
  - NotificationOptions
  - PermissionState
---

# Types & Interfaces

All TypeScript types and interfaces exported by the library, grouped by category.

```ts
import type {
  Coords,
  TrackingStatus,
  TrackingOptions,
  LocationUpdateEvent,
  LocationWarningEvent,
  LocationWarningType,
  NotificationAction,
  NotificationActionEvent,
  NotificationOptions,
  GeofenceRegion,
  GeofenceTransitionEvent,
  LocationPermissionState,
  NotificationPermissionState,
  PermissionState,
  PermissionRationale,
  RequestPermissionsOptions,
  UseLocationPermissionsResult,
  UseBackgroundLocationResult,
  UseLocationTrackingOptions,
  UseLocationTrackingResult,
  UseLocationUpdatesOptions,
  UseLocationUpdatesResult,
  UseGeofencingOptions,
  UseGeofencingReturn,
  UseGeofenceEventsOptions,
} from '@gabriel-sisjr/react-native-background-location';
```

---

## Tracking Types

### `Coords`

Location coordinates with extended location data. Returned by `getLocations()` and provided in location update events.

```ts
interface Coords {
  /** Latitude in decimal degrees */
  latitude: string;
  /** Longitude in decimal degrees */
  longitude: string;
  /** Timestamp in milliseconds since Unix epoch */
  timestamp: number;
  /** Horizontal accuracy in meters */
  accuracy?: number;
  /** Altitude in meters above sea level */
  altitude?: number;
  /** Speed in meters per second */
  speed?: number;
  /** Bearing in degrees (0-360) */
  bearing?: number;
  /** Vertical accuracy in meters (Android API 26+) */
  verticalAccuracyMeters?: number;
  /** Speed accuracy in meters per second (Android API 26+) */
  speedAccuracyMetersPerSecond?: number;
  /** Bearing accuracy in degrees (Android API 26+) */
  bearingAccuracyDegrees?: number;
  /** Elapsed realtime in nanoseconds since system boot */
  elapsedRealtimeNanos?: number;
  /** Location provider (gps, network, passive, etc.) */
  provider?: string;
  /** Whether the location is from a mock provider (Android API 18+) */
  isFromMockProvider?: boolean;
}
```

| Property                       | Type      | Required | Platform    | Description                        |
| ------------------------------ | --------- | -------- | ----------- | ---------------------------------- |
| `latitude`                     | `string`  | Yes      | Both        | Latitude in decimal degrees        |
| `longitude`                    | `string`  | Yes      | Both        | Longitude in decimal degrees       |
| `timestamp`                    | `number`  | Yes      | Both        | Milliseconds since Unix epoch      |
| `accuracy`                     | `number`  | No       | Both        | Horizontal accuracy in meters      |
| `altitude`                     | `number`  | No       | Both        | Altitude in meters above sea level |
| `speed`                        | `number`  | No       | Both        | Speed in meters per second         |
| `bearing`                      | `number`  | No       | Both        | Bearing in degrees (0-360)         |
| `verticalAccuracyMeters`       | `number`  | No       | Android 26+ | Vertical accuracy in meters        |
| `speedAccuracyMetersPerSecond` | `number`  | No       | Android 26+ | Speed accuracy in m/s              |
| `bearingAccuracyDegrees`       | `number`  | No       | Android 26+ | Bearing accuracy in degrees        |
| `elapsedRealtimeNanos`         | `number`  | No       | Both        | Nanoseconds since system boot      |
| `provider`                     | `string`  | No       | Both        | Location provider name             |
| `isFromMockProvider`           | `boolean` | No       | Android 18+ | Whether from a mock provider       |

---

### `TrackingStatus`

Describes the current tracking state. Returned by `isTracking()`.

```ts
interface TrackingStatus {
  active: boolean;
  tripId?: string;
}
```

| Property | Type      | Required | Description                                               |
| -------- | --------- | -------- | --------------------------------------------------------- |
| `active` | `boolean` | Yes      | Whether tracking is currently running                     |
| `tripId` | `string`  | No       | Current trip identifier (present when `active` is `true`) |

---

### `LocationUpdateEvent`

Location update event with extended location data. Emitted by the native event emitter.

```ts
interface LocationUpdateEvent {
  tripId: string;
  latitude: string;
  longitude: string;
  timestamp: number;
  accuracy?: number;
  altitude?: number;
  speed?: number;
  bearing?: number;
  verticalAccuracyMeters?: number;
  speedAccuracyMetersPerSecond?: number;
  bearingAccuracyDegrees?: number;
  elapsedRealtimeNanos?: number;
  provider?: string;
  isFromMockProvider?: boolean;
}
```

Same fields as [`Coords`](#coords) plus a required `tripId` field.

| Property | Type     | Required | Description                              |
| -------- | -------- | -------- | ---------------------------------------- |
| `tripId` | `string` | Yes      | Trip identifier for this location update |

All other fields match the [`Coords`](#coords) interface.

---

### `LocationWarningType`

Union type for warning categories emitted by the location service.

```ts
type LocationWarningType =
  | 'SERVICE_TIMEOUT'
  | 'TASK_REMOVED'
  | 'LOCATION_UNAVAILABLE';
```

| Value                    | Description                                                           |
| ------------------------ | --------------------------------------------------------------------- |
| `'SERVICE_TIMEOUT'`      | Android 15+ foreground service timeout reached; service is restarting |
| `'TASK_REMOVED'`         | App was swiped from recents; tracking continues in background         |
| `'LOCATION_UNAVAILABLE'` | GPS signal lost or location services disabled                         |

---

### `LocationWarningEvent`

Warning event emitted by the location service for non-critical issues that do not stop tracking.

```ts
interface LocationWarningEvent {
  /** Trip identifier for this warning */
  tripId: string;
  /** Type of warning */
  type: LocationWarningType;
  /** Human-readable description of the warning */
  message: string;
  /** Timestamp when the warning was emitted */
  timestamp: number;
}
```

| Property    | Type                  | Required | Description                      |
| ----------- | --------------------- | -------- | -------------------------------- |
| `tripId`    | `string`              | Yes      | Trip identifier for this warning |
| `type`      | `LocationWarningType` | Yes      | Warning category                 |
| `message`   | `string`              | Yes      | Human-readable description       |
| `timestamp` | `number`              | Yes      | Timestamp when emitted           |

---

### `NotificationAction`

Configuration for a notification action button. Up to 3 actions can be added to the foreground service notification.

```ts
interface NotificationAction {
  /** Unique identifier for this action */
  id: string;
  /** Label displayed on the action button */
  label: string;
}
```

| Property | Type     | Required | Description                                                 |
| -------- | -------- | -------- | ----------------------------------------------------------- |
| `id`     | `string` | Yes      | Unique identifier used to identify which action was pressed |
| `label`  | `string` | Yes      | Label displayed on the action button                        |

---

### `NotificationActionEvent`

Event emitted when a notification action button is pressed.

```ts
interface NotificationActionEvent {
  /** Trip identifier for the active tracking session */
  tripId: string;
  /** ID of the action that was pressed */
  actionId: string;
}
```

| Property   | Type     | Required | Description                                                         |
| ---------- | -------- | -------- | ------------------------------------------------------------------- |
| `tripId`   | `string` | Yes      | Trip identifier for the active tracking session                     |
| `actionId` | `string` | Yes      | ID of the action that was pressed (matches `NotificationAction.id`) |

---

### `TrackingOptions`

Configuration options for location tracking. Passed to `startTracking()`.

```ts
interface TrackingOptions {
  updateInterval?: number;
  fastestInterval?: number;
  maxWaitTime?: number;
  accuracy?: LocationAccuracy;
  waitForAccurateLocation?: boolean;
  distanceFilter?: number;
  notificationOptions?: NotificationOptions;
  foregroundOnly?: boolean;
  onUpdateInterval?: number;
}
```

| Property                  | Type                  | Default         | Platform | Description                                                                                                                    |
| ------------------------- | --------------------- | --------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `updateInterval`          | `number`              | `5000`          | Both     | Interval between location updates in milliseconds                                                                              |
| `fastestInterval`         | `number`              | `3000`          | Both     | Fastest interval between updates in milliseconds. The system never updates faster than this.                                   |
| `maxWaitTime`             | `number`              | `10000`         | Both     | Maximum wait time in milliseconds before delivering batched updates                                                            |
| `accuracy`                | `LocationAccuracy`    | `HIGH_ACCURACY` | Both     | Location accuracy priority level                                                                                               |
| `waitForAccurateLocation` | `boolean`             | `false`         | Both     | Whether to delay updates until accurate location is available                                                                  |
| `distanceFilter`          | `number`              | `0`             | Android  | Minimum distance in meters between updates. `0` = no filter.                                                                   |
| `notificationOptions`     | `NotificationOptions` | —               | Both     | Foreground service notification configuration                                                                                  |
| `foregroundOnly`          | `boolean`             | `false`         | Android  | Foreground-only mode. Does not require background location permission.                                                         |
| `onUpdateInterval`        | `number`              | `undefined`     | Both     | Throttle interval for the `onLocationUpdate` callback in milliseconds. Locations are still collected at `updateInterval` rate. |

---

## Notification Types

### `NotificationOptions`

Unified notification configuration interface used across the library for foreground service notifications and geofence transition notifications.

For geofencing, the `title` and `text` fields support template variables. See [`GEOFENCE_TEMPLATE_VARS`](#geofence_template_vars).

```ts
interface NotificationOptions {
  enabled?: boolean;
  title?: string;
  text?: string;
  channelName?: string;
  channelId?: string;
  priority?: NotificationPriority;
  smallIcon?: string;
  largeIcon?: string;
  color?: string;
  showTimestamp?: boolean;
  subtext?: string;
  actions?: NotificationAction[];
  transitionOverrides?: Partial<
    Record<
      'ENTER' | 'EXIT' | 'DWELL',
      Omit<NotificationOptions, 'transitionOverrides' | 'enabled'>
    >
  >;
}
```

| Property              | Type                   | Default | Platform | Description                                                                            |
| --------------------- | ---------------------- | ------- | -------- | -------------------------------------------------------------------------------------- |
| `enabled`             | `boolean`              | `true`  | Both     | Whether notifications are shown                                                        |
| `title`               | `string`               | —       | Both     | Notification title. Supports template variables for geofencing.                        |
| `text`                | `string`               | —       | Both     | Notification body text. Supports template variables for geofencing.                    |
| `channelName`         | `string`               | —       | Android  | Android notification channel name                                                      |
| `channelId`           | `string`               | —       | Android  | Android notification channel ID                                                        |
| `priority`            | `NotificationPriority` | —       | Android  | Notification priority                                                                  |
| `smallIcon`           | `string`               | —       | Android  | Android drawable resource name for the small icon                                      |
| `largeIcon`           | `string`               | —       | Android  | Android drawable resource name for the large icon                                      |
| `color`               | `string`               | —       | Android  | Hex color string for notification accent color                                         |
| `showTimestamp`       | `boolean`              | —       | Android  | Whether to show timestamp on the notification                                          |
| `subtext`             | `string`               | —       | Android  | Subtext displayed below the notification content                                       |
| `actions`             | `NotificationAction[]` | —       | Android  | Action buttons (max 3). Currently supported for foreground service notifications only. |
| `transitionOverrides` | `Partial<Record<...>>` | —       | Both     | Per-transition notification overrides (ENTER, EXIT, DWELL)                             |

> **Note:** `transitionOverrides` allows customizing notification content per transition type. Unspecified fields fall through to the parent config. The `enabled` and `transitionOverrides` fields are excluded from per-transition overrides to prevent recursion.

---

### `GEOFENCE_TEMPLATE_VARS`

Constant object providing available template variables for geofence notification `title` and `text` fields. Variables are resolved at notification time on the native side.

```ts
const GEOFENCE_TEMPLATE_VARS = {
  IDENTIFIER: '{{identifier}}',
  TRANSITION_TYPE: '{{transitionType}}',
  LATITUDE: '{{latitude}}',
  LONGITUDE: '{{longitude}}',
  RADIUS: '{{radius}}',
  TIMESTAMP: '{{timestamp}}',
} as const;
```

| Key               | Template             | Resolved to                        |
| ----------------- | -------------------- | ---------------------------------- |
| `IDENTIFIER`      | `{{identifier}}`     | The geofence's `identifier` string |
| `TRANSITION_TYPE` | `{{transitionType}}` | `ENTER`, `EXIT`, or `DWELL`        |
| `LATITUDE`        | `{{latitude}}`       | Device latitude at transition      |
| `LONGITUDE`       | `{{longitude}}`      | Device longitude at transition     |
| `RADIUS`          | `{{radius}}`         | Geofence radius in meters          |
| `TIMESTAMP`       | `{{timestamp}}`      | Transition timestamp               |

#### Usage

```ts
import { GEOFENCE_TEMPLATE_VARS } from '@gabriel-sisjr/react-native-background-location';

const options = {
  title: 'Geofence Alert',
  text: `You entered ${GEOFENCE_TEMPLATE_VARS.IDENTIFIER} at ${GEOFENCE_TEMPLATE_VARS.TIMESTAMP}`,
};
```

---

## Permission Types

### `LocationPermissionState`

Granular status information for location permissions.

```ts
interface LocationPermissionState {
  hasPermission: boolean;
  status: LocationPermissionStatus;
  canRequestAgain: boolean;
}
```

| Property          | Type                       | Description                                      |
| ----------------- | -------------------------- | ------------------------------------------------ |
| `hasPermission`   | `boolean`                  | `true` if status is `GRANTED` or `WHEN_IN_USE`   |
| `status`          | `LocationPermissionStatus` | Current permission status enum value             |
| `canRequestAgain` | `boolean`                  | Whether the permission dialog can be shown again |

---

### `NotificationPermissionState`

Granular status information for notification permissions.

```ts
interface NotificationPermissionState {
  hasPermission: boolean;
  status: NotificationPermissionStatus;
  canRequestAgain: boolean;
}
```

| Property          | Type                           | Description                                      |
| ----------------- | ------------------------------ | ------------------------------------------------ |
| `hasPermission`   | `boolean`                      | `true` if status is `GRANTED`                    |
| `status`          | `NotificationPermissionStatus` | Current permission status enum value             |
| `canRequestAgain` | `boolean`                      | Whether the permission dialog can be shown again |

---

### `PermissionState`

Combined permission state for both location and notification permissions.

```ts
interface PermissionState {
  hasAllPermissions: boolean;
  location: LocationPermissionState;
  notification: NotificationPermissionState;
}
```

| Property            | Type                          | Description                                                 |
| ------------------- | ----------------------------- | ----------------------------------------------------------- |
| `hasAllPermissions` | `boolean`                     | `true` only when both location and notification are granted |
| `location`          | `LocationPermissionState`     | Location permission details                                 |
| `notification`      | `NotificationPermissionState` | Notification permission details                             |

---

### `PermissionRationale`

Localized strings shown in an Android system permission dialog (`PermissionsAndroid.request`). Reusable for any of the dialogs the library may surface (background-location today; foreground-location and notification reserved for future releases).

Currently only consumed by [`RequestPermissionsOptions.backgroundRationale`](#requestpermissionsoptions) on Android API 29+. The shape intentionally carries no platform prefix in its name so future sibling fields can share it.

All fields are optional. Any field that is omitted, `undefined`, `null`, an empty string, or whitespace-only falls back to the library's built-in English default for that field. Each field is resolved independently -- passing `{ title: 'Permissão' }` only overrides the title and leaves the message and three button labels at their defaults.

```ts
interface PermissionRationale {
  title?: string;
  message?: string;
  buttonPositive?: string;
  buttonNegative?: string;
  buttonNeutral?: string;
}
```

| Property         | Type     | Required | Default                                                                         | Description                                                 |
| ---------------- | -------- | -------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `title`          | `string` | No       | `Background Location Permission`                                                | Dialog title.                                               |
| `message`        | `string` | No       | `This app needs access to your location in the background to track your trips.` | Dialog body explaining why background location is required. |
| `buttonPositive` | `string` | No       | `OK`                                                                            | Positive (accept) button label.                             |
| `buttonNegative` | `string` | No       | `Cancel`                                                                        | Negative (deny) button label.                               |
| `buttonNeutral`  | `string` | No       | `Ask Me Later`                                                                  | Neutral ("ask later") button label.                         |

> **Note:** The default English wording is internal and may evolve between minor versions without a SemVer bump. Pass an explicit `PermissionRationale` if you need stable copy for QA, screenshots, or store review.

#### Example

```ts
import type { PermissionRationale } from '@gabriel-sisjr/react-native-background-location';

const ptBR: PermissionRationale = {
  title: 'Permissão de localização',
  message:
    'Precisamos da sua localização em segundo plano para registrar suas viagens.',
  buttonPositive: 'Permitir',
  buttonNegative: 'Cancelar',
  buttonNeutral: 'Mais tarde',
};
```

---

### `RequestPermissionsOptions`

Options accepted by `useLocationPermissions().requestPermissions(...)`.

The flat-envelope shape is intentional: future siblings -- currently planned `foregroundRationale` (for `PermissionsAndroid.requestMultiple`) and `notificationRationale` (for `POST_NOTIFICATIONS`) -- can be added as additional optional fields without a breaking rename. Each field is named after its target dialog so the call site is self-documenting.

```ts
interface RequestPermissionsOptions {
  backgroundRationale?: PermissionRationale;
}
```

| Property              | Type                                          | Platform        | Description                                                                                                                                                                                                                                                                          |
| --------------------- | --------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `backgroundRationale` | [`PermissionRationale`](#permissionrationale) | Android API 29+ | Optional localized copy for the Android background-location rationale dialog (`PermissionsAndroid.request(ACCESS_BACKGROUND_LOCATION, ...)`). Silently ignored on iOS, on Android < 29, on the foreground-only flow (`requestMultiple`), and on the notification permission request. |

> **Note:** Future releases may add `foregroundRationale` and `notificationRationale` as sibling optional fields. They are reserved and not yet implemented.

#### Example

```ts
import { useLocationPermissions } from '@gabriel-sisjr/react-native-background-location';

const { requestPermissions } = useLocationPermissions();

// Example in Brazilian Portuguese (PT-BR)
const options: PermissionRationale = {
  backgroundRationale: {
    title: 'Permissão de localização',
    message:
      'Precisamos da sua localização em segundo plano para registrar suas viagens.',
  },
};

await requestPermissions(options);
```

---

### `UseLocationPermissionsResult`

Return type for the [`useLocationPermissions`](./hooks/useLocationPermissions.md) hook.

```ts
interface UseLocationPermissionsResult {
  permissionStatus: PermissionState;
  requestPermissions: (options?: RequestPermissionsOptions) => Promise<boolean>;
  checkPermissions: () => Promise<boolean>;
  isRequesting: boolean;
}
```

| Property             | Type                                                        | Description                                                                                                                                                             |
| -------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `permissionStatus`   | `PermissionState`                                           | Current permission state                                                                                                                                                |
| `requestPermissions` | `(options?: RequestPermissionsOptions) => Promise<boolean>` | Request all permissions. Returns `true` if location is granted. Accepts an optional [`RequestPermissionsOptions`](#requestpermissionsoptions) argument (since v0.15.0). |
| `checkPermissions`   | `() => Promise<boolean>`                                    | Check permissions without requesting. Returns `true` if location is granted.                                                                                            |
| `isRequesting`       | `boolean`                                                   | Whether a permission request is in progress                                                                                                                             |

---

## Geofencing Types

### `GeofenceRegion`

Defines a circular geofence region for monitoring.

```ts
interface GeofenceRegion {
  identifier: string;
  latitude: number;
  longitude: number;
  radius: number;
  transitionTypes?: GeofenceTransitionType[];
  loiteringDelay?: number;
  expirationDuration?: number;
  metadata?: Record<string, unknown>;
  notificationOptions?: NotificationOptions | false;
}
```

| Property              | Type                           | Default         | Description                                                                                   |
| --------------------- | ------------------------------ | --------------- | --------------------------------------------------------------------------------------------- |
| `identifier`          | `string`                       | —               | Unique identifier for this geofence (required)                                                |
| `latitude`            | `number`                       | —               | Center latitude (-90 to 90)                                                                   |
| `longitude`           | `number`                       | —               | Center longitude (-180 to 180)                                                                |
| `radius`              | `number`                       | —               | Radius in meters (minimum 100)                                                                |
| `transitionTypes`     | `GeofenceTransitionType[]`     | `[ENTER, EXIT]` | Transition types to monitor                                                                   |
| `loiteringDelay`      | `number`                       | `30000`         | Loitering delay in milliseconds for DWELL detection                                           |
| `expirationDuration`  | `number`                       | `undefined`     | Expiration duration in milliseconds. If omitted, remains active indefinitely.                 |
| `metadata`            | `Record<string, unknown>`      | `undefined`     | Optional JSON-serializable metadata                                                           |
| `notificationOptions` | `NotificationOptions \| false` | `undefined`     | Per-geofence notification config. Set to `false` to suppress notifications for this geofence. |

> **Note:** The `notificationOptions` resolution chain (highest to lowest priority):
>
> 1. Per-geofence `notificationOptions` (this field)
> 2. Global config via `configureGeofenceNotifications()`
> 3. Platform defaults

---

### `GeofenceTransitionEvent`

Event emitted when a geofence transition is detected.

```ts
interface GeofenceTransitionEvent {
  geofenceId: string;
  transitionType: GeofenceTransitionType;
  latitude: number;
  longitude: number;
  timestamp: string;
  distanceFromCenter: number;
  metadata?: Record<string, unknown>;
}
```

| Property             | Type                      | Description                                               |
| -------------------- | ------------------------- | --------------------------------------------------------- |
| `geofenceId`         | `string`                  | Identifier of the geofence that triggered the event       |
| `transitionType`     | `GeofenceTransitionType`  | Type of transition detected (`ENTER`, `EXIT`, or `DWELL`) |
| `latitude`           | `number`                  | Device latitude at the moment of transition               |
| `longitude`          | `number`                  | Device longitude at the moment of transition              |
| `timestamp`          | `string`                  | Timestamp of the transition (ISO 8601 string)             |
| `distanceFromCenter` | `number`                  | Distance from the center of the geofence in meters        |
| `metadata`           | `Record<string, unknown>` | Metadata associated with the geofence, if any             |

---

## Hook Types

### `UseBackgroundLocationResult`

Return type for the [`useBackgroundLocation`](./hooks/useBackgroundLocation.md) hook.

```ts
interface UseBackgroundLocationResult {
  tripId: string | null;
  isTracking: boolean;
  locations: Coords[];
  isLoading: boolean;
  error: Error | null;
  startTracking: (
    customTripId?: string,
    options?: TrackingOptions
  ) => Promise<string | null>;
  stopTracking: () => Promise<void>;
  refreshLocations: () => Promise<void>;
  clearCurrentTrip: () => Promise<void>;
  clearError: () => void;
}
```

| Property           | Type                                                   | Description                                      |
| ------------------ | ------------------------------------------------------ | ------------------------------------------------ |
| `tripId`           | `string \| null`                                       | Current trip ID, or `null` if not tracking       |
| `isTracking`       | `boolean`                                              | Whether tracking is active                       |
| `locations`        | `Coords[]`                                             | All locations collected for the current trip     |
| `isLoading`        | `boolean`                                              | Whether an async operation is in progress        |
| `error`            | `Error \| null`                                        | Last error that occurred                         |
| `startTracking`    | `(customTripId?, options?) => Promise<string \| null>` | Start tracking with optional trip ID and options |
| `stopTracking`     | `() => Promise<void>`                                  | Stop tracking                                    |
| `refreshLocations` | `() => Promise<void>`                                  | Reload locations from database                   |
| `clearCurrentTrip` | `() => Promise<void>`                                  | Clear all data for the current trip              |
| `clearError`       | `() => void`                                           | Reset error state to `null`                      |

---

### `UseLocationTrackingOptions`

Options for the [`useBackgroundLocation`](./hooks/useBackgroundLocation.md) hook.

```ts
interface UseLocationTrackingOptions {
  autoStart?: boolean;
  tripId?: string;
  options?: TrackingOptions;
  onTrackingStart?: (tripId: string) => void;
  onTrackingStop?: () => void;
  onError?: (error: Error) => void;
}
```

| Property          | Type                       | Default | Description                                        |
| ----------------- | -------------------------- | ------- | -------------------------------------------------- |
| `autoStart`       | `boolean`                  | `false` | Automatically start tracking when component mounts |
| `tripId`          | `string`                   | —       | Custom trip ID to use                              |
| `options`         | `TrackingOptions`          | —       | Tracking configuration options                     |
| `onTrackingStart` | `(tripId: string) => void` | —       | Callback when tracking starts                      |
| `onTrackingStop`  | `() => void`               | —       | Callback when tracking stops                       |
| `onError`         | `(error: Error) => void`   | —       | Callback when an error occurs                      |

---

### `UseLocationTrackingResult`

Return type for the [`useLocationTracking`](./hooks/useLocationTracking.md) hook.

```ts
interface UseLocationTrackingResult {
  isTracking: boolean;
  tripId: string | null;
  refresh: () => Promise<void>;
  isLoading: boolean;
}
```

| Property     | Type                  | Description                       |
| ------------ | --------------------- | --------------------------------- |
| `isTracking` | `boolean`             | Whether tracking is active        |
| `tripId`     | `string \| null`      | Current trip ID, or `null`        |
| `refresh`    | `() => Promise<void>` | Manually re-check tracking status |
| `isLoading`  | `boolean`             | Whether status is being checked   |

---

### `UseLocationUpdatesOptions`

Options for the [`useLocationUpdates`](./hooks/useLocationUpdates.md) hook.

```ts
interface UseLocationUpdatesOptions {
  tripId?: string;
  onLocationUpdate?: (location: Coords) => void;
  onUpdateInterval?: number;
  onLocationWarning?: (warning: LocationWarningEvent) => void;
  onNotificationAction?: (event: NotificationActionEvent) => void;
  autoLoad?: boolean;
}
```

| Property               | Type                                       | Default     | Description                                                           |
| ---------------------- | ------------------------------------------ | ----------- | --------------------------------------------------------------------- |
| `tripId`               | `string`                                   | —           | Specific trip ID to watch. If not provided, watches all trips.        |
| `onLocationUpdate`     | `(location: Coords) => void`               | —           | Callback for each new location                                        |
| `onUpdateInterval`     | `number`                                   | `undefined` | Throttle interval in milliseconds for the `onLocationUpdate` callback |
| `onLocationWarning`    | `(warning: LocationWarningEvent) => void`  | —           | Callback for service warnings                                         |
| `onNotificationAction` | `(event: NotificationActionEvent) => void` | —           | Callback for notification action button presses                       |
| `autoLoad`             | `boolean`                                  | `true`      | Whether to automatically load existing locations on mount             |

---

### `UseLocationUpdatesResult`

Return type for the [`useLocationUpdates`](./hooks/useLocationUpdates.md) hook.

```ts
interface UseLocationUpdatesResult {
  tripId: string | null;
  isTracking: boolean;
  locations: Coords[];
  lastLocation: Coords | null;
  lastWarning: LocationWarningEvent | null;
  isLoading: boolean;
  error: Error | null;
  clearError: () => void;
  clearLocations: () => Promise<void>;
  refreshLocations: () => Promise<void>;
}
```

| Property           | Type                           | Description                                  |
| ------------------ | ------------------------------ | -------------------------------------------- |
| `tripId`           | `string \| null`               | Current trip ID being watched                |
| `isTracking`       | `boolean`                      | Whether tracking is active                   |
| `locations`        | `Coords[]`                     | All locations received, updated in real time |
| `lastLocation`     | `Coords \| null`               | Most recently received location              |
| `lastWarning`      | `LocationWarningEvent \| null` | Most recent service warning                  |
| `isLoading`        | `boolean`                      | Whether data is being loaded                 |
| `error`            | `Error \| null`                | Last error that occurred                     |
| `clearError`       | `() => void`                   | Reset error state                            |
| `clearLocations`   | `() => Promise<void>`          | Clear all locations for the current trip     |
| `refreshLocations` | `() => Promise<void>`          | Manually re-load locations from the database |

---

### `UseGeofencingOptions`

Options for the [`useGeofencing`](./hooks/useGeofencing.md) hook.

```ts
interface UseGeofencingOptions {
  autoLoad?: boolean;
  notificationOptions?: NotificationOptions;
}
```

| Property              | Type                  | Default | Description                                                                                   |
| --------------------- | --------------------- | ------- | --------------------------------------------------------------------------------------------- |
| `autoLoad`            | `boolean`             | `true`  | Whether to automatically load geofences on mount                                              |
| `notificationOptions` | `NotificationOptions` | —       | Global notification config. When provided, calls `configureGeofenceNotifications()` on mount. |

---

### `UseGeofencingReturn`

Return type for the [`useGeofencing`](./hooks/useGeofencing.md) hook.

```ts
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

| Property             | Type                             | Description                                 |
| -------------------- | -------------------------------- | ------------------------------------------- |
| `geofences`          | `GeofenceRegion[]`               | Currently active geofence regions           |
| `isLoading`          | `boolean`                        | Whether an async operation is in progress   |
| `error`              | `Error \| null`                  | Last error that occurred                    |
| `addGeofence`        | `(region) => Promise<void>`      | Register a single geofence                  |
| `addGeofences`       | `(regions) => Promise<void>`     | Register multiple geofences atomically      |
| `removeGeofence`     | `(identifier) => Promise<void>`  | Remove a single geofence                    |
| `removeGeofences`    | `(identifiers) => Promise<void>` | Remove multiple geofences                   |
| `removeAllGeofences` | `() => Promise<void>`            | Remove all geofences                        |
| `maxGeofences`       | `number \| null`                 | Platform limit, or `null` if not yet loaded |
| `refresh`            | `() => Promise<void>`            | Reload geofences and platform limit         |
| `clearError`         | `() => void`                     | Reset error state                           |

---

### `UseGeofenceEventsOptions`

Options for the [`useGeofenceEvents`](./hooks/useGeofenceEvents.md) hook.

```ts
interface UseGeofenceEventsOptions {
  onTransition?: (event: GeofenceTransitionEvent) => void;
  filter?: GeofenceTransitionType[];
  geofenceId?: string;
}
```

| Property       | Type                                       | Default | Description                                                                             |
| -------------- | ------------------------------------------ | ------- | --------------------------------------------------------------------------------------- |
| `onTransition` | `(event: GeofenceTransitionEvent) => void` | —       | Callback when a geofence transition is detected (after filters are applied)             |
| `filter`       | `GeofenceTransitionType[]`                 | —       | Only emit events matching these transition types. If omitted, all transitions fire.     |
| `geofenceId`   | `string`                                   | —       | Only emit events for this specific geofence identifier. If omitted, all geofences fire. |
