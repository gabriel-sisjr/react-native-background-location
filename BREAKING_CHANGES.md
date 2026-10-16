# Breaking Changes

## 1.1.0 (2026-10-16) - Expo config plugin (additive, no breaking changes)

> **Upgrade path:** v1.0.x --> v1.1.0

No breaking changes. The public TypeScript API, the TurboModule Codegen spec, the native event names and the Android/iOS runtime code are unchanged, so **bare React Native apps need no code changes**. Expo projects get a config plugin (minimum Expo SDK 54) and do not need to change any JavaScript import.

What changed in the package metadata, and when it could matter for a bare project:

- **New optional peer dependency `expo`** (range `*`, marked optional in `peerDependenciesMeta`). It has no install-time effect: projects without the `expo` package are not affected, and a bare project that already has an `expo` release installed (for example through Expo Modules) gets no peer-dependency conflict or warning, whichever Expo SDK it is on. The peer exists so that the Expo config plugin, which imports its helpers from `expo/config-plugins`, resolves against the Expo SDK of the app. No earlier release declared an `expo` or `@expo/config-plugins` peer.
- **New `exports` entries.** `./app.plugin` (with types) and `./app.plugin.js` were added next to the existing `.` and `./package.json`. Nothing that resolved before resolves differently now. `app.plugin.js` and `plugin/build/` are loaded by Expo's tooling when it evaluates your app config (prebuild, `expo config`, EAS); Metro and your app bundle never import them.
- **`react-native.config.js` is still not shipped.** The `files` list in `package.json` has always named `react-native.config.js`, but no release of this package has ever contained that file, and this release does not add it either. Autolinking works from the package layout exactly as before.
- **iOS privacy manifest.** `ios/PrivacyInfo.xcprivacy` now declares `NSPrivacyAccessedAPICategoryUserDefaults` with reason `CA92.1` (the library stores its stop token, recovery counters and geofence notification settings in `UserDefaults`). The previous manifest listed no accessed API types. If you maintain a hand-written aggregate privacy manifest or an App Store privacy report that mirrors the library's manifest, add the new entry.
- **Package contents.** New files: `app.plugin.js`, `app.plugin.d.ts` (types for the `./app.plugin` entry) and `plugin/build/**`. The `files` list in `package.json` names `plugin/build` only, so the Expo plugin sources, tests, tsconfig files and `plugin/README.md` are not published. `lib/typescript/` no longer contains the declaration files generated from `website/` that every release since `0.14.0`, `1.0.0` included, shipped by mistake.

Expo users: add the plugin to `plugins` and run `expo prebuild --clean`. The plugin raises the iOS deployment target to 16.0 when it is lower, wherever `expo-build-properties` sits in `plugins` (you can drop an `expo-build-properties` entry that only existed for this), and stops the prebuild with a `PluginError` (`NEW_ARCHITECTURE_DISABLED`) if the New Architecture is explicitly disabled, which Expo SDK 55 and later no longer allow. Expo SDK 50-53 are not supported: the plugin prints a warning there and does not block the prebuild. See the [Expo Config Plugin guide](https://gabriel-sisjr.github.io/react-native-background-location/docs/guides/expo-config-plugin).

## 0.14.0 (2026-04-15) - Public API Surface Cleanup

> **Upgrade path:** v0.13.x --> v0.14.0
>
> **Full migration guide:** [`docs/migration/v0.14.0.md`](https://gabriel-sisjr.github.io/react-native-background-location/docs/migration/v0-14-0) -- includes a 2-minute sed/Node codemod, step-by-step instructions, common pitfalls, and the full affected-symbols table. The summary below is for the changelog; the migration guide is the authoritative reference.

One breaking change to the public TypeScript API surface. **Compile-time error only** -- your build will fail until migrated, but there are zero silent runtime regressions and no native (Android/iOS) code changed.

### Default export removed

The library's legacy `BackgroundLocation` default export has been removed. The 6 tracking methods (`startTracking`, `stopTracking`, `isTracking`, `getLocations`, `clearTrip`, `updateNotification`) are now published exclusively as top-level **named exports** from `src/index.tsx`. Geofencing methods, hooks, enums, and `GeofenceError` were already named exports and are unaffected.

```typescript
// Before
import BackgroundLocation from '@gabriel-sisjr/react-native-background-location';
await BackgroundLocation.startTracking('trip-123');

// After
import { startTracking } from '@gabriel-sisjr/react-native-background-location';
await startTracking('trip-123');
```

**Why:** tree-shaking, IDE auto-import consistency, and alignment with the rest of the API (geofencing + hooks were already named exports). See the [migration guide](https://gabriel-sisjr.github.io/react-native-background-location/docs/migration/v0-14-0#why-this-changed) for the full rationale.

**Migration:** see [`docs/migration/v0.14.0.md`](https://gabriel-sisjr.github.io/react-native-background-location/docs/migration/v0-14-0) for a codemod, step-by-step, and pitfalls.

# Breaking Changes - v0.12.0

> **Upgrade path:** v0.10.x --> v0.12.0 (v0.11 was internal only, never published to npm)

This release contains 3 breaking changes to the TypeScript types layer. All are compile-time errors -- your existing code will fail to build until migrated, but there are no silent behavioral regressions.

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
