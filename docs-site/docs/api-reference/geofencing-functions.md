---
sidebar_position: 2
title: Geofencing Functions
description: API reference for geofencing functions — addGeofence, addGeofences, removeGeofence, removeGeofences, removeAllGeofences, getActiveGeofences, getMaxGeofences, getGeofenceTransitions, clearGeofenceTransitions, configureGeofenceNotifications, and getGeofenceNotificationConfig.
keywords:
  - react-native
  - geofencing
  - geofence
  - api
  - addGeofence
  - removeGeofence
  - geofence-transitions
  - geofence-notifications
---

# Geofencing Functions

Functions for managing geofence regions, transition events, and notification configuration. All geofencing functions require the native module to be available and will throw if it is not (unlike tracking functions, which degrade gracefully).

```ts
import {
  addGeofence,
  addGeofences,
  removeGeofence,
  removeGeofences,
  removeAllGeofences,
  getActiveGeofences,
  getMaxGeofences,
  getGeofenceTransitions,
  clearGeofenceTransitions,
  configureGeofenceNotifications,
  getGeofenceNotificationConfig,
} from '@gabriel-sisjr/react-native-background-location';
```

---

## `addGeofence`

Registers a single geofence region for monitoring. Validates the region parameters and checks for duplicate identifiers before registering.

**Platform:** Android and iOS

### Signature

```ts
function addGeofence(region: GeofenceRegion): Promise<void>
```

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `region` | [`GeofenceRegion`](./types.md#geofenceregion) | Yes | The geofence region to register |

### Return Value

`Promise<void>` — Resolves when the geofence is registered.

### Throws

| Error | Code | Condition |
|-------|------|-----------|
| `GeofenceError` | `DUPLICATE_IDENTIFIER` | A geofence with the same `identifier` already exists |
| `GeofenceError` | `INVALID_REGION` | Invalid region parameters (coordinates, radius, or identifier) |
| `GeofenceError` | `NOT_AVAILABLE` | Native module is not available |

### Usage

```ts
import { addGeofence, GeofenceTransitionType } from '@gabriel-sisjr/react-native-background-location';

await addGeofence({
  identifier: 'office',
  latitude: -23.5505,
  longitude: -46.6333,
  radius: 200,
  transitionTypes: [GeofenceTransitionType.ENTER, GeofenceTransitionType.EXIT],
  loiteringDelay: 30000,
  metadata: { name: 'Main Office', floor: 3 },
});
```

---

## `addGeofences`

Registers multiple geofence regions atomically (all-or-nothing). Validates all regions and checks for duplicate identifiers within the batch before registering.

**Platform:** Android and iOS

### Signature

```ts
function addGeofences(regions: GeofenceRegion[]): Promise<void>
```

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `regions` | [`GeofenceRegion[]`](./types.md#geofenceregion) | Yes | Array of geofence regions to register |

### Return Value

`Promise<void>` — Resolves when all geofences are registered.

### Throws

| Error | Code | Condition |
|-------|------|-----------|
| `GeofenceError` | `DUPLICATE_IDENTIFIER` | Duplicate identifiers found within the batch |
| `GeofenceError` | `INVALID_REGION` | Any region has invalid parameters |
| `GeofenceError` | `NOT_AVAILABLE` | Native module is not available |

### Usage

```ts
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
]);
```

---

## `removeGeofence`

Removes a single geofence by its identifier.

**Platform:** Android and iOS

### Signature

```ts
function removeGeofence(identifier: string): Promise<void>
```

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `identifier` | `string` | Yes | The geofence identifier to remove |

### Return Value

`Promise<void>` — Resolves when the geofence is removed.

### Usage

```ts
await removeGeofence('office');
```

---

## `removeGeofences`

Removes multiple geofences by their identifiers.

**Platform:** Android and iOS

### Signature

```ts
function removeGeofences(identifiers: string[]): Promise<void>
```

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `identifiers` | `string[]` | Yes | Array of geofence identifiers to remove |

### Return Value

`Promise<void>` — Resolves when all specified geofences are removed.

### Usage

```ts
await removeGeofences(['office', 'home', 'gym']);
```

---

## `removeAllGeofences`

Removes all registered geofences.

**Platform:** Android and iOS

### Signature

```ts
function removeAllGeofences(): Promise<void>
```

### Parameters

None.

### Return Value

`Promise<void>` — Resolves when all geofences are removed.

### Usage

```ts
await removeAllGeofences();
```

---

## `getActiveGeofences`

Returns all currently active (registered) geofences.

**Platform:** Android and iOS

### Signature

```ts
function getActiveGeofences(): Promise<GeofenceRegion[]>
```

### Parameters

None.

### Return Value

`Promise<GeofenceRegion[]>` — Array of currently active geofence regions.

### Usage

```ts
const active = await getActiveGeofences();
console.log(`${active.length} geofences active`);

active.forEach((g) => {
  console.log(`${g.identifier}: ${g.latitude}, ${g.longitude} (r=${g.radius}m)`);
});
```

---

## `getMaxGeofences`

Returns the maximum number of geofences supported by the current platform.

**Platform:** Android and iOS

### Signature

```ts
function getMaxGeofences(): Promise<number>
```

### Parameters

None.

### Return Value

`Promise<number>` — The platform limit for simultaneous geofences.

| Platform | Limit |
|----------|-------|
| Android | 100 |
| iOS | 20 |

### Usage

```ts
const max = await getMaxGeofences();
const active = await getActiveGeofences();
console.log(`Using ${active.length} of ${max} available geofences`);
```

---

## `getGeofenceTransitions`

Retrieves stored geofence transition events from the local database.

**Platform:** Android and iOS

### Signature

```ts
function getGeofenceTransitions(
  identifier?: string
): Promise<GeofenceTransitionEvent[]>
```

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `identifier` | `string` | No | Geofence identifier to filter by. If omitted, returns all transitions. |

### Return Value

`Promise<GeofenceTransitionEvent[]>` — Array of geofence transition events.

See the [Types reference](./types.md#geofencetransitionevent) for the full `GeofenceTransitionEvent` interface.

### Usage

```ts
// Get all transitions
const allTransitions = await getGeofenceTransitions();

// Get transitions for a specific geofence
const officeTransitions = await getGeofenceTransitions('office');

officeTransitions.forEach((t) => {
  console.log(`${t.transitionType} at ${t.timestamp}`);
});
```

---

## `clearGeofenceTransitions`

Clears stored geofence transition events from the local database.

**Platform:** Android and iOS

### Signature

```ts
function clearGeofenceTransitions(identifier?: string): Promise<void>
```

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `identifier` | `string` | No | Geofence identifier to clear. If omitted, clears all transitions. |

### Return Value

`Promise<void>` — Resolves when the transition events are cleared.

### Usage

```ts
// Clear all transition history
await clearGeofenceTransitions();

// Clear transitions for a specific geofence
await clearGeofenceTransitions('office');
```

---

## `configureGeofenceNotifications`

Configures global notification options for geofence transitions. Configuration persists across app restarts (via SharedPreferences on Android / UserDefaults on iOS). Applies to all future transitions; already-fired transitions are unaffected.

**Platform:** Android and iOS

### Signature

```ts
function configureGeofenceNotifications(
  options: NotificationOptions
): Promise<void>
```

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | [`NotificationOptions`](./types.md#notificationoptions) | Yes | Notification configuration for geofence transitions |

### Return Value

`Promise<void>` — Resolves when the configuration is saved.

### Usage

```ts
import {
  configureGeofenceNotifications,
  GEOFENCE_TEMPLATE_VARS,
} from '@gabriel-sisjr/react-native-background-location';

await configureGeofenceNotifications({
  title: 'Geofence Alert',
  text: `Transition at ${GEOFENCE_TEMPLATE_VARS.IDENTIFIER}`,
  priority: NotificationPriority.HIGH,
  transitionOverrides: {
    ENTER: {
      title: 'Welcome!',
      text: `You entered ${GEOFENCE_TEMPLATE_VARS.IDENTIFIER}`,
    },
    EXIT: {
      title: 'Goodbye!',
      text: `You left ${GEOFENCE_TEMPLATE_VARS.IDENTIFIER}`,
    },
  },
});
```

---

## `getGeofenceNotificationConfig`

Retrieves the current global geofence notification configuration. Returns an empty object if no configuration has been set.

**Platform:** Android and iOS

### Signature

```ts
function getGeofenceNotificationConfig(): Promise<NotificationOptions>
```

### Parameters

None.

### Return Value

`Promise<NotificationOptions>` — The current notification configuration.

### Usage

```ts
const config = await getGeofenceNotificationConfig();
console.log('Current geofence notification config:', config);
```
