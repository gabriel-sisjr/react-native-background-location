---
sidebar_position: 99
title: Troubleshooting
description: Common issues and solutions for @gabriel-sisjr/react-native-background-location. Covers Android, iOS, cross-platform, motion activity, and build/tooling problems with Symptom, Cause, Fix format.
keywords:
  - troubleshooting
  - debugging
  - common-issues
  - android
  - ios
  - foreground-service
  - permissions
  - turbomodule
  - motion-activity
  - react-native
  - background-location
---

# Troubleshooting

Common issues when integrating `@gabriel-sisjr/react-native-background-location`, organized as **Symptom, Cause, Fix**. If your issue is not listed, check the [Example App](https://github.com/gabriel-sisjr/react-native-background-location/tree/main/example), the [GitHub Issues](https://github.com/gabriel-sisjr/react-native-background-location/issues), and the related guide links at the end of each entry.

> All code samples use **granular named imports** from the public API.

---

## Android

### Foreground service fails to start within 5-10s on Android 12+

The app crashes with `ForegroundServiceDidNotStartInTimeException` shortly after `startTracking()`.

**Cause.** On Android 12+ (API 31+), a foreground service must call `startForeground()` within ~5-10 seconds of being started, otherwise Android kills the process. This most often happens when the host app takes too long to parse `TrackingOptions` or when the system is under load.

**Fix.**

1. The library already calls `startForeground()` immediately in `onStartCommand()` with a **minimal notification** and then replaces it once `TrackingOptions` are parsed -- you do **not** need to implement this yourself.
2. Make sure you declared the `FOREGROUND_SERVICE` and `FOREGROUND_SERVICE_LOCATION` permissions in `AndroidManifest.xml`. See the [Quick Start guide](./getting-started/quick-start.md) for permission setup.
3. Do **not** block the main thread between `startTracking()` and receiving the first location update -- heavy synchronous JS work delays `onStartCommand()`.
4. If you added custom notification icons/colors, verify the drawables exist and the hex color is valid; a failed resource lookup can silently delay the upgrade to the full notification.

**Related:** [Platform Comparison](./production/platform-comparison.md)

---

### Duplicate location callbacks after crash recovery

After a process restart you receive two `onLocationUpdate` events per GPS fix, or the `locations` array grows at twice the expected rate.

**Cause.** When `LocationService.onStartCommand()` runs a second time -- via `RecoveryWorker`, `START_REDELIVER_INTENT`, or `onTimeout()` restart -- a new `LocationProvider` subscription is added on top of the existing one.

**Fix.**

1. Both `FusedLocationProvider` and `AndroidLocationProvider` call `removeLocationUpdates()` at the **start** of `requestLocationUpdates()` specifically to prevent this. If you are still seeing duplicates, upgrade to the latest version of the library.
2. If you forked or wrapped the provider, preserve the `removeLocationUpdates()` call at the top of `requestLocationUpdates()`.
3. Verify you are not calling `startTracking()` twice from JS (e.g. from a `useEffect` that fires on every render). `startTracking()` is idempotent on the native side, but stacking JS callers is still a code smell.

**Related:** [Crash Recovery guide](./guides/crash-recovery.md), [Debugging guide](./development/debugging.md)

---

### Service restart loop

The foreground service restarts several times in a row, then stops entirely; subsequent `startTracking()` calls appear to do nothing.

**Cause.** `LocationService` ships with a **restart loop detector**: if the service is restarted more than 5 times within a 1-hour window, it refuses further restarts and clears the persisted tracking state. This prevents runaway battery drain when `RecoveryWorker` and `START_REDELIVER_INTENT` cooperate unexpectedly (e.g., after a series of process kills triggered by an OEM battery optimizer).

**Fix.**

1. Wait ~1 hour or reboot the device to reset the restart counter.
2. Check your logs for whatever is actually killing the service (usually an OEM battery optimizer, a `TASK_REMOVED` + stopWithTask interaction, or `SecurityException` on background start). Fix the root cause before retrying.
3. Ensure the user has whitelisted your app in battery optimization settings -- see [Battery Optimization](./guides/battery-optimization.md) for vendor-specific flows.
4. Call `stopTracking()` cleanly on app shutdown when possible; `onDestroy` resets the restart counter.

**Related:** [Battery Optimization](./guides/battery-optimization.md), [Crash Recovery](./guides/crash-recovery.md)

---

## iOS

### `Always` permission is never granted

`requestPermissions()` resolves with `location.hasPermission === true`, but the permission stays at `WhenInUse` and background tracking stops as soon as the app is backgrounded.

**Cause.** iOS uses a two-step authorization flow. The system must first grant `WhenInUse`, and only **after a separate call** to `requestAlwaysAuthorization()` will the user see the "Allow Always" prompt. The `LocationPermissionStatus.WHEN_IN_USE` value counts as `hasPermission: true` for foreground tracking, which is why `requestPermissions()` returns `true` even when the escalation has not completed.

**Fix.**

1. Use the `useLocationPermissions` hook -- it handles the full `WhenInUse` to `Always` escalation automatically on iOS via `requestLocationPermission(foregroundOnly: false)`.
2. Check `permissionStatus.location.status === LocationPermissionStatus.GRANTED` (not just `hasPermission`) before relying on background tracking.
3. Ensure `NSLocationAlwaysAndWhenInUseUsageDescription` and `NSLocationWhenInUseUsageDescription` are both present in `Info.plist` -- iOS silently rejects the escalation if either string is missing.
4. The user must have approved `WhenInUse` on a prior prompt; iOS will not show the "Always" dialog if permission is currently `.denied`.

```tsx
import {
  useLocationPermissions,
  LocationPermissionStatus,
} from '@gabriel-sisjr/react-native-background-location';

function PermissionGate() {
  const { permissionStatus, requestPermissions } = useLocationPermissions();

  const canTrackInBackground =
    permissionStatus.location.status === LocationPermissionStatus.GRANTED;

  if (!canTrackInBackground) {
    return <Button title="Grant Always" onPress={requestPermissions} />;
  }
  return <TrackingScreen />;
}
```

**Related:** [iOS Setup](./getting-started/ios-setup.md), [Permission Handling](./guides/permission-handling.md)

---

### `didChangeAuthorization` resolves the permission promise prematurely

On iOS the first `requestPermissions()` call returns immediately with a stale status (often `WhenInUse`) before the user has tapped anything in the system prompt.

**Cause.** iOS fires `CLLocationManagerDelegate.didChangeAuthorization(_:)` **synchronously** the moment a delegate is assigned to a `CLLocationManager` -- reporting whatever authorization currently exists. Without a guard, the native wrapper would treat this immediate callback as the user's response and resolve the promise too early.

**Fix.**

1. The library handles this with the `shouldIgnoreNextAuthCallback` flag in `LocationManagerWrapper.swift`: the first delegate callback that arrives right after delegate assignment is discarded. If you are on the latest version, nothing is required.
2. If you extended `LocationManagerWrapper` or instantiated your own `CLLocationManager`, apply the same guard before completing your permission promise.
3. When debugging, log `didChangeAuthorization` invocations in the delegate and confirm the first event after assignment is ignored.

**Related:** [iOS Setup](./getting-started/ios-setup.md)

---

## Cross-Platform

### `Native module is not available` on a simulator or JS-only test

Calling `startTracking()` (or any method) throws `Native module is not available. Make sure the app was rebuilt after installing the package.`

**Cause.** The TurboModule binary is not linked into the current runtime. This happens on bare JS test environments, Jest without mocks, iOS simulators where the pod is missing, or Android emulators without a rebuild after installing the package.

**Fix.**

1. Rebuild the native app after installing the package:
   - iOS: `cd ios && pod install && cd .. && yarn ios`
   - Android: `yarn android` (Gradle picks up the autolinked module)
2. For probing whether the module is available without throwing, wrap calls in `try`/`catch`. The library's geofencing methods use a throwing variant (`assertNativeModuleAvailable()`) and will raise a clear error.
3. If you see this only in unit tests, mock `react-native`'s `NativeModules` or provide a Jest setup that stubs the module. See the [Testing guide](./development/testing.md) for mock patterns.

```ts
import { isTracking } from '@gabriel-sisjr/react-native-background-location';

try {
  const { active } = await isTracking();
  console.log('Tracking active:', active);
} catch (err) {
  console.warn('Native module not linked -- simulator or JS-only env.', err);
}
```

**Related:** [Installation](./getting-started/installation.md), [iOS Setup](./getting-started/ios-setup.md)

---

### Locations seem to be missing after `stopTracking()`

After calling `stopTracking()`, `getLocations(tripId)` returns fewer points than you expected, or the last few points you saw on the live map are gone.

**Cause.** Both platforms use a **batched async write** pipeline to amortize DB I/O: up to 10 locations are buffered in memory and flushed to Room / Core Data whenever the buffer fills **or** a 5-second timer expires. `stopTracking()` force-flushes the buffer before returning, but a crash during shutdown could lose in-flight points.

**Fix.**

1. Always `await` `stopTracking()` before reading with `getLocations()` -- the stop sequence flushes pending writes synchronously.
2. If you rely on real-time points from `useLocationUpdates`, call its exposed `refreshLocations()` after `stopTracking()` returns to re-hydrate from the DB.
3. When in doubt, re-read from the DB -- the NativeEventEmitter stream is authoritative for UI but the DB is the persistence ground truth.

```ts
import {
  stopTracking,
  getLocations,
} from '@gabriel-sisjr/react-native-background-location';

await stopTracking();
const points = await getLocations(tripId); // DB is flushed by this point
```

**Related:** [Real-Time Updates](./guides/real-time-updates.md)

---

### Stale location events arrive after `stopTracking()`

You receive an `onLocationUpdate` a few seconds after calling `stopTracking()`, with coordinates from **before** the stop.

**Cause.** The underlying OS location subsystems (Fused, CLLocationManager) can queue a callback that is already mid-flight when you call `stopTracking()`. The library uses a **stop token** (`SharedPreferences` on Android, `UserDefaults` on iOS) that is written synchronously in the stop sequence; any late callback that arrives while the stop token is set is suppressed before emission.

**Fix.**

1. Make sure you call `stopTracking()` and `await` it -- synchronous persistence of the stop token is the core of the mechanism.
2. If you are seeing late emissions despite stopping, verify that you have only **one** `LocationService` instance and that you are not re-starting tracking in the same turn.
3. The stop token has a 60-second validity window on Android; if you immediately `startTracking()` again, the new session correctly clears the token.
4. Do not disable the stop token check in forks -- dropping late events is intentional, not a bug.

---

### Geofence transitions do not fire when tracking is stopped

You added geofences with `addGeofences()`, but `ENTER`/`EXIT` events only arrive while `isTracking()` is `true`.

**Cause.** The system's geofencing services rely on a warm GPS pipeline to detect region crossings. If location tracking is off and no other app is using location, the radio can cool down enough that transitions are delayed by several minutes, or missed entirely for small geofences.

**Fix.**

1. The library runs a **location heartbeat** that keeps the GPS pipeline warm for passive geofence detection when tracking is not active. It auto-starts when geofences exist and tracking is off, and auto-stops when the last geofence is removed. No manual wiring required.
2. Use a minimum radius of ~100 m on Android and ~150 m on iOS. Smaller geofences are unreliable on both platforms regardless of heartbeat.
3. On iOS, `Always` permission is mandatory for background geofence monitoring -- see the "Always permission" entry above.
4. If transitions are delayed, check battery optimizer whitelisting ([Battery Optimization](./guides/battery-optimization.md)) -- OEM doze can suppress geofence broadcasts even with a heartbeat.

**Related:** [Geofencing](./guides/geofencing.md), [Geofencing Advanced](./guides/geofencing-advanced.md), [Battery Optimization](./guides/battery-optimization.md)

---

## Motion Activity

### `MOTION_ACTIVITY_UNAVAILABLE` warning after `startTracking()`

`startTracking()` resolves and locations keep arriving, but `onLocationWarning` reports `MOTION_ACTIVITY_UNAVAILABLE`, no `onMotionActivity` events arrive and updates are never reduced while stationary.

**Cause.** Motion activity cannot run on this device or build. `startTracking()` never throws or rejects because of motion activity: the trip tracks at full accuracy without it. A session emits at most one detection warning (`MOTION_ACTIVITY_UNAVAILABLE` or `MOTION_PERMISSION_NOT_GRANTED`), and the first failing check wins. iOS runs its checks in this order: compile flag, `NSMotionUsageDescription`, motion hardware, authorization -- so fixing one cause can reveal the next one on the following trip. On iOS the warning arrives just after `startTracking()` resolves, so register `onLocationWarning` before starting the trip.

**Fix.** Match the warning `message`:

1. **Android** -- `Motion activity needs Google Play services, which is not available. Location tracking continues at full accuracy.`

   Motion activity uses the Google Play services Activity Recognition API and has no fallback. On a device without Google Play services, trips always track at full accuracy; test motion activity on a device that has Google Play services.

2. **Android** -- `Motion activity could not start (<detail>). Location tracking continues at full accuracy.`

   Registering with Activity Recognition failed. The detail is `status <code>` or the exception class name. Make sure Google Play services is up to date, then stop and start tracking to try again.

   With the detail `AlarmManager`, the system refused to schedule one of the reduction timers during the trip. The session then stopped motion detection (after `MOTION_LOCATION_RESTORED` if updates were reduced) and continues at full accuracy; the next tracking start tries again.

3. **iOS** -- `Motion activity is not compiled into this app. Set $BackgroundLocationMotionActivity = true in the Podfile (or add the motionActivity plugin prop) and reinstall pods. Location tracking continues at full accuracy.`

   The CoreMotion code is compiled in only on request. Add the flag before the first `target` in `ios/Podfile` and run `pod install`, or add the `motionActivity` prop to the Expo config plugin and run prebuild; then rebuild the app. If the flag is already set, see the Podfile flag entry below.

4. **iOS** -- `NSMotionUsageDescription is missing from Info.plist. Location tracking continues at full accuracy.`

   Add a non-blank `NSMotionUsageDescription` to `Info.plist`. With Expo, the `motionActivity` plugin prop adds it; set `motionActivity.usageDescription` to choose the text.

5. **iOS** -- `Motion activity is not available on this device. Location tracking continues at full accuracy.`

   The device has no motion activity hardware. There is nothing to fix in the app: trips on that device track at full accuracy.

**Related:** [Motion Activity Setup](./guides/motion-activity.md#setup), [Motion Activity Warnings](./guides/motion-activity.md#warnings)

---

### `MOTION_PERMISSION_NOT_GRANTED` warning

`onLocationWarning` reports `MOTION_PERMISSION_NOT_GRANTED` when a trip starts, or during a trip after the permission is revoked, and motion activity stays off for that session.

**Cause.** The motion activity permission is missing, denied or was revoked. `startTracking()` never prompts for it and never fails because of it: the trip tracks at full accuracy. A permission granted during a trip takes effect at the next tracking start. If the permission is revoked while updates are reduced, `MOTION_LOCATION_RESTORED` (`Motion activity stopped; full-accuracy location updates restored.`) arrives first, then this warning.

**Fix.** Match the warning `message`:

1. **Android 10+ (API 29+)** -- `ACTIVITY_RECOGNITION permission is not granted. Call requestMotionPermission() before startTracking(). Location tracking continues at full accuracy.`

   Declare `android.permission.ACTIVITY_RECOGNITION` in your app's `AndroidManifest.xml` (the library manifest declares no activity-recognition permission) and call `requestMotionPermission()` before `startTracking()`. The same warning appears when the permission is not declared.

2. **Android 9 and lower (API 28 and lower)** -- `com.google.android.gms.permission.ACTIVITY_RECOGNITION is not declared in AndroidManifest.xml. Location tracking continues at full accuracy.`

   Declare the Google Play services permission with `android:maxSdkVersion="28"`, as shown below. It is granted at install time.

3. **iOS** -- `Motion & Fitness permission has not been requested. Call requestMotionPermission() before startTracking(). Location tracking continues at full accuracy.`

   Call `requestMotionPermission()` with the app in the foreground before `startTracking()`.

4. **iOS** -- `Motion & Fitness permission is denied. Location tracking continues at full accuracy.`

   Motion & Fitness is denied or restricted for the app. `requestMotionPermission()` cannot prompt again; ask the user to allow it in Settings.

5. **Android and iOS** -- `Motion activity permission was revoked. Location tracking continues at full accuracy.`

   The permission was revoked during the trip (iOS re-checks it when the app becomes active, at each `maxReducedDuration` timer, and when a timer fires while a stationary period is being confirmed). Ask the user to grant it again; it applies from the next tracking start.

```xml
<uses-permission android:name="android.permission.ACTIVITY_RECOGNITION" />
<uses-permission
    android:name="com.google.android.gms.permission.ACTIVITY_RECOGNITION"
    android:maxSdkVersion="28" />
```

**Related:** [Requesting the Permission](./guides/motion-activity.md#requesting-the-permission), [Android Setup](./guides/motion-activity.md#android-setup)

---

### No `onMotionActivity` events

`useMotionActivity()` keeps `lastActivity` at `null`, or a listener registered with `addMotionActivityListener()` is never called.

**Cause.** Events are emitted only while a tracking session with motion activity enabled is active, and only after detection has started. Detection does not start when the option is off (`motionActivity` absent, `false`, `null`, or neither a boolean nor an object), when the permission is not granted, when Google Play services is not available (Android), when CoreMotion is not compiled in or `NSMotionUsageDescription` is missing (iOS), or on a device without motion hardware (iOS).

**Fix.**

1. Read the session state with `getMotionActivityState()` (or `detection` from `useMotionActivity()`):
   - `OFF` -- no tracking session with motion activity enabled. Pass `motionActivity: true` (or an options object) to `startTracking()`; in `__DEV__`, a malformed value logs a `[BackgroundLocation]` console warning.
   - `PERMISSION_NOT_GRANTED` -- request the permission before starting the trip (see the entry above).
   - `UNAVAILABLE` -- detection could not start; the `MOTION_ACTIVITY_UNAVAILABLE` warning names the cause (see the first entry of this section).
   - `RUNNING` -- detection works; check the next steps.
2. Events are de-duplicated: a detection with the same `activity` and `confidence` as the previous event is not emitted again, so a device that keeps the same state produces only the first event. On Android, samples arrive every `sampleInterval` (default 30 seconds).
3. `useMotionActivity({ tripId })` ignores events of other trips. Omit `tripId` to receive the events of any trip.
4. Nothing is emitted after `stopTracking()`; subscribe while the trip runs.

```ts
import {
  getMotionActivityState,
  MotionDetectionStatus,
} from '@gabriel-sisjr/react-native-background-location';

const state = await getMotionActivityState();
if (state.detection !== MotionDetectionStatus.RUNNING) {
  console.log('Motion detection:', state.detection, 'trip:', state.tripId);
}
```

**Related:** [Detecting Motion Activity](./guides/motion-activity.md#detecting-motion-activity), [`useMotionActivity`](./api-reference/hooks/useMotionActivity.md), [Motion Activity Functions](./api-reference/functions.md#motion-activity-functions)

---

### `useMotionActivity` shows the previous status after starting or stopping a trip

After `stopTracking()`, `useMotionActivity()` still reports `detection: RUNNING` or `reduction: REDUCED`. Or, right after `startTracking()`, a screen that was already mounted still shows `detection: OFF`.

**Cause.** The hook reads the native state on its triggers: mount, a `tripId` change, the app becoming active, every `MOTION_*` warning, and the first event of a new session. A successful start emits no warning, so the hook reads the new session when its first event arrives. A stop emits no event and no warning at all.

**Fix.**

1. Call the hook's `refresh()` after `stopTracking()`.
2. After `startTracking()`, the first event (or a detection warning) updates the hook. On Android, a `refresh()` made right after `startTracking()` can still read the previous state, because the foreground service starts the session shortly after `startTracking()` resolves.
3. If the console shows `[BackgroundLocation] motion activity is not available in this native build; rebuild the app to use it.`, the JavaScript bundle is newer than the app's native code: rebuild the app.

```tsx
const { refresh } = useMotionActivity({ tripId });

async function stopTrip() {
  await stopTracking();
  await refresh(); // a stop emits no event or warning
}
```

**Related:** [`useMotionActivity`: after `startTracking()` and `stopTracking()`](./api-reference/hooks/useMotionActivity.md#after-starttracking-and-stoptracking)

---

### The stationary reduction never happens

The device stays parked, but no `MOTION_LOCATION_REDUCED` warning arrives and location updates keep their full rate.

**Cause.** The reduction applies only when motion detection runs, `reduceWhenStationary` is requested, the trip is not `foregroundOnly` and its accuracy is not `PASSIVE` or `NO_POWER`. Even then it waits for evidence: it never starts during the first `automotiveCooldown` (default 10 minutes) of a session, every piece of vehicle evidence restarts that cooldown, the device must report a high-confidence stationary state continuously for `stationaryDelay` (default 5 minutes), and the session needs a recorded full-accuracy fix to use as its anchor.

**Fix.**

1. Read `reduction` from `getMotionActivityState()` or `useMotionActivity()`:
   - `DISABLED` -- the reduction was not requested, or there is no session. Set `motionActivity.reduceWhenStationary`. A malformed value also turns it off; in `__DEV__` the console warning ends with `reduceWhenStationary is disabled.`
   - `NOT_APPLICABLE` -- the trip is `foregroundOnly` or uses `PASSIVE` or `NO_POWER` accuracy. The reduction never applies to these trips.
   - `UNAVAILABLE` -- detection did not start or was lost. See the detection warnings above.
   - `MONITORING` -- the reduction is waiting for the conditions below.
2. Wait out the first `automotiveCooldown` of the session. It also applies after crash recovery and service restarts. On Android the timers are inexact alarms that can fire up to about 75% later than configured, so with the defaults allow up to about 17.5 minutes.
3. Vehicle evidence (such as an `AUTOMOTIVE` detection) restarts the cooldown, so red lights and stop-and-go traffic do not reduce updates.
4. A medium- or low-confidence stationary detection, any movement detection, or a recorded fix that moved away from the anchor breaks the `stationaryDelay` period, which then starts over.
5. Without a recorded full-accuracy fix (for example, indoors with no GPS fix), there is no anchor and the reduction cannot start.
6. For testing only, shorten the waits to their minimums. The defaults are the [recommended settings](./guides/motion-activity.md#recommended-settings).

```ts
await startTracking('trip-1', {
  motionActivity: {
    reduceWhenStationary: {
      stationaryDelay: 60000, // minimum: 1 minute
      automotiveCooldown: 120000, // minimum: 2 minutes
    },
  },
});
```

**Related:** [How the Reduction Works](./guides/motion-activity.md#how-the-reduction-works), [`MotionReductionStatus`](./api-reference/enums.md#motionreductionstatus)

---

### Fewer location points while parked

While the device is stationary, `onLocationUpdate` and `getLocations()` show only a few points (with the defaults, about one every 30 minutes).

**Cause.** This is expected while updates are reduced (`reduction` is `REDUCED`, announced by `MOTION_LOCATION_REDUCED`). The low-power keep-alive fixes are never stored or emitted. Once per `maxReducedDuration` (default 30 minutes) the library requests a full-accuracy fix for up to 120 seconds and records it when its accuracy is 100 m or better and the device has not moved; if no such fix arrives, nothing is recorded for that period. On Android the timers are inexact alarms: outside Doze they can fire up to about 75% later than configured (with the defaults, the forced fix can come up to about 52.5 minutes after the previous one), and in Doze allow-while-idle alarms fire at most once every 9 minutes per app, so the forced fix can be delayed further. On iOS the forced-fix timer follows wall-clock time.

**Fix.**

1. Nothing to fix while the device stays parked: full accuracy returns, with `MOTION_LOCATION_RESTORED`, as soon as movement, a vehicle or a displacement is detected.
2. To record more points while stationary, lower `maxReducedDuration` (minimum 5 minutes) or leave `reduceWhenStationary` off.
3. On Android, do not rely on the forced fix arriving on schedule while the device is idle. The motion classifier, not the timer, is the main way back to full accuracy.
4. `LOCATION_UNAVAILABLE` is not reported while updates are reduced, because it would describe the keep-alive request rather than the trip. During the periodic full-accuracy probe it is reported normally.

**Related:** [Risk Profile](./guides/motion-activity.md#risk-profile), [How the Reduction Works](./guides/motion-activity.md#how-the-reduction-works)

---

### Android notification text is in English while updates are reduced

While updates are reduced, the foreground service notification shows `Location updates reduced while stationary` instead of your text.

**Cause.** While reduced, the notification content text switches to `reduceWhenStationary.notificationText`, which defaults to the English text `'Location updates reduced while stationary'`. The title, icon, actions and channel do not change, and the base text returns when full accuracy is restored.

**Fix.**

1. Pass your own (localized) `notificationText` in the trip options, as shown below.
2. A blank `notificationText` is ignored silently, and a value that is not a string is ignored with a `__DEV__` warning; both keep the default text.
3. Calling `updateNotification(title, text)` while reduced changes the title immediately; the new text is stored and shown when full accuracy is restored.

```ts
await startTracking('trip-1', {
  motionActivity: {
    reduceWhenStationary: {
      notificationText: 'Localização reduzida enquanto parado',
    },
  },
});
```

**Related:** [Android Notification Text](./guides/motion-activity.md#android-notification-text), [Notification Customization](./guides/notification-customization.md)

---

### TypeScript error in an exhaustive `switch` over `LocationWarningType` after upgrading

After upgrading to 1.2.0, type checking fails in a warning handler: an exhaustiveness check such as `const unreachable: never = warning.type` reports that a type like `'MOTION_LOCATION_REDUCED'` is not assignable to `never`, or a function that returns from every `case` reports a missing return value.

**Cause.** 1.2.0 widened the `LocationWarningType` union from 3 to 11 members: the iOS warnings `LOCATION_UPDATES_PAUSED`, `LOCATION_UPDATES_RESUMED`, `PERMISSION_REVOKED` and `PERMISSION_DOWNGRADED` (emitted before, now typed) and the four `MOTION_*` warnings. More members can be added in minor releases.

**Fix.**

1. Replace the `never` assertion with a `default` branch that handles unknown types.
2. Handle the new types explicitly only where your app needs them.

```ts
import type { LocationWarningEvent } from '@gabriel-sisjr/react-native-background-location';

function handleWarning(warning: LocationWarningEvent) {
  switch (warning.type) {
    case 'LOCATION_UNAVAILABLE':
      console.warn('GPS signal lost');
      break;
    case 'MOTION_PERMISSION_NOT_GRANTED':
      console.warn('Motion activity is off for this trip:', warning.message);
      break;
    default:
      // Types added in later minor releases land here
      console.log(`[${warning.type}] ${warning.message}`);
  }
}
```

**Related:** [Warning Types](./guides/real-time-updates.md#warning-types), [`useLocationUpdates`](./api-reference/hooks/useLocationUpdates.md)

---

### Expo: CoreMotion is still compiled in after removing the `motionActivity` prop

You removed `motionActivity` from the config plugin props, but the iOS app still compiles CoreMotion and the Podfile still sets `$BackgroundLocationMotionActivity = true`.

**Cause.** The config plugin adds the Podfile flag (idempotently) but never removes it. A regular `npx expo prebuild` reuses the existing native directories, so the flag stays, and so do the activity-recognition permissions and the `NSMotionUsageDescription` the prop added. The app then still declares `ACTIVITY_RECOGNITION`, which Google Play treats as health-related sensitive data.

**Fix.**

1. Regenerate the native projects with `npx expo prebuild --clean`. It deletes and recreates the `ios` and `android` directories, so manual native changes are lost.
2. Rebuild the app. Without the prop, the prebuild output has no Podfile flag, no `NSMotionUsageDescription` and no activity-recognition permissions from the plugin.

```sh
npx expo prebuild --clean
```

**Related:** [Expo Setup](./guides/motion-activity.md#expo-setup), [Expo Config Plugin](./guides/expo-config-plugin.md)

---

### Podfile flag `$BackgroundLocationMotionActivity` is ignored

The Podfile sets the flag, but trips still report `Motion activity is not compiled into this app.` and `checkMotionPermission()` resolves `UNAVAILABLE`.

**Cause.** The podspec compiles CoreMotion in only when the Podfile sets `$BackgroundLocationMotionActivity = true` before its first `target` block, and only the literal value `true` counts. The change reaches the app only after `pod install` and a rebuild.

**Fix.**

1. Move the line above the first `target` in `ios/Podfile`.
2. Write exactly `$BackgroundLocationMotionActivity = true`. The podspec compares the value with `true`, so values such as `'true'` or `1` are ignored.
3. Run `pod install` in the `ios` directory, then rebuild the app.
4. In an Expo project, use the `motionActivity` plugin prop instead of editing the Podfile by hand; the plugin inserts the line before the first `target`.

```ruby
# ios/Podfile
$BackgroundLocationMotionActivity = true

target 'MyApp' do
  # ...
end
```

**Related:** [iOS Setup](./guides/motion-activity.md#ios-setup), [Expo Setup](./guides/motion-activity.md#expo-setup)

---

## Build / Tooling

### TurboModule Codegen fails with "Type not supported" or missing spec files

Building the iOS or Android app fails at the Codegen step, complaining about enum types, object arrays, or missing generated headers.

**Cause.** React Native Codegen does not support TypeScript `enum` types or typed object arrays in TurboModule specs. The library's spec uses plain `string` unions and JSON-serialized strings for complex objects specifically to satisfy these constraints. Codegen also requires the **New Architecture** to be enabled in the host app.

**Fix.**

1. Ensure the host app has the New Architecture enabled:
   - Bare React Native -- iOS: `RCT_NEW_ARCH_ENABLED=1 pod install`; Android: `newArchEnabled=true` in `android/gradle.properties`
   - Expo -- it is on by default in SDK 54 and cannot be disabled in SDK 55 and later. Remove `newArchEnabled: false` from your Expo config (top level or under `ios` / `android`, and the `expo-build-properties` options) and run `npx expo prebuild --clean`; the config plugin stops the prebuild (and any other Expo command that loads your config) while the New Architecture is disabled ([`NEW_ARCHITECTURE_DISABLED`](./guides/expo-config-plugin.md#new_architecture_disabled))
2. Run a clean `pod install` after changing the flag -- Codegen outputs land in `ios/build/generated/ios/` and must be regenerated.
3. Do **not** modify the library's `NativeBackgroundLocation.ts` spec to use TypeScript enums or typed object arrays -- Codegen will reject them.
4. If the generated files are stale, run `yarn clean` in the library and `yarn prepare` to regenerate the published artifacts.

**Related:** [iOS Setup](./getting-started/ios-setup.md)

---

### Xcode reports that the Pods project is damaged after upgrading

After upgrading the library and running `pod install`, Xcode reports that the `Pods` project is damaged and cannot open it, or the iOS build fails while reading `Pods.xcodeproj`.

**Cause.** The app's Podfile has a `post_install` hook that adds objects to the Pods project after CocoaPods generated it, for example the MapLibre hook that adds its Swift package. React Native's `prepare_react_native_project!` turns off CocoaPods' deterministic UUIDs (`install! 'cocoapods', :deterministic_uuids => false`), and in that mode an identifier generated for an object added in `post_install` may collide with one already in the project. A change in the number of files in the pods, such as the motion activity sources that 1.2.0 adds to every build (CoreMotion itself stays behind the Podfile flag), may be enough to turn a setup that worked before into a failing one.

**Fix.** Use one of these options, then run `pod install` again:

1. Skip identifiers that are already in use, as the example app's `example/ios/Podfile` does. Define the override first in `post_install`, before any hook that adds objects:

   ```ruby
   post_install do |installer|
     # React Native turns deterministic UUIDs off: skip UUIDs already in use
     if (pods_project = installer.pods_project)
       def pods_project.generate_uuid
         uuid = super
         uuid = super while objects_by_uuid.key?(uuid)
         uuid
       end
     end

     react_native_post_install(installer, config[:reactNativePath], :mac_catalyst_enabled => false)
     # Hooks that add objects (for example MapLibre's) run after the override
   end
   ```

2. Turn deterministic UUIDs back on, at the top level of the Podfile and after `prepare_react_native_project!`. A later `install!` call replaces the options React Native set, so repeat the one you want to keep. React Native turns deterministic UUIDs off to avoid duplicated GUID errors, so check that the project still builds:

   ```ruby
   prepare_react_native_project!
   install! 'cocoapods', :deterministic_uuids => true, :warn_for_unused_master_specs_repo => false
   ```

**Related:** [iOS Setup Troubleshooting](./getting-started/ios-setup.md#troubleshooting)

---

## Still Stuck?

1. Re-read the [Quick Start](./getting-started/quick-start.md) and [Installation](./getting-started/installation.md) guides to make sure nothing was skipped.
2. Browse the [Example App](https://github.com/gabriel-sisjr/react-native-background-location/tree/main/example) for a working reference.
3. Search the [GitHub Issues](https://github.com/gabriel-sisjr/react-native-background-location/issues) -- include full stack traces and the output of `npx react-native info` when filing a new issue.
