---
sidebar_position: 7
title: useMotionActivity
description: API reference for the useMotionActivity hook — motion activity events and the detection and reduction status of the current tracking session.
keywords:
  - react-native
  - background-location
  - hook
  - useMotionActivity
  - motion activity
  - activity recognition
---

# useMotionActivity

Read-only hook that observes the opt-in motion activity feature of the current tracking session: the latest `onMotionActivity` event, whether detection is running, and whether location updates are reduced while the device is stationary.

```ts
import { useMotionActivity } from '@gabriel-sisjr/react-native-background-location';
```

**Platform:** Android and iOS

The hook never starts detection or asks for a permission. Detection starts with `startTracking` when the `motionActivity` option is set; see the [Motion Activity guide](../../guides/motion-activity.md) for the setup on each platform.

---

## Signature

```ts
function useMotionActivity(
  options?: UseMotionActivityOptions
): UseMotionActivityResult
```

---

## Parameters

`UseMotionActivityOptions` (all optional):

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `tripId` | `string` | `undefined` | Only keep events, and the hydrated state, of this trip. When omitted, every trip is watched |
| `onMotionActivity` | `(event: MotionActivityEvent) => void` | `undefined` | Called for every motion activity event kept by the hook |

---

## Return Value

Returns a `UseMotionActivityResult` object.

| Property | Type | Description |
|----------|------|-------------|
| `lastActivity` | `MotionActivityEvent \| null` | Most recent event seen by the hook, from an event or from the hydrated state |
| `detection` | `MotionDetectionStatus` | `OFF`, `RUNNING`, `UNAVAILABLE` or `PERMISSION_NOT_GRANTED` |
| `reduction` | `MotionReductionStatus` | `DISABLED`, `NOT_APPLICABLE`, `UNAVAILABLE`, `MONITORING` or `REDUCED` |
| `refresh` | `() => Promise<void>` | Re-reads the native state through `getMotionActivityState()` |

`MotionActivityEvent` is `{ tripId, activity, confidence, timestamp }`. See [Motion Activity Types](../types.md#motion-activity-types) and the [enums](../enums.md#motiondetectionstatus).

---

## Behavior Details

### Hydration

The hook reads the native state with `getMotionActivityState()`:

- on mount;
- when the `tripId` option changes;
- every time the app becomes `active`;
- on every `MOTION_*` warning (`MOTION_LOCATION_REDUCED`, `MOTION_LOCATION_RESTORED`, `MOTION_ACTIVITY_UNAVAILABLE`, `MOTION_PERMISSION_NOT_GRANTED`);
- on an `onMotionActivity` event that it keeps (see the trip filter below) when the state it last read is not `RUNNING` for that event's trip. Events flow only while detection runs, so this read picks up a session that started after the previous read. It happens at most once per trip.

Only the most recent refresh updates the state, and a hydrated activity never replaces a newer event received in the meantime.

### After `startTracking()` and `stopTracking()`

- **Start** -- No call is needed. A successful start emits no warning: the hook reads the new session when its first event arrives, or when a `MOTION_*` warning reports that detection could not start. For an immediate read, call `refresh()` after `startTracking()`. On Android the session starts in the foreground service shortly after `startTracking()` resolves, so that read can still return the previous state; the first event corrects it.
- **Stop** -- `stopTracking()` emits no event and no warning, so `detection` and `reduction` keep their last values until one of the triggers above. Call `refresh()` after `stopTracking()` to read the stopped state (see [Refreshing after a stop](#refreshing-after-a-stop)).

### Native build without motion activity

Motion activity needs the native code of version 1.2.0 or later. When the JavaScript bundle is newer than the app's native build (for example after an over-the-air JavaScript update), the native module has no `getMotionActivityState()` method. The hook then skips its automatic refreshes and logs `[BackgroundLocation] motion activity is not available in this native build; rebuild the app to use it.` once per JavaScript session, and keeps the default state. A `refresh()` call still resolves, with the OFF state. Rebuild the app to use motion activity.

### Events and the trip filter

Each `onMotionActivity` event whose `tripId` matches the `tripId` option (every event when the option is omitted) is stored in `lastActivity` and passed to `onMotionActivity`. The callback is read through a ref, so passing a new function on every render does not resubscribe.

When `tripId` is given and the active session belongs to another trip, the hook reports `detection: OFF` and `reduction: DISABLED`.

### `lastActivity` lifetime

`lastActivity` is not cleared when tracking stops, so the last known activity stays visible. It is reset to `null` when the `tripId` option changes.

### Feature off and native module unavailability

With `motionActivity` off, the native state is the OFF state (`detection: OFF`, `reduction: DISABLED`, no activity) and no event arrives, so the hook has no effect. If the native module is not available (for example in a simulator without the module linked), the hook returns `lastActivity: null`, `detection: OFF` and `reduction: DISABLED` and subscribes to nothing.

### Cleanup

On unmount the hook removes its event, warning and app-state subscriptions.

---

## Usage

### Status badge

```tsx
import { Text, View } from 'react-native';
import {
  MotionReductionStatus,
  useMotionActivity,
} from '@gabriel-sisjr/react-native-background-location';

function MotionStatus({ tripId }: { tripId: string }) {
  const { lastActivity, detection, reduction } = useMotionActivity({ tripId });

  return (
    <View>
      <Text>Detection: {detection}</Text>
      <Text>Activity: {lastActivity?.activity ?? 'none yet'}</Text>
      {reduction === MotionReductionStatus.REDUCED && (
        <Text>Parked: location updates reduced</Text>
      )}
    </View>
  );
}
```

### Logging activity changes

```tsx
import { useMotionActivity } from '@gabriel-sisjr/react-native-background-location';

function MotionLogger({ tripId }: { tripId: string }) {
  useMotionActivity({
    tripId,
    onMotionActivity: (event) => {
      console.log(
        `${new Date(event.timestamp).toISOString()} ${event.activity} (${event.confidence})`
      );
    },
  });

  return null;
}
```

### Refreshing after a stop

```tsx
import { Button, Text, View } from 'react-native';
import {
  startTracking,
  stopTracking,
  useMotionActivity,
} from '@gabriel-sisjr/react-native-background-location';

function TripControls({ tripId }: { tripId: string }) {
  const { detection, reduction, refresh } = useMotionActivity({ tripId });

  // The hook picks up the new session by itself
  const start = () =>
    startTracking(tripId, { motionActivity: { reduceWhenStationary: true } });

  const stop = async () => {
    await stopTracking();
    await refresh(); // a stop emits no event or warning
  };

  return (
    <View>
      <Text>
        Detection: {detection} / Reduction: {reduction}
      </Text>
      <Button title="Start trip" onPress={start} />
      <Button title="Stop trip" onPress={stop} />
    </View>
  );
}
```

### Explaining why detection is not running

```tsx
import { Text } from 'react-native';
import {
  MotionDetectionStatus,
  useMotionActivity,
} from '@gabriel-sisjr/react-native-background-location';

function MotionHint() {
  const { detection } = useMotionActivity();

  switch (detection) {
    case MotionDetectionStatus.PERMISSION_NOT_GRANTED:
      return <Text>Allow motion access to detect when the vehicle is parked.</Text>;
    case MotionDetectionStatus.UNAVAILABLE:
      return <Text>Motion detection is not available on this device.</Text>;
    default:
      return null;
  }
}
```

The warning message that explains the cause arrives on `onLocationWarning`; see the [warning catalogue](../../guides/motion-activity.md#warnings).

---

## When to Use

Use `useMotionActivity` when a screen shows the motion state of a trip or reacts to activity changes. Outside React, use `addMotionActivityListener()` and `getMotionActivityState()` from the [Motion Activity Functions](../functions.md#motion-activity-functions).

| Feature | `useMotionActivity` | `addMotionActivityListener` |
|---------|---------------------|-----------------------------|
| Activity events | Yes | Yes |
| Detection and reduction status | Yes | No (call `getMotionActivityState()`) |
| Trip filter | Yes | No (filter on `event.tripId`) |
| Automatic state refresh (mount, app resume, `MOTION_*` warnings, first event of a session) | Yes | No |
| Automatic cleanup | On unmount | Call `remove()` |
