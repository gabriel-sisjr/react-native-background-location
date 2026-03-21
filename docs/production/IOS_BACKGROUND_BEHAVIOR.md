# iOS Background Location Behavior

This document explains how iOS handles background location tracking, how it differs from Android, and what to expect in production. Understanding these behaviors is critical for building reliable tracking features on iOS.

## How iOS Background Location Works

Unlike Android, iOS does not use a foreground service model. Instead, iOS has a dedicated background location entitlement managed by `CLLocationManager`. When configured correctly, iOS keeps your app alive in the background specifically to receive location updates.

### Key Differences from Android

| Aspect                 | Android                                        | iOS                                               |
| ---------------------- | ---------------------------------------------- | ------------------------------------------------- |
| Background mechanism   | Foreground Service (user-visible notification) | Background Location Updates (blue indicator bar)  |
| User indicator         | Persistent notification in notification shade  | Blue status bar / Dynamic Island pill             |
| System kill protection | Service has elevated priority                  | Location entitlement keeps app alive              |
| Crash recovery         | WorkManager schedules restart                  | Significant location monitoring re-launches app   |
| OS resource management | Doze mode, App Standby buckets                 | App suspension, termination under memory pressure |

## CLLocationManager Background Modes

The library uses two `CLLocationManager` modes depending on configuration:

### Standard Location Updates (`startUpdatingLocation`)

Used for `HIGH_ACCURACY`, `BALANCED_POWER_ACCURACY`, and `LOW_POWER` accuracy levels.

- Continuous stream of location updates
- Configurable accuracy via `desiredAccuracy`
- Distance filter support via `distanceFilter`
- Works in background when `allowsBackgroundLocationUpdates = true`
- Activity type set to `.automotiveNavigation` for optimal battery/accuracy balance

```
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

### Significant Location Changes (`startMonitoringSignificantLocationChanges`)

Used for `PASSIVE` and `NO_POWER` accuracy levels, and as a crash recovery mechanism for all accuracy levels.

- Coarse updates triggered by cell tower changes (typically 500m+ movement)
- Very low power consumption
- Can re-launch a terminated app
- Used as the crash recovery wake-up mechanism

```
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
- If background location is enabled, the app is **not** suspended -- it stays in "Background" state
- If only "When In Use" permission is granted, the app **will** be suspended after approximately 10 seconds
- No code executes while suspended

### Terminated

- iOS terminates the app under memory pressure or user force-quit
- Standard location updates stop immediately
- Significant location monitoring can re-launch the app
- The library's `RecoveryManager` handles re-launch recovery

### Lifecycle Summary

```
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
                    OR WhenInUse permission only
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
// Foreground-only tracking
const tripId = await BackgroundLocation.startTracking({
  foregroundOnly: true,
  accuracy: LocationAccuracy.HIGH_ACCURACY,
});
// Tracking will pause when app is backgrounded
// and resume when app returns to foreground
```

## Battery Optimization

### pausesLocationUpdatesAutomatically

The library sets `pausesLocationUpdatesAutomatically = false` to ensure continuous tracking. When this property is `true` (the default), iOS may pause location updates when it determines the user has stopped moving. This causes unexpected gaps in tracking data.

If iOS does pause updates (due to extreme battery conditions), the library emits a `LOCATION_UPDATES_PAUSED` warning event, and a `LOCATION_UPDATES_RESUMED` event when updates resume.

```typescript
import { useLocationUpdates } from '@gabriel-sisjr/react-native-background-location';

function TrackingScreen() {
  useLocationUpdates({
    onLocationWarning: (warning) => {
      if (warning.type === 'LOCATION_UPDATES_PAUSED') {
        console.log('iOS paused location updates to save battery');
      }
      if (warning.type === 'LOCATION_UPDATES_RESUMED') {
        console.log('iOS resumed location updates');
      }
    },
  });
}
```

### activityType

The library sets `activityType = .automotiveNavigation`. This tells iOS the app is tracking vehicle movement, which:

- Optimizes location updates for driving scenarios
- Keeps GPS active during highway driving
- Allows iOS to make better power management decisions
- Applies dead reckoning when GPS signal is temporarily lost

### Distance Filter Defaults

When no explicit `distanceFilter` is provided, the library applies accuracy-based defaults:

| Accuracy                  | Default Distance Filter         |
| ------------------------- | ------------------------------- |
| `HIGH_ACCURACY`           | None (all updates)              |
| `BALANCED_POWER_ACCURACY` | 50 meters                       |
| `LOW_POWER`               | 200 meters                      |
| `NO_POWER` / `PASSIVE`    | None (significant changes only) |

Setting a distance filter reduces battery consumption by ignoring small movements.

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

| Library Accuracy          | CLLocationAccuracy                   | Approximate Precision |
| ------------------------- | ------------------------------------ | --------------------- |
| `HIGH_ACCURACY`           | `kCLLocationAccuracyBest`            | ~5-10 meters          |
| `BALANCED_POWER_ACCURACY` | `kCLLocationAccuracyHundredMeters`   | ~100 meters           |
| `LOW_POWER`               | `kCLLocationAccuracyKilometer`       | ~1 kilometer          |
| `NO_POWER` / `PASSIVE`    | `kCLLocationAccuracyThreeKilometers` | ~3 kilometers         |

> **Note:** With `NO_POWER` or `PASSIVE` accuracy, the library uses `startMonitoringSignificantLocationChanges()` instead of `startUpdatingLocation()`. This provides cell-tower-based updates only, with very low battery impact but reduced precision.

## Location Filtering

The library applies two filters to incoming locations on iOS:

### Invalid Location Filter

Locations with `horizontalAccuracy < 0` are rejected. A negative horizontal accuracy means CLLocationManager could not determine the device's position.

### Stale Location Filter

Locations older than 10 seconds (compared to the current time) are rejected. When CLLocationManager starts, it may initially deliver cached locations from the system. These stale locations would introduce incorrect data points.

## Permission Downgrade Handling

If the user changes their location permission while the app is tracking (via Settings > Privacy > Location Services), the library handles it automatically:

### Always -> When In Use

- Tracking continues while the app is in the foreground
- A `PERMISSION_DOWNGRADED` warning event is emitted
- When the app goes to background, it will eventually be suspended
- Location updates will stop after suspension

### Always/WhenInUse -> Denied

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

| Behavior                 | Android                                        | iOS                                                         |
| ------------------------ | ---------------------------------------------- | ----------------------------------------------------------- |
| App killed by system     | Foreground service keeps running independently | App is terminated; significant location can re-launch       |
| User swipes from recents | Service usually survives                       | App is force-quit; no automatic recovery                    |
| Device reboot            | Service does not restart automatically         | Significant location monitoring survives reboot             |
| Explicit stop            | Service stopped, stop token prevents restart   | Tracking stopped, stop token prevents recovery              |
| Low memory               | Foreground service has elevated priority       | App may be terminated (background location keeps it longer) |
| Notification/indicator   | Persistent notification (customizable)         | Blue bar (not customizable)                                 |
| Battery optimization     | Manufacturer-specific restrictions             | Standardized iOS behavior                                   |

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
useEffect(() => {
  BackgroundLocation.isTracking().then((status) => {
    if (status.active) {
      // Recovered from background or crash recovery
      // Sync your UI state with the native state
    }
  });
}, []);
```

### 3. Request "Always" Permission for Reliable Background Tracking

"When In Use" permission with background location entitlement works while the app is alive, but iOS may suspend the app. For reliable long-duration tracking, "Always" permission is recommended.

### 4. Test on Physical Devices

The iOS Simulator supports basic background location but does not accurately simulate:

- Significant location change events
- App suspension and termination under memory pressure
- Real-world GPS accuracy and battery behavior
- Dynamic Island / status bar indicators

## See Also

- [iOS Setup Guide](../getting-started/IOS_SETUP.md) -- Configuration steps
- [App Store Compliance](./APP_STORE_COMPLIANCE.md) -- App Store requirements
- [Platform Comparison](./PLATFORM_COMPARISON.md) -- Full Android vs iOS comparison
- [Crash Recovery](./CRASH_RECOVERY.md) -- Cross-platform recovery details
- [Battery Optimization](./BATTERY_OPTIMIZATION.md) -- Android-specific battery issues
