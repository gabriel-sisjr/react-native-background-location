# Breaking Changes - v0.12.0

> **Upgrade path:** v0.10.x --> v0.12.0 (v0.11 was internal only, never published to npm)

This release contains 3 breaking changes to the TypeScript types layer. All are compile-time errors -- your existing code will fail to build until migrated, but there are no silent behavioral regressions.

---

## 1. `PermissionState` -- Granular Structure

The flat `PermissionState` interface is now a nested structure that separates location and notification permission states.

### Before (v0.10.x)

```typescript
interface PermissionState {
  hasPermission: boolean;
  status: LocationPermissionStatus;
  canRequestAgain: boolean;
}
```

### After (v0.12.0)

```typescript
interface PermissionState {
  hasAllPermissions: boolean;
  location: LocationPermissionState;
  notification: NotificationPermissionState;
}

interface LocationPermissionState {
  hasPermission: boolean;
  status: LocationPermissionStatus;
  canRequestAgain: boolean;
}

interface NotificationPermissionState {
  hasPermission: boolean;
  status: NotificationPermissionStatus;
  canRequestAgain: boolean;
}
```

### Migration

| v0.10.x                            | v0.12.0                                     |
| ---------------------------------- | ------------------------------------------- |
| `permissionStatus.hasPermission`   | `permissionStatus.hasAllPermissions`        |
| `permissionStatus.status`          | `permissionStatus.location.status`          |
| `permissionStatus.canRequestAgain` | `permissionStatus.location.canRequestAgain` |

### Example

```typescript
// Before
const { permissionStatus } = useLocationPermissions();
if (permissionStatus.hasPermission) {
  console.log(permissionStatus.status); // 'granted'
}

// After
const { permissionStatus } = useLocationPermissions();
if (permissionStatus.hasAllPermissions) {
  console.log(permissionStatus.location.status); // 'granted'
  console.log(permissionStatus.notification.status); // 'granted' | 'denied' | 'undetermined'
}
```

### New imports

```typescript
import type {
  LocationPermissionState,
  NotificationPermissionState,
} from '@gabriel-sisjr/react-native-background-location';
```

---

## 2. `NotificationOptions` -- Unified Object

The 11 flat `notification*` fields in `TrackingOptions` are replaced by a single `notificationOptions` object. This aligns tracking notifications with geofencing notifications under one shared `NotificationOptions` interface.

### Before (v0.10.x)

```typescript
startTracking({
  updateInterval: 5000,
  notificationTitle: 'Location Tracking',
  notificationText: 'Tracking in background',
  notificationChannelName: 'Background Location',
  notificationChannelId: 'location_channel',
  notificationPriority: NotificationPriority.LOW,
  notificationSmallIcon: 'ic_notification',
  notificationLargeIcon: 'ic_notification_large',
  notificationColor: '#4CAF50',
  notificationShowTimestamp: true,
  notificationSubtext: 'Example',
  notificationActions: [{ id: 'stop', label: 'Stop' }],
});
```

### After (v0.12.0)

```typescript
startTracking({
  updateInterval: 5000,
  notificationOptions: {
    title: 'Location Tracking',
    text: 'Tracking in background',
    channelName: 'Background Location',
    channelId: 'location_channel',
    priority: NotificationPriority.LOW,
    smallIcon: 'ic_notification',
    largeIcon: 'ic_notification_large',
    color: '#4CAF50',
    showTimestamp: true,
    subtext: 'Example',
    actions: [{ id: 'stop', label: 'Stop' }],
  },
});
```

### Migration

| v0.10.x                     | v0.12.0                             |
| --------------------------- | ----------------------------------- |
| `notificationTitle`         | `notificationOptions.title`         |
| `notificationText`          | `notificationOptions.text`          |
| `notificationChannelName`   | `notificationOptions.channelName`   |
| `notificationChannelId`     | `notificationOptions.channelId`     |
| `notificationPriority`      | `notificationOptions.priority`      |
| `notificationSmallIcon`     | `notificationOptions.smallIcon`     |
| `notificationLargeIcon`     | `notificationOptions.largeIcon`     |
| `notificationColor`         | `notificationOptions.color`         |
| `notificationShowTimestamp` | `notificationOptions.showTimestamp` |
| `notificationSubtext`       | `notificationOptions.subtext`       |
| `notificationActions`       | `notificationOptions.actions`       |

### New capability

The `NotificationOptions` interface adds an `enabled` field that was not previously available:

```typescript
startTracking({
  updateInterval: 5000,
  notificationOptions: {
    enabled: false, // Explicitly suppress the notification
  },
});
```

### New import

```typescript
import type { NotificationOptions } from '@gabriel-sisjr/react-native-background-location';
```

---

## 3. `NotificationPermissionStatus` Enum & iOS Notification Permission

A new enum for notification permission states, paired with native iOS notification permission support in `useLocationPermissions`.

### New enum

```typescript
enum NotificationPermissionStatus {
  GRANTED = 'granted',
  DENIED = 'denied',
  UNDETERMINED = 'undetermined',
}
```

### Where it appears

- `NotificationPermissionState.status` uses this enum
- `PermissionState.notification.status` exposes it through the permission hook

### Import

```typescript
import { NotificationPermissionStatus } from '@gabriel-sisjr/react-native-background-location';
```

### iOS Permission Flow

`useLocationPermissions().requestPermissions()` now includes a third step on iOS:

1. Request location permission (existing behavior)
2. Request background location permission if `foregroundOnly` is false (existing behavior)
3. **Request notification permission on iOS** via `UNUserNotificationCenter` (new in v0.12.0)

Notification permission is optional -- `requestPermissions()` will return `true` when location is granted, even if notification permission is denied. The notification status is exposed reactively through `permissionStatus.notification` so consumers can build their own UI to guide users.

---

## Quick Migration Checklist

- [ ] Replace `permissionStatus.hasPermission` with `permissionStatus.hasAllPermissions`
- [ ] Replace `permissionStatus.status` with `permissionStatus.location.status`
- [ ] Replace `permissionStatus.canRequestAgain` with `permissionStatus.location.canRequestAgain`
- [ ] Move all `notification*` fields into the `notificationOptions` object
- [ ] Strip the `notification` prefix from field names inside `notificationOptions`
- [ ] Update TypeScript imports if you explicitly import `PermissionState`
- [ ] Add `LocationPermissionState` and `NotificationPermissionState` imports if needed

## Files Changed (types layer)

| File                         | Change                                                                                         |
| ---------------------------- | ---------------------------------------------------------------------------------------------- |
| `src/types/enums.ts`         | Added `NotificationPermissionStatus` enum                                                      |
| `src/types/permissions.ts`   | Added `LocationPermissionState`, `NotificationPermissionState`; restructured `PermissionState` |
| `src/types/tracking.ts`      | Removed 11 flat `notification*` fields; added `notificationOptions?: NotificationOptions`      |
| `src/types/notifications.ts` | New file -- `NotificationOptions` interface (shared with geofencing)                           |
| `src/types/index.ts`         | Updated exports for all new types and enums                                                    |
