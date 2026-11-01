---
sidebar_position: 4
title: iOS Background Behavior
description: Deep dive into iOS background location behavior — CLLocationManager allowsBackgroundLocationUpdates, significant location monitoring, app suspension vs termination, foregroundOnly mode, accuracy in background, and crash recovery.
keywords:
  - ios
  - background location
  - CLLocationManager
  - allowsBackgroundLocationUpdates
  - significant location monitoring
  - app suspension
  - app termination
  - crash recovery
  - foregroundOnly
  - blue status bar
---

# iOS Background Behavior

This document explains how iOS handles background location tracking, how it differs from Android, and what to expect in production. Understanding these behaviors is critical for building reliable tracking features on iOS.

## How iOS Background Location Works

Unlike Android, iOS does not use a foreground service model. Instead, iOS has a dedicated background location entitlement managed by `CLLocationManager`. When configured correctly, iOS keeps your app alive in the background specifically to receive location updates.

### Key Differences from Android

| Aspect | Android | iOS |
|---|---|---|
| Background mechanism | Foreground Service (user-visible notification) | Background Location Updates (blue indicator bar) |
| User indicator | Persistent notification in notification shade | Blue status bar / Dynamic Island pill |
| System kill protection | Service has elevated priority | Location entitlement keeps app alive |
| Crash recovery | WorkManager schedules restart | Significant location monitoring re-launches app |
| OS resource management | Doze mode, App Standby buckets | App suspension, termination under memory pressure |

## CLLocationManager Background Modes

The library uses two `CLLocationManager` modes depending on configuration.

### Standard Location Updates

Used for `HIGH_ACCURACY`, `BALANCED_POWER_ACCURACY`, and `LOW_POWER` accuracy levels.

- Continuous stream of location updates
- Configurable accuracy via `desiredAccuracy`
- Distance filter support via `distanceFilter`
- Works in background when `allowsBackgroundLocationUpdates = true`
- Activity type defaults to `.other` and is configurable via `TrackingOptions.activityType` (see [`LocationActivityType`](../api-reference/enums.md#locationactivitytype))

```text
App starts tracking
    |
    v
CLLocationManager.startUpdatingLocation()
    |
    v
didUpdateLocations: called continuously
    |
    v
Locations saved to Core Data + emitted to JS
```

### Significant Location Changes

Used for `PASSIVE` and `NO_POWER` accuracy levels, and as a crash recovery mechanism for all accuracy levels.

- Coarse updates triggered by cell tower changes (typically 500m+ movement)
- Very low power consumption
- Can re-launch a terminated app
- Used as the crash recovery wake-up mechanism

```text
App is terminated by iOS
    |
    v
Significant location change detected
    |
    v
iOS re-launches app in background
    |
    v
RecoveryManager.attemptRecoveryIfNeeded()
    |
    v
Standard location tracking resumes
```

## App Lifecycle States and Location Behavior

### Active (Foreground)

- All location modes work normally
- Full accuracy available
- No restrictions on update frequency
- Blue indicator bar is not shown (app is visible)

### Background (Backgrounded)

- Location updates continue if `allowsBackgroundLocationUpdates = true`
- Blue status bar indicator appears (or Dynamic Island pill on iPhone 14 Pro+)
- iOS may reduce update frequency to save battery
- `activityType` influences how iOS optimizes updates

### Suspended

- iOS suspends the app to free memory
- If background location is enabled and updates are running, the app is **not** suspended -- it stays in "Background" state, with either "Always" or "When In Use" permission
- If background location updates are not running (for example with `foregroundOnly: true`), the app **will** be suspended after approximately 10 seconds
- No code executes while suspended

### Terminated

- iOS terminates the app under memory pressure or user force-quit
- Standard location updates stop immediately
- Significant location monitoring can re-launch the app
- The library's `RecoveryManager` handles re-launch recovery

### Lifecycle Summary

```text
                    allowsBackgroundLocationUpdates = true
                    + Always permission
                    |
    Active -------> Background (stays alive, blue bar)
                    |
                    +-- Significant Location registered
                    |   (crash recovery wake-up)
                    |
                    +-- If terminated by OS:
                        Significant Location re-launches app
                        RecoveryManager resumes tracking

                    foregroundOnly = true
                    |
    Active -------> Background -------> Suspended (~10s)
                    |                   (no location updates)
                    |
                    +-- locationManager.stopUpdatingLocation()
                        called by pauseTrackingForBackground()
```

## foregroundOnly Mode on iOS

When `foregroundOnly: true` is set in tracking options:

- `allowsBackgroundLocationUpdates` is set to `false`
- `showsBackgroundLocationIndicator` is set to `false`
- No blue status bar indicator
- No significant location monitoring (no crash recovery)
- Tracking automatically pauses when app enters background
- Tracking automatically resumes when app returns to foreground

The library handles this via `pauseTrackingForBackground()` and `resumeTrackingFromBackground()` which are called from the native module's app lifecycle observers.

```typescript
import {
  startTracking,
  LocationAccuracy,
} from '@gabriel-sisjr/react-native-background-location';

// Foreground-only tracking
const tripId = await startTracking({
  foregroundOnly: true,
  accuracy: LocationAccuracy.HIGH_ACCURACY,
});
// Tracking will pause when app is backgrounded
// and resume when app returns to foreground
```

## Battery Optimization

### pausesLocationUpdatesAutomatically and auto-resume

The library sets `pausesLocationUpdatesAutomatically = false` to ensure continuous tracking. When this property is `true` (the default), iOS may pause location updates when it determines the user has stopped moving. Setting it to `false` reduces — but does not eliminate — system-initiated pauses, since iOS may still pause when its motion classifier decides the configured `activityType` disagrees with observed motion.

When iOS pauses updates, the library emits a `LOCATION_UPDATES_PAUSED` warning event for observability, then automatically resumes location updates if all of the following hold (`didPauseLocationUpdates` in `ios/LocationManagerWrapper.swift`):

- `_isTracking == true`
- `_currentOptions?.isForegroundOnly == false`
- `locationManager != nil`

If updates resume on their own (without the auto-resume call), the library also emits a `LOCATION_UPDATES_RESUMED` event.

These two warnings describe the system pause only. The opt-in motion reduction never emits them; it reports `MOTION_LOCATION_REDUCED` and `MOTION_LOCATION_RESTORED` instead (see [Motion Activity on iOS](#motion-activity-on-ios)).

```typescript
import { useLocationUpdates } from '@gabriel-sisjr/react-native-background-location';

function TrackingScreen() {
  useLocationUpdates({
    onLocationWarning: (warning) => {
      if (warning.type === 'LOCATION_UPDATES_PAUSED') {
        console.log('iOS paused location updates; library will auto-resume.');
      }
      if (warning.type === 'LOCATION_UPDATES_RESUMED') {
        console.log('iOS resumed location updates');
      }
    },
  });
}
```

### activityType

The library exposes the iOS `CLLocationManager.activityType` via the optional `TrackingOptions.activityType` field, typed by the [`LocationActivityType`](../api-reference/enums.md#locationactivitytype) enum. The default is `LocationActivityType.OTHER` (`CLActivityType.other`), which is stationary-friendly: iOS will not aggressively pause updates for inactivity.

Pass `LocationActivityType.AUTOMOTIVE_NAVIGATION` for vehicle navigation. This tells iOS the app is tracking driving, which:

- Optimizes location updates for driving scenarios
- Keeps GPS active during highway driving
- Applies dead reckoning when GPS signal is temporarily lost
- May cause iOS to pause updates approximately 2–3 minutes after the device becomes stationary (e.g. a parked car). When this happens during an active background trip, the library auto-resumes updates as described above.

```typescript
import { startTracking, LocationActivityType } from '@gabriel-sisjr/react-native-background-location';

await startTracking({
  accuracy: LocationAccuracy.HIGH_ACCURACY,
  activityType: LocationActivityType.AUTOMOTIVE_NAVIGATION,
});
```

### Distance Filter Defaults

When no explicit `distanceFilter` is provided, the library applies accuracy-based defaults:

| Accuracy | Default Distance Filter |
|---|---|
| `HIGH_ACCURACY` | None (all updates) |
| `BALANCED_POWER_ACCURACY` | 50 meters |
| `LOW_POWER` | 200 meters |
| `NO_POWER` / `PASSIVE` | None (significant changes only) |

Setting a distance filter reduces battery consumption by ignoring small movements.

## Motion Activity on iOS

Motion activity (`TrackingOptions.motionActivity`) is opt-in and off by default. It is unrelated to the `activityType` setting described above: `activityType` is only a hint for `CLLocationManager`, while motion activity reads CoreMotion to report what the device is doing ([`MotionActivityType`](../api-reference/enums.md#motionactivitytype)) and can reduce location updates while the device is stationary. See the [Motion Activity guide](../guides/motion-activity.md) for setup and the full behavior.

### Compile-Time Opt-In

The library's CoreMotion code is compiled only when your `ios/Podfile` sets this flag before the first `target`, followed by `pod install`:

```ruby
$BackgroundLocationMotionActivity = true
```

With Expo, the config plugin prop `motionActivity` adds the line for you (see [Expo Setup](../guides/motion-activity.md#expo-setup)). With the flag on, add `NSMotionUsageDescription` to `Info.plist`. Without the flag no CoreMotion code is compiled or linked: enabling `motionActivity` in JavaScript then emits a `MOTION_ACTIVITY_UNAVAILABLE` warning, the motion permission functions resolve `UNAVAILABLE`, and tracking continues at full accuracy.

### The Reduction Keeps the App Running

With `reduceWhenStationary` enabled, a confirmed stationary period degrades the location request instead of stopping it:

- `desiredAccuracy` becomes `kCLLocationAccuracyThreeKilometers` and `distanceFilter` becomes 500 meters.
- Standard location updates keep running and `allowsBackgroundLocationUpdates` is unchanged, so the app is not suspended, CoreMotion keeps delivering activity updates, and the blue location indicator stays visible.
- Keep-alive fixes received while reduced are not stored or emitted; they only feed a displacement check. A keep-alive fix restores full accuracy only when it is farther from the anchor than the sum of both accuracies (at least 100 m), where the anchor's accuracy includes the distance filter the trip runs with: with the 3 km accuracy setting that is roughly the anchor's accuracy plus 1-3 km (less when iOS supplies Wi-Fi-based fixes), and the 500 m distance filter also holds deliveries back until iOS estimates about 500 m of movement. The CoreMotion classifier is therefore the primary restore path, displacement is the safety net, and the forced full-accuracy probe every `maxReducedDuration` is the backstop.
- `LOCATION_UNAVAILABLE` is not reported while reduced (`didFailWithError` with any error other than `.denied`), because it would describe the keep-alive request, not the trip. During the periodic full-accuracy probe the trip's own profile runs, and errors are reported normally.
- On restore, the trip's own accuracy and distance filter return and `MOTION_LOCATION_RESTORED` is emitted.
- Region monitoring is run by the system and is not changed by the reduction.

This works with both "Always" and "When In Use" authorization, as long as background location updates run for the trip. The reduction does not apply to `foregroundOnly` trips or to `PASSIVE` and `NO_POWER` accuracy (the [`MotionReductionStatus`](../api-reference/enums.md#motionreductionstatus) is then `NOT_APPLICABLE`); `onMotionActivity` events keep flowing.

### System Pause vs Motion Reduction

| Aspect | System pause | Motion reduction |
|---|---|---|
| Decided by | iOS | The library, from CoreMotion activity |
| Location updates | Paused; the library auto-resumes trips that are not `foregroundOnly` | Degraded to the reduced profile, never stopped |
| Warnings | `LOCATION_UPDATES_PAUSED`, `LOCATION_UPDATES_RESUMED` | `MOTION_LOCATION_REDUCED`, `MOTION_LOCATION_RESTORED` |

Because the reduction never emits `LOCATION_UPDATES_PAUSED` or `LOCATION_UPDATES_RESUMED`, `onLocationWarning` can tell the two apart.

### Reduction Timers

The stationary delay, vehicle cooldown, maximum reduced duration and probe timers are `DispatchSourceTimer`s on the library's serial queue, and the reduced profile keeps the app running. The maximum reduced duration and probe timers follow wall-clock time: time the device spends asleep counts toward them, so a sleep does not stretch the interval between forced fixes. The stationary delay and cooldown timers count only the time the device is awake, so a sleep can postpone a reduction, never a restore. Every `maxReducedDuration` (default 30 minutes) the library runs a full-accuracy probe for up to 120 seconds: a fix with accuracy of 100 meters or better that has not moved is recorded and the reduction resumes silently (it also resumes silently when no fix arrives in time), while a moved fix or detected movement restores full accuracy. JavaScript keeps seeing the `REDUCED` status during the probe.

### Motion Permission

- `startTracking()` never prompts for Motion & Fitness. Call `requestMotionPermission()` with the app in the foreground before starting the trip; it prompts only while the status is undetermined. When the user has not answered (for example, it was called while the app was not active), it resolves `UNDETERMINED`. A permission granted mid-trip takes effect at the next tracking start.
- Detection warnings (`MOTION_ACTIVITY_UNAVAILABLE` or `MOTION_PERMISSION_NOT_GRANTED`, at most one per session) arrive just after `startTracking()` resolves.
- While detection runs, the permission is re-checked when the app becomes active, at each `maxReducedDuration` timer, and when the stationary delay or cooldown timer fires while a stationary period is being confirmed. If it was revoked during a reduced period, the library emits `MOTION_LOCATION_RESTORED` ("Motion activity stopped; full-accuracy location updates restored.") and then `MOTION_PERMISSION_NOT_GRANTED` ("Motion activity permission was revoked. Location tracking continues at full accuracy.").

## showsBackgroundLocationIndicator (Blue Bar)

When background tracking is active, iOS shows a blue indicator to the user:

- **iPhone with notch/Dynamic Island:** Blue pill in Dynamic Island or status bar
- **Older iPhones:** Blue status bar banner across the top

This indicator:

- Is shown automatically when `showsBackgroundLocationIndicator = true` (the library's default for background tracking)
- Cannot be hidden while using background location (Apple requirement)
- Tapping it brings the user back to your app
- Is not shown during `foregroundOnly` mode

The blue indicator is the iOS equivalent of Android's foreground service notification. It tells the user that their location is being tracked in the background.

## Location Accuracy: Background vs Foreground

iOS does not reduce location accuracy when the app is in the background, provided:

1. `allowsBackgroundLocationUpdates = true`
2. The user granted "Always" permission
3. `desiredAccuracy` is set appropriately

The library maps accuracy levels to `CLLocationAccuracy` values:

| Library Accuracy | CLLocationAccuracy | Approximate Precision |
|---|---|---|
| `HIGH_ACCURACY` | `kCLLocationAccuracyBest` | ~5-10 meters |
| `BALANCED_POWER_ACCURACY` | `kCLLocationAccuracyHundredMeters` | ~100 meters |
| `LOW_POWER` | `kCLLocationAccuracyKilometer` | ~1 kilometer |
| `NO_POWER` / `PASSIVE` | `kCLLocationAccuracyThreeKilometers` | ~3 kilometers |

> With `NO_POWER` or `PASSIVE` accuracy, the library uses `startMonitoringSignificantLocationChanges()` instead of `startUpdatingLocation()`. This provides cell-tower-based updates only, with very low battery impact but reduced precision.

> **Note:** With `motionActivity.reduceWhenStationary` enabled, the library itself switches to `kCLLocationAccuracyThreeKilometers` while the device is stationary, and restores the trip's accuracy when movement is detected. See [Motion Activity on iOS](#motion-activity-on-ios).

## Location Filtering

The library applies two filters to incoming locations on iOS.

### Invalid Location Filter

Locations with `horizontalAccuracy < 0` are rejected. A negative horizontal accuracy means CLLocationManager could not determine the device's position.

### Stale Location Filter

Locations older than 10 seconds (compared to the current time) are rejected. When CLLocationManager starts, it may initially deliver cached locations from the system. These stale locations would introduce incorrect data points.

## Permission Downgrade Handling

If the user changes their location permission while the app is tracking (via Settings > Privacy > Location Services), the library handles it automatically.

### Always to When In Use

- Tracking continues while the app is in the foreground
- A `PERMISSION_DOWNGRADED` warning event is emitted
- When the app goes to background, it will eventually be suspended
- Location updates will stop after suspension

### Always/WhenInUse to Denied

- A `PERMISSION_REVOKED` warning event is emitted
- Tracking stops immediately
- Location manager is cleaned up
- Tracking state is saved as inactive

```typescript
useLocationUpdates({
  onLocationWarning: (warning) => {
    switch (warning.type) {
      case 'PERMISSION_DOWNGRADED':
        // User changed from Always to When In Use
        // Background tracking will stop when app is suspended
        Alert.alert(
          'Permission Changed',
          'Background tracking may stop. Please grant "Always" permission in Settings.'
        );
        break;

      case 'PERMISSION_REVOKED':
        // User denied location permission entirely
        // Tracking has already been stopped
        Alert.alert(
          'Tracking Stopped',
          'Location permission was revoked. Please re-enable in Settings to continue tracking.'
        );
        break;
    }
  },
});
```

## Crash Recovery on iOS

When the app is terminated by iOS (not by the user force-quitting), the crash recovery mechanism works as follows:

1. **Significant location monitoring** was registered when tracking started
2. A significant location change event (cell tower change) wakes the app
3. `RecoveryManager.attemptRecoveryIfNeeded()` is called
4. It checks the stop token -- if set, recovery is skipped (user explicitly stopped)
5. It reads persisted tracking state from Core Data
6. It checks the restart loop counter (max 5 recoveries per hour)
7. It validates location authorization
8. It resumes tracking with the persisted options

> **Note:** From 1.2.0, recovery also restores `activityType` (previously reset to the default), `waitForAccurateLocation` and the motion options. They are kept in `UserDefaults` under `bg_location_tracking_options_ext` while tracking is active. Motion detection restarts without prompting and with a fresh reduction state, so the recovered trip starts at full accuracy.

### Stop Token

The stop token prevents recovery after an explicit `stopTracking()` call:

- `stopTracking()` sets the stop token in `UserDefaults`
- The token is valid for 60 seconds
- `RecoveryManager` checks for the token three times during recovery
- If found, recovery is aborted

### Restart Loop Detection

To prevent battery drain from infinite recovery loops:

- Maximum 5 recovery attempts per hour
- Counter is stored in `UserDefaults`
- Counter resets when the 1-hour window expires
- Counter resets on explicit `startTracking()` call

### User Force-Quit

If the user explicitly force-quits the app (swipe up from app switcher), iOS does not re-launch it for significant location changes. This is by design -- Apple respects the user's explicit intent to quit the app. Tracking will not resume until the user opens the app again.

## Comparison with Android Foreground Service Model

| Behavior | Android | iOS |
|---|---|---|
| App killed by system | Foreground service keeps running independently | App is terminated; significant location can re-launch |
| User swipes from recents | Service usually survives | App is force-quit; no automatic recovery |
| Device reboot | Service does not restart automatically | Significant location monitoring survives reboot |
| Explicit stop | Service stopped, stop token prevents restart | Tracking stopped, stop token prevents recovery |
| Low memory | Foreground service has elevated priority | App may be terminated (background location keeps it longer) |
| Notification/indicator | Persistent notification (customizable) | Blue bar (not customizable) |
| Battery optimization | Manufacturer-specific restrictions | Standardized iOS behavior |

## Best Practices

### 1. Handle All Lifecycle Events

```typescript
useLocationUpdates({
  onLocationUpdate: (location) => {
    // Process location normally
  },
  onLocationWarning: (warning) => {
    // Handle all warning types
    console.log(`Warning: ${warning.type} - ${warning.message}`);
  },
});
```

### 2. Check Tracking State on App Launch

```typescript
import { isTracking } from '@gabriel-sisjr/react-native-background-location';

useEffect(() => {
  isTracking().then((status) => {
    if (status.active) {
      // Recovered from background or crash recovery
      // Sync your UI state with the native state
    }
  });
}, []);
```

### 3. Request "Always" Permission for Reliable Background Tracking

"When In Use" permission with background location entitlement works while the app is alive, but iOS may suspend the app. For reliable long-duration tracking and geofencing, "Always" permission is required.

The hook's `requestPermissions()` (which calls `requestLocationPermission(foregroundOnly: false)`) handles the full WhenInUse-to-Always escalation. Ensure permissions are granted via the hook before registering geofences or starting background tracking.

On iOS, the escalation uses a dedicated `CLLocationManager` instance with a `shouldIgnoreNextAuthCallback` guard to handle the delegate callback that iOS fires immediately upon delegate assignment. This prevents the completion handler from resolving prematurely with the current "When In Use" status before the "Always" permission dialog appears.

### 4. Test on Physical Devices

The iOS Simulator supports basic background location but does not accurately simulate:

- Significant location change events
- App suspension and termination under memory pressure
- Real-world GPS accuracy and battery behavior
- Dynamic Island / status bar indicators

## See Also

- [iOS Setup Guide](../getting-started/ios-setup.md) -- Configuration steps
- [App Store Compliance](./app-store-compliance.md) -- App Store requirements
- [Platform Comparison](./platform-comparison.md) -- Full Android vs iOS comparison
- [Permissions](../getting-started/permissions.md) -- Permission setup and hooks
- [Motion Activity](../guides/motion-activity.md) -- Opt-in motion activity detection and the stationary reduction
