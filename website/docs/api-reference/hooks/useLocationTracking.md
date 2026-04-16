---
sidebar_position: 2
title: useLocationTracking
description: API reference for the useLocationTracking hook — lightweight tracking status monitoring without start/stop control.
keywords:
  - react-native
  - background-location
  - hook
  - useLocationTracking
  - tracking-status
---

# useLocationTracking

Lightweight hook that only monitors whether location tracking is currently active. Use this when you need to display tracking status without managing the tracking lifecycle.

```ts
import { useLocationTracking } from '@gabriel-sisjr/react-native-background-location';
```

**Platform:** Android and iOS

---

## Signature

```ts
function useLocationTracking(autoRefresh?: boolean): UseLocationTrackingResult
```

---

## Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `autoRefresh` | `boolean` | `true` | Whether to automatically check tracking status on mount |

---

## Return Value

Returns a `UseLocationTrackingResult` object.

| Property | Type | Description |
|----------|------|-------------|
| `isTracking` | `boolean` | Whether location tracking is currently active |
| `tripId` | `string \| null` | Current trip ID if tracking is active, `null` otherwise |
| `refresh` | `() => Promise<void>` | Manually re-check tracking status from the native module |
| `isLoading` | `boolean` | Whether a status check is in progress |

---

## Behavior Details

### Mount Check

When `autoRefresh` is `true` (the default), the hook calls `isTracking()` on the native module when the component mounts and populates the state with the result.

### Manual Refresh

Call `refresh()` to re-query the native module for the current tracking status. This is useful when you know tracking state may have changed externally (e.g., via a different component or screen).

### Native Module Unavailability

If the native module is not available (e.g., running in a simulator), the hook logs a warning and reports `{ isTracking: false, tripId: null }`.

---

## Usage

### Status badge

```tsx
import { useLocationTracking } from '@gabriel-sisjr/react-native-background-location';

function StatusBadge() {
  const { isTracking, tripId } = useLocationTracking();

  return (
    <View>
      <Text>Status: {isTracking ? 'Tracking' : 'Stopped'}</Text>
      {tripId && <Text>Trip: {tripId}</Text>}
    </View>
  );
}
```

### Manual refresh

```tsx
function TrackingIndicator() {
  const { isTracking, refresh, isLoading } = useLocationTracking();

  return (
    <View>
      <Text>{isTracking ? 'Active' : 'Inactive'}</Text>
      <Button title="Refresh" onPress={refresh} disabled={isLoading} />
    </View>
  );
}
```

### Without auto-refresh

```tsx
function LazyStatus() {
  const { isTracking, refresh } = useLocationTracking(false);

  // Status won't be checked until refresh() is called
  useEffect(() => {
    // Check status when some condition is met
    if (someCondition) {
      refresh();
    }
  }, [someCondition, refresh]);

  return <Text>{isTracking ? 'On' : 'Off'}</Text>;
}
```

---

## When to Use

Use `useLocationTracking` when you:

- Only need to **read** tracking status (not start/stop)
- Want a lightweight hook with minimal overhead
- Need a status indicator in a component far from the tracking controller

Use [`useBackgroundLocation`](./useBackgroundLocation.md) instead when you need to start/stop tracking, manage trip data, or access stored locations.

| Feature | `useLocationTracking` | `useBackgroundLocation` |
|---------|----------------------|------------------------|
| Read tracking status | Yes | Yes |
| Start/stop tracking | No | Yes |
| Access locations | No | Yes |
| Trip management | No | Yes |
| Lifecycle callbacks | No | Yes |
| Bundle size impact | Minimal | Larger |
