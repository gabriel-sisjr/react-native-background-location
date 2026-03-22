# Platform Comparison: Android vs iOS

Side-by-side comparison of how `@gabriel-sisjr/react-native-background-location` works on Android and iOS. The JavaScript API is identical on both platforms, but the underlying native implementations differ significantly.

## Feature Matrix

| Feature                      | Android                                       | iOS                                                      |
| ---------------------------- | --------------------------------------------- | -------------------------------------------------------- |
| Background location tracking | Foreground Service + FusedLocationProvider    | CLLocationManager + background entitlement               |
| Local persistence            | Room Database (SQLite)                        | Core Data (SQLite)                                       |
| Permission flow              | 3-step (foreground, background, notification) | 2-step (When In Use, Always)                             |
| Background mechanism         | Foreground Service (must show notification)   | Background Location Updates (blue bar indicator)         |
| Crash recovery               | WorkManager (Android 12+) / direct restart    | RecoveryManager + Significant Location Monitoring        |
| User-visible indicator       | Persistent notification (fully customizable)  | Blue status bar / Dynamic Island pill (not customizable) |
| Distance filter              | Supported                                     | Supported                                                |
| Foreground-only mode         | Supported                                     | Supported                                                |
| Real-time JS events          | NativeEventEmitter via LocalBroadcastManager  | NativeEventEmitter via closure callbacks                 |

## Location Tracking

| Aspect                  | Android                                                                            | iOS                                                     |
| ----------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Location provider       | FusedLocationProvider (Google Play Services) or AndroidLocationProvider (fallback) | CLLocationManager                                       |
| Activity type           | Not applicable                                                                     | `.automotiveNavigation`                                 |
| Distance filter         | Via FusedLocationProvider `setSmallestDisplacement`                                | Via `CLLocationManager.distanceFilter`                  |
| Pauses automatically    | Not applicable                                                                     | `pausesLocationUpdatesAutomatically = false` (disabled) |
| Stale location filter   | Not applicable (FusedLocationProvider handles this)                                | Rejects locations older than 10 seconds                 |
| Invalid location filter | Not applicable                                                                     | Rejects locations with `horizontalAccuracy < 0`         |

## Accuracy Mapping

The `LocationAccuracy` enum maps to different native values on each platform:

| LocationAccuracy          | Android (Priority)                 | iOS (CLLocationAccuracy)                    |
| ------------------------- | ---------------------------------- | ------------------------------------------- |
| `HIGH_ACCURACY`           | `PRIORITY_HIGH_ACCURACY`           | `kCLLocationAccuracyBest` (~5-10m)          |
| `BALANCED_POWER_ACCURACY` | `PRIORITY_BALANCED_POWER_ACCURACY` | `kCLLocationAccuracyHundredMeters` (~100m)  |
| `LOW_POWER`               | `PRIORITY_LOW_POWER`               | `kCLLocationAccuracyKilometer` (~1km)       |
| `NO_POWER`                | `PRIORITY_PASSIVE`                 | `kCLLocationAccuracyThreeKilometers` (~3km) |
| `PASSIVE`                 | `PRIORITY_PASSIVE`                 | `kCLLocationAccuracyThreeKilometers` (~3km) |

> **Note:** On iOS, `NO_POWER` and `PASSIVE` accuracy levels use `startMonitoringSignificantLocationChanges()` instead of `startUpdatingLocation()`, providing cell-tower-based updates with minimal power consumption.

## Default Distance Filters (When Not Explicitly Set)

| Accuracy                  | Android            | iOS                             |
| ------------------------- | ------------------ | ------------------------------- |
| `HIGH_ACCURACY`           | None (all updates) | None (all updates)              |
| `BALANCED_POWER_ACCURACY` | None               | 50 meters                       |
| `LOW_POWER`               | None               | 200 meters                      |
| `NO_POWER` / `PASSIVE`    | None               | None (significant changes only) |

## Permissions

### Permission Flow

**Android (3-step for Android 13+):**

```
Step 1: ACCESS_FINE_LOCATION + ACCESS_COARSE_LOCATION
    |
    v
Step 2: ACCESS_BACKGROUND_LOCATION (Android 10+, separate dialog)
    |
    v
Step 3: POST_NOTIFICATIONS (Android 13+, for foreground service notification)
```

**iOS (2-step):**

```
Step 1: requestWhenInUseAuthorization()
    |
    v  (if foregroundOnly = false)
Step 2: requestAlwaysAuthorization()
```

### Permission Status Mapping

| LocationPermissionStatus | Android                                      | iOS                                    |
| ------------------------ | -------------------------------------------- | -------------------------------------- |
| `UNDETERMINED`           | Never requested                              | `notDetermined`                        |
| `WHEN_IN_USE`            | Not applicable (Android doesn't distinguish) | `authorizedWhenInUse`                  |
| `GRANTED`                | All permissions granted                      | `authorizedAlways`                     |
| `DENIED`                 | User denied (can ask again)                  | `denied`                               |
| `BLOCKED`                | User selected "Never ask again"              | `restricted` (parental controls / MDM) |

### Permission Methods

| Method                             | Android Behavior                                         | iOS Behavior                                   |
| ---------------------------------- | -------------------------------------------------------- | ---------------------------------------------- |
| `checkLocationPermission()`        | Checks native permission status via `PermissionsAndroid` | Checks `CLLocationManager.authorizationStatus` |
| `requestLocationPermission(false)` | Requests foreground + background + notification          | Requests WhenInUse, then escalates to Always   |
| `requestLocationPermission(true)`  | Requests foreground only                                 | Requests WhenInUse only                        |

## Persistence

| Aspect                     | Android                                                                                                                                                        | iOS                                              |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Database technology        | Room (SQLite abstraction)                                                                                                                                      | Core Data (SQLite abstraction)                   |
| Write strategy             | Batched async writes (batch size 10, 5s timeout)                                                                                                               | Batched async writes (batch size 10, 5s timeout) |
| Location entity fields     | id, tripId, latitude, longitude, timestamp, accuracy, altitude, speed, bearing, verticalAccuracy, speedAccuracy, bearingAccuracy, provider, isFromMockProvider | Identical schema                                 |
| Tracking state persistence | Room entity (TrackingStateEntity)                                                                                                                              | Core Data entity (TrackingStateEntity)           |
| Schema migration           | Room migration-safe versioning                                                                                                                                 | Core Data lightweight migration                  |
| Stop token storage         | SharedPreferences                                                                                                                                              | UserDefaults                                     |
| Recovery counter storage   | SharedPreferences                                                                                                                                              | UserDefaults                                     |

## Background Mode

| Aspect                  | Android                                                    | iOS                                                |
| ----------------------- | ---------------------------------------------------------- | -------------------------------------------------- |
| Mechanism               | Foreground Service with `FOREGROUND_SERVICE_LOCATION` type | Background Location Updates capability             |
| Start requirement       | Must call `startForeground()` within 5-10s (Android 12+)   | Must set `allowsBackgroundLocationUpdates = true`  |
| User indicator          | Persistent notification                                    | Blue status bar / Dynamic Island indicator         |
| Indicator customization | Full control (title, text, icon, color, actions)           | None (system-managed blue bar)                     |
| Service timeout         | Android 15+ has time limits (handled by library restart)   | No timeout (location entitlement keeps app alive)  |
| App killed by user      | Service usually continues                                  | App terminates; no automatic recovery              |
| App killed by system    | Service continues independently                            | App terminates; significant location can re-launch |

## Crash Recovery

| Aspect                | Android                                             | iOS                                               |
| --------------------- | --------------------------------------------------- | ------------------------------------------------- |
| Recovery mechanism    | WorkManager (Android 12+) or direct service restart | RecoveryManager + Significant Location Monitoring |
| Wake-up trigger       | WorkManager scheduled task                          | Significant location change event (cell tower)    |
| Re-launch capability  | Service restarts within same process                | iOS re-launches the entire app in background      |
| Stop token            | SharedPreferences, 60-second validity               | UserDefaults, 60-second validity                  |
| Restart loop limit    | 5 restarts per hour                                 | 5 recoveries per hour                             |
| Recovery after reboot | Service does not restart after reboot               | Significant location monitoring survives reboot   |
| User force-quit       | Service may survive (manufacturer-dependent)        | No recovery (Apple enforces user intent)          |

## Notifications and Indicators

| Aspect                | Android                                         | iOS                              |
| --------------------- | ----------------------------------------------- | -------------------------------- |
| Notification required | Yes (foreground service must show notification) | No notification concept          |
| Notification title    | Customizable via `notificationTitle`            | Not applicable                   |
| Notification text     | Customizable via `notificationText`             | Not applicable                   |
| Notification icon     | Customizable via `notificationSmallIcon`        | Not applicable                   |
| Notification color    | Customizable via `notificationColor`            | Not applicable                   |
| Notification actions  | Up to 3 action buttons                          | Not applicable                   |
| Notification channel  | Customizable via `notificationChannelId`        | Not applicable                   |
| Update notification   | `updateNotification(title, text)`               | No-op (returns successfully)     |
| Background indicator  | Notification in shade                           | Blue status bar / Dynamic Island |

> **Cross-platform tip:** You can pass notification options on iOS without error. They are parsed and stored but have no visible effect. This means you can use the same `TrackingOptions` object on both platforms without platform-specific branching.

## TrackingOptions: Platform Applicability

| Option                      | Android | iOS         | Notes                                                             |
| --------------------------- | ------- | ----------- | ----------------------------------------------------------------- |
| `accuracy`                  | Applied | Applied     | Different native mappings (see Accuracy table)                    |
| `updateInterval`            | Applied | Stored only | iOS does not support interval-based updates; uses distance filter |
| `fastestInterval`           | Applied | Ignored     | Android-only FusedLocationProvider feature                        |
| `maxWaitTime`               | Applied | Ignored     | Android-only batching parameter                                   |
| `waitForAccurateLocation`   | Applied | Stored only | iOS relies on `desiredAccuracy` instead                           |
| `distanceFilter`            | Applied | Applied     | Both platforms support minimum distance between updates           |
| `foregroundOnly`            | Applied | Applied     | Controls `allowsBackgroundLocationUpdates` on iOS                 |
| `notificationTitle`         | Applied | Ignored     | No notification on iOS                                            |
| `notificationText`          | Applied | Ignored     | No notification on iOS                                            |
| `notificationSmallIcon`     | Applied | Ignored     | No notification on iOS                                            |
| `notificationColor`         | Applied | Ignored     | No notification on iOS                                            |
| `notificationShowTimestamp` | Applied | Ignored     | No notification on iOS                                            |
| `notificationActions`       | Applied | Ignored     | No notification on iOS                                            |
| `notificationLargeIcon`     | Applied | Ignored     | No notification on iOS                                            |
| `notificationSubtext`       | Applied | Ignored     | No notification on iOS                                            |
| `notificationChannelId`     | Applied | Ignored     | No notification on iOS                                            |
| `notificationChannelName`   | Applied | Ignored     | No notification on iOS                                            |
| `notificationPriority`      | Applied | Ignored     | No notification on iOS                                            |
| `onUpdateInterval`          | Applied | Applied     | JS-level throttling, works on both platforms                      |

## Events

Both platforms emit the same events through `NativeEventEmitter` with the same data format:

### Location Update Event

| Field                          | Android                      | iOS                                  | Notes            |
| ------------------------------ | ---------------------------- | ------------------------------------ | ---------------- |
| `tripId`                       | Present                      | Present                              | Same value       |
| `latitude`                     | String                       | String                               | Same format      |
| `longitude`                    | String                       | String                               | Same format      |
| `timestamp`                    | Milliseconds since epoch     | Milliseconds since epoch             | Same format      |
| `accuracy`                     | Horizontal accuracy (meters) | Horizontal accuracy (meters)         | Same meaning     |
| `altitude`                     | Meters above sea level       | Meters above sea level               | Same meaning     |
| `speed`                        | Meters per second            | Meters per second                    | Same meaning     |
| `bearing`                      | Degrees (0-360)              | Degrees (0-360, from `course`)       | Same meaning     |
| `verticalAccuracyMeters`       | Available (API 26+)          | Available                            | Same meaning     |
| `speedAccuracyMetersPerSecond` | Available (API 26+)          | Available                            | Same meaning     |
| `bearingAccuracyDegrees`       | Available (API 26+)          | Available (from `courseAccuracy`)    | Same meaning     |
| `elapsedRealtimeNanos`         | Available                    | Not available                        | Android-only     |
| `provider`                     | "gps", "network", "passive"  | "gps" or "simulated"                 | Different values |
| `isFromMockProvider`           | Available (API 18+)          | Available (from `sourceInformation`) | Same meaning     |

### Warning Events

| Warning Type               | Android                                 | iOS                                            |
| -------------------------- | --------------------------------------- | ---------------------------------------------- |
| `SERVICE_TIMEOUT`          | Emitted on Android 15+ service timeout  | Not emitted (no service concept)               |
| `TASK_REMOVED`             | Emitted when app is swiped from recents | Not emitted                                    |
| `LOCATION_UNAVAILABLE`     | Emitted when GPS signal lost            | Emitted when CLLocationManager fails           |
| `LOCATION_UPDATES_PAUSED`  | Not emitted                             | Emitted when iOS pauses updates for battery    |
| `LOCATION_UPDATES_RESUMED` | Not emitted                             | Emitted when iOS resumes paused updates        |
| `PERMISSION_REVOKED`       | Not emitted natively (handled by hooks) | Emitted when permission is revoked mid-session |
| `PERMISSION_DOWNGRADED`    | Not applicable                          | Emitted when Always is downgraded to WhenInUse |

## Store Compliance

| Requirement                    | Google Play (Android)                                 | App Store (iOS)                                   |
| ------------------------------ | ----------------------------------------------------- | ------------------------------------------------- |
| Compliance guide               | [Google Play Compliance](./GOOGLE_PLAY_COMPLIANCE.md) | [App Store Compliance](./APP_STORE_COMPLIANCE.md) |
| In-app disclosure              | Required (blocking dialog before permission)          | Not required (but recommended for good UX)        |
| Usage descriptions             | Not applicable                                        | Required (Info.plist keys)                        |
| Privacy policy                 | Required (must mention location)                      | Required (must mention location)                  |
| Data safety / nutrition labels | Play Console Data Safety form                         | App Store Connect Privacy labels                  |
| Permission justification       | Permissions declaration form in Play Console          | Review notes + justification text                 |
| Demo video                     | Required for background location                      | Not required (but helpful for review)             |
| Privacy manifest               | Not applicable                                        | Required (PrivacyInfo.xcprivacy)                  |

## Testing Differences

| Scenario           | Android                                           | iOS                                                   |
| ------------------ | ------------------------------------------------- | ----------------------------------------------------- |
| Simulated location | `adb shell` commands, mock location apps          | Xcode scheme GPX files, Simulator menu                |
| Background testing | Works reliably on emulator                        | Works on Simulator, but significant location does not |
| Device testing     | Required for manufacturer-specific battery issues | Required for accurate battery and GPS behavior        |
| Crash recovery     | Can simulate via `adb shell am force-stop`        | Can simulate via Xcode stop, but not force-quit       |
| Permission reset   | Settings > Apps > Permissions                     | Settings > Privacy > Location Services                |
| Battery simulation | `adb shell dumpsys deviceidle force-idle`         | No equivalent (must test on device)                   |

## Cross-Platform Code Pattern

The library is designed so you can use the same code on both platforms:

```typescript
import BackgroundLocation, {
  LocationAccuracy,
  useLocationPermissions,
  useBackgroundLocation,
  useLocationUpdates,
} from '@gabriel-sisjr/react-native-background-location';

function TrackingScreen() {
  const { permissionStatus, requestPermissions } = useLocationPermissions();
  const { isTracking, tripId, startTracking, stopTracking } = useBackgroundLocation();

  useLocationUpdates({
    onLocationUpdate: (location) => {
      // Same data format on both platforms
      console.log(location.latitude, location.longitude);
    },
    onLocationWarning: (warning) => {
      // Handle platform-specific warnings gracefully
      console.log(warning.type, warning.message);
    },
  });

  const handleStart = async () => {
    if (!permissionStatus.hasPermission) {
      await requestPermissions();
    }

    // Same options work on both platforms
    // Notification options are silently ignored on iOS
    await startTracking({
      accuracy: LocationAccuracy.HIGH_ACCURACY,
      distanceFilter: 50,
      notificationTitle: 'Tracking Active',  // Android only, ignored on iOS
      notificationText: 'Recording your route',  // Android only, ignored on iOS
    });
  };

  return (
    <View>
      <Button title="Start" onPress={handleStart} />
      <Button title="Stop" onPress={stopTracking} />
    </View>
  );
}
```

## See Also

- [iOS Setup Guide](../getting-started/IOS_SETUP.md) -- iOS-specific configuration
- [iOS Background Behavior](./IOS_BACKGROUND_BEHAVIOR.md) -- Deep dive into iOS background location
- [App Store Compliance](./APP_STORE_COMPLIANCE.md) -- iOS store requirements
- [Google Play Compliance](./GOOGLE_PLAY_COMPLIANCE.md) -- Android store requirements
- [Battery Optimization](./BATTERY_OPTIMIZATION.md) -- Android manufacturer-specific issues
- [Crash Recovery](./CRASH_RECOVERY.md) -- Cross-platform recovery details
