# Troubleshooting

Common issues when integrating `@gabriel-sisjr/react-native-background-location`, organized as **Symptom → Cause → Fix**. If your issue is not listed, check the [Example App](../example/src/App.tsx), the [GitHub issues](https://github.com/gabriel-sisjr/react-native-background-location/issues), and the related guide links at the end of each entry.

> All code samples use **granular named imports**, matching the v0.14.0+ public API.

## Android

### Symptom: Foreground service fails to start within 5-10s on Android 12+

The app crashes with `ForegroundServiceDidNotStartInTimeException` shortly after `startTracking()`.

**Cause.** On Android 12+ (API 31+), a foreground service must call `startForeground()` within ~5-10 seconds of being started, otherwise Android kills the process. This most often happens when the host app takes too long to parse `TrackingOptions` or when the system is under load.

**Fix.**

1. The library already calls `startForeground()` immediately in `onStartCommand()` with a **minimal notification** and then replaces it once `TrackingOptions` are parsed -- you do **not** need to implement this yourself.
2. Make sure you declared the `FOREGROUND_SERVICE` and `FOREGROUND_SERVICE_LOCATION` permissions in `AndroidManifest.xml`. See the [Quick Start Guide](./getting-started/QUICKSTART.md#1-add-permissions).
3. Do **not** block the main thread between `startTracking()` and receiving the first location update -- heavy synchronous JS work delays `onStartCommand()`.
4. If you added custom notification icons/colors, verify the drawables exist and the hex color is valid; a failed resource lookup can silently delay the upgrade to the full notification.

**Related.** [Platform Comparison](./production/PLATFORM_COMPARISON.md), [Google Play Compliance](./production/GOOGLE_PLAY_COMPLIANCE.md).

### Symptom: Duplicate location callbacks after crash recovery

After a process restart you receive two `onLocationUpdate` events per GPS fix, or the `locations` array grows at twice the expected rate.

**Cause.** When `LocationService.onStartCommand()` runs a second time -- via `RecoveryWorker`, `START_REDELIVER_INTENT`, or `onTimeout()` restart -- a new `LocationProvider` subscription is added on top of the existing one.

**Fix.**

1. Both `FusedLocationProvider` and `AndroidLocationProvider` call `removeLocationUpdates()` at the **start** of `requestLocationUpdates()` specifically to prevent this. If you are still seeing duplicates, upgrade to the latest version of the library.
2. If you forked or wrapped the provider, preserve the `removeLocationUpdates()` call at the top of `requestLocationUpdates()`.
3. Verify you are not calling `startTracking()` twice from JS (e.g. from a `useEffect` that fires on every render). `startTracking()` is idempotent on the native side, but stacking JS callers is still a code smell.

**Related.** [Crash Recovery](./production/CRASH_RECOVERY.md), [Realtime Debug Guide](./development/REALTIME_DEBUG_GUIDE.md).

### Symptom: Service restart loop

The foreground service restarts several times in a row, then stops entirely; subsequent `startTracking()` calls appear to do nothing.

**Cause.** `LocationService` ships with a **restart loop detector**: if the service is restarted more than 5 times within a 1-hour window, it refuses further restarts and clears the persisted tracking state. This prevents runaway battery drain when `RecoveryWorker` and `START_REDELIVER_INTENT` cooperate unexpectedly (e.g., after a series of process kills triggered by an OEM battery optimizer).

**Fix.**

1. Wait ~1 hour or reboot the device to reset the restart counter.
2. Check your logs for whatever is actually killing the service (usually an OEM battery optimizer, a `TASK_REMOVED` + stopWithTask interaction, or `SecurityException` on background start). Fix the root cause before retrying.
3. Ensure the user has whitelisted your app in battery optimization settings -- see [Battery Optimization](./production/BATTERY_OPTIMIZATION.md) for vendor-specific flows.
4. Call `stopTracking()` cleanly on app shutdown when possible; `onDestroy` resets the restart counter.

**Related.** [Battery Optimization](./production/BATTERY_OPTIMIZATION.md), [Crash Recovery](./production/CRASH_RECOVERY.md).

## iOS

### Symptom: `Always` permission is never granted

`requestPermissions()` resolves with `location.hasPermission === true`, but the permission stays at `WhenInUse` and background tracking stops as soon as the app is backgrounded.

**Cause.** iOS uses a two-step authorization flow. The system must first grant `WhenInUse`, and only **after a separate call** to `requestAlwaysAuthorization()` will the user see the "Allow Always" prompt. The `LocationPermissionStatus.WHEN_IN_USE` value counts as `hasPermission: true` for foreground tracking, which is why `requestPermissions()` returns `true` even when the escalation has not completed.

**Fix.**

1. Use the `useLocationPermissions` hook -- it handles the full `WhenInUse` -> `Always` escalation automatically on iOS via `requestLocationPermission(foregroundOnly: false)`.
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

**Related.** [iOS Setup Guide](./getting-started/IOS_SETUP.md), [App Store Compliance](./production/APP_STORE_COMPLIANCE.md), [iOS Background Behavior](./production/IOS_BACKGROUND_BEHAVIOR.md).

### Symptom: `didChangeAuthorization` resolves the permission promise prematurely

On iOS the first `requestPermissions()` call returns immediately with a stale status (often `WhenInUse`) before the user has tapped anything in the system prompt.

**Cause.** iOS fires `CLLocationManagerDelegate.didChangeAuthorization(_:)` **synchronously** the moment a delegate is assigned to a `CLLocationManager` -- reporting whatever authorization currently exists. Without a guard, the native wrapper would treat this immediate callback as the user's response and resolve the promise too early.

**Fix.**

1. The library handles this with the `shouldIgnoreNextAuthCallback` flag in `LocationManagerWrapper.swift`: the first delegate callback that arrives right after delegate assignment is discarded. If you are on the latest version, nothing is required.
2. If you extended `LocationManagerWrapper` or instantiated your own `CLLocationManager`, apply the same guard before completing your permission promise.
3. When debugging, log `didChangeAuthorization` invocations in the delegate and confirm the first event after assignment is ignored.

**Related.** [iOS Setup Guide](./getting-started/IOS_SETUP.md).

## Cross-Platform

### Symptom: `Native module is not available` on a simulator or JS-only test

Calling `startTracking()` (or any method) throws `Native module is not available. Make sure the app was rebuilt after installing the package.`

**Cause.** The TurboModule binary is not linked into the current runtime. This happens on bare JS test environments, Jest without mocks, iOS simulators where the pod is missing, or Android emulators without a rebuild after installing the package.

**Fix.**

1. Rebuild the native app after installing the package:
   - iOS: `cd ios && pod install && cd .. && yarn ios`
   - Android: `yarn android` (Gradle picks up the autolinked module)
2. For probing whether the module is available without throwing, use the `isNativeModuleAvailable()` internal helper's pattern: wrap calls in `try`/`catch`. The library's geofencing methods themselves use the throwing variant (`assertNativeModuleAvailable()`) and will raise a clear error.
3. If you see this only in unit tests, mock `react-native`'s `NativeModules` or provide a Jest setup that stubs the module.

```ts
import { isTracking } from '@gabriel-sisjr/react-native-background-location';

try {
  const { active } = await isTracking();
  console.log('Tracking active:', active);
} catch (err) {
  console.warn('Native module not linked -- simulator or JS-only env.', err);
}
```

**Related.** [Integration Guide](./getting-started/INTEGRATION_GUIDE.md), [iOS Setup Guide](./getting-started/IOS_SETUP.md).

### Symptom: Locations seem to be missing after `stopTracking()`

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

**Related.** [Real-Time Updates](./getting-started/REAL_TIME_UPDATES.md), [Implementation Summary](./development/IMPLEMENTATION_SUMMARY.md).

### Symptom: Stale location events arrive after `stopTracking()`

You receive an `onLocationUpdate` a few seconds after calling `stopTracking()`, with coordinates from **before** the stop.

**Cause.** The underlying OS location subsystems (Fused, CLLocationManager) can queue a callback that is already mid-flight when you call `stopTracking()`. The library uses a **stop token** (`SharedPreferences` on Android, `UserDefaults` on iOS) that is written synchronously in the stop sequence; any late callback that arrives while the stop token is set is suppressed before emission.

**Fix.**

1. Make sure you call `stopTracking()` and `await` it -- synchronous persistence of the stop token is the core of the mechanism.
2. If you are seeing late emissions despite stopping, verify that you have only **one** `LocationService` instance and that you are not re-starting tracking in the same turn.
3. The stop token has a 60-second validity window on Android; if you immediately `startTracking()` again, the new session correctly clears the token.
4. Do not disable the stop token check in forks -- dropping late events is intentional, not a bug.

**Related.** [Implementation Summary](./development/IMPLEMENTATION_SUMMARY.md).

### Symptom: Geofence transitions do not fire when tracking is stopped

You added geofences with `addGeofences()`, but `ENTER`/`EXIT` events only arrive while `isTracking()` is `true`.

**Cause.** The system's geofencing services rely on a warm GPS pipeline to detect region crossings. If location tracking is off and no other app is using location, the radio can cool down enough that transitions are delayed by several minutes, or missed entirely for small geofences.

**Fix.**

1. The library runs a **location heartbeat** that keeps the GPS pipeline warm for passive geofence detection when tracking is not active. It auto-starts when geofences exist and tracking is off, and auto-stops when the last geofence is removed. No manual wiring required.
2. Use a minimum radius of ~100 m on Android and ~150 m on iOS. Smaller geofences are unreliable on both platforms regardless of heartbeat.
3. On iOS, `Always` permission is mandatory for background geofence monitoring -- see the "Always permission" entry above.
4. If transitions are delayed, check battery optimizer whitelisting ([Battery Optimization](./production/BATTERY_OPTIMIZATION.md)) -- OEM doze can suppress geofence broadcasts even with a heartbeat.

**Related.** [Geofencing Guide](./getting-started/geofencing.md), [Geofencing Advanced Usage](./geofencing/ADVANCED_USAGE.md), [Battery Optimization](./production/BATTERY_OPTIMIZATION.md).

## Build / Tooling

### Symptom: TurboModule Codegen fails with "Type not supported" or missing spec files

Building the iOS or Android app fails at the Codegen step, complaining about enum types, object arrays, or missing generated headers.

**Cause.** React Native Codegen does not support TypeScript `enum` types or typed object arrays in TurboModule specs. The library's spec uses plain `string` unions and JSON-serialized strings for complex objects specifically to satisfy these constraints. Codegen also requires the **New Architecture** to be enabled in the host app.

**Fix.**

1. Ensure the host app has the New Architecture enabled:
   - iOS: `RCT_NEW_ARCH_ENABLED=1 pod install` (or set `newArchEnabled=true` in `ios/Podfile.properties.json` for Expo).
   - Android: `newArchEnabled=true` in `android/gradle.properties`.
2. Run a clean `pod install` after changing the flag -- Codegen outputs land in `ios/build/generated/ios/` and must be regenerated.
3. Do **not** modify the library's `NativeBackgroundLocation.ts` spec to use TypeScript enums or typed object arrays -- Codegen will reject them. The `toTrackingOptionsSpec()` helper in `src/utils/trackingOptionsMapper.ts` and the JSON serializers in `src/utils/geofenceSerialization.ts` exist precisely to cross the spec boundary safely.
4. If the generated files are stale, run `yarn clean` in the library and `yarn prepare` to regenerate the published artifacts.

**Related.** [iOS Setup Guide](./getting-started/IOS_SETUP.md), [Implementation Summary](./development/IMPLEMENTATION_SUMMARY.md).

## Still Stuck?

1. Re-read the [Quick Start Guide](./getting-started/QUICKSTART.md) and [Integration Guide](./getting-started/INTEGRATION_GUIDE.md) to make sure nothing was skipped.
2. Browse the [Example App](../example/src/App.tsx) for a working reference.
3. Search the [GitHub Issues](https://github.com/gabriel-sisjr/react-native-background-location/issues) -- include full stack traces and the output of `npx react-native info` when filing a new issue.
