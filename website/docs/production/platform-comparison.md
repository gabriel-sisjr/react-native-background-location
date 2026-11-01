---
sidebar_position: 3
title: Platform Comparison
description: Feature-by-feature comparison of Android vs iOS background location behavior — service model, persistence, permissions, notifications, geofencing limits, crash recovery, accuracy mapping, and background modes.
keywords:
  - android
  - ios
  - platform comparison
  - background location
  - foreground service
  - CLLocationManager
  - permissions
  - geofencing
  - crash recovery
  - accuracy
---

# Platform Comparison: Android vs iOS

Side-by-side comparison of how `@gabriel-sisjr/react-native-background-location` works on Android and iOS. The JavaScript API is identical on both platforms, but the underlying native implementations differ significantly.

## Feature Matrix

| Feature | Android | iOS |
|---|---|---|
| Background location tracking | Foreground Service + FusedLocationProvider | CLLocationManager + background entitlement |
| Local persistence | Room Database (SQLite) | Core Data (SQLite) |
| Permission flow | 3-step (foreground, background, notification) | 3-step (When In Use, Always, Notification) |
| Background mechanism | Foreground Service (must show notification) | Background Location Updates (blue bar indicator) |
| Crash recovery | WorkManager (Android 12+) / direct restart | RecoveryManager + Significant Location Monitoring |
| User-visible indicator | Persistent notification (fully customizable) | Blue status bar / Dynamic Island pill (not customizable) |
| Distance filter | Supported | Supported |
| Foreground-only mode | Supported | Supported |
| Real-time JS events | NativeEventEmitter via SharedFlow singletons | NativeEventEmitter via closure callbacks |
| Motion activity (opt-in) | Activity Recognition API (Google Play services) | CoreMotion, compiled in only with a Podfile flag |

## Location Tracking

| Aspect | Android | iOS |
|---|---|---|
| Location provider | FusedLocationProvider (Google Play Services) or AndroidLocationProvider (fallback) | CLLocationManager |
| Activity type | Not applicable | `.other` by default; configurable via `TrackingOptions.activityType` ([`LocationActivityType`](../api-reference/enums.md#locationactivitytype)) |
| Distance filter | Via FusedLocationProvider `setSmallestDisplacement` | Via `CLLocationManager.distanceFilter` |
| Pauses automatically | Not applicable | `pausesLocationUpdatesAutomatically = false` (disabled) |
| Stale location filter | Not applicable (FusedLocationProvider handles this) | Rejects locations older than 10 seconds |
| Invalid location filter | Not applicable | Rejects locations with `horizontalAccuracy < 0` |

## Accuracy Mapping

The `LocationAccuracy` enum maps to different native values on each platform:

| LocationAccuracy | Android (Priority) | iOS (CLLocationAccuracy) |
|---|---|---|
| `HIGH_ACCURACY` | `PRIORITY_HIGH_ACCURACY` | `kCLLocationAccuracyBest` (~5-10m) |
| `BALANCED_POWER_ACCURACY` | `PRIORITY_BALANCED_POWER_ACCURACY` | `kCLLocationAccuracyHundredMeters` (~100m) |
| `LOW_POWER` | `PRIORITY_LOW_POWER` | `kCLLocationAccuracyKilometer` (~1km) |
| `NO_POWER` | `PRIORITY_PASSIVE` | `kCLLocationAccuracyThreeKilometers` (~3km) |
| `PASSIVE` | `PRIORITY_PASSIVE` | `kCLLocationAccuracyThreeKilometers` (~3km) |

> On iOS, `NO_POWER` and `PASSIVE` accuracy levels use `startMonitoringSignificantLocationChanges()` instead of `startUpdatingLocation()`, providing cell-tower-based updates with minimal power consumption.

## Default Distance Filters (When Not Explicitly Set)

| Accuracy | Android | iOS |
|---|---|---|
| `HIGH_ACCURACY` | None (all updates) | None (all updates) |
| `BALANCED_POWER_ACCURACY` | None | 50 meters |
| `LOW_POWER` | None | 200 meters |
| `NO_POWER` / `PASSIVE` | None | None (significant changes only) |

## Permissions

### Permission Flow

**Android (3-step for Android 13+):**

```text
Step 1: ACCESS_FINE_LOCATION + ACCESS_COARSE_LOCATION
    |
    v
Step 2: ACCESS_BACKGROUND_LOCATION (Android 10+, separate dialog)
    |
    v
Step 3: POST_NOTIFICATIONS (Android 13+, for foreground service notification)
```

**iOS (3-step):**

```text
Step 1: requestWhenInUseAuthorization()
    |
    v  (if foregroundOnly = false)
Step 2: requestAlwaysAuthorization()
    |
    v
Step 3: UNUserNotificationCenter.requestAuthorization() (notification permission)
```

### Permission Status Mapping

| LocationPermissionStatus | Android | iOS |
|---|---|---|
| `UNDETERMINED` | Never requested | `notDetermined` |
| `WHEN_IN_USE` | Not applicable (Android does not distinguish) | `authorizedWhenInUse` |
| `GRANTED` | All permissions granted | `authorizedAlways` |
| `DENIED` | User denied (can ask again) | `denied` |
| `BLOCKED` | User selected "Never ask again" | `restricted` (parental controls / MDM) |

### Notification Permission Status

The `useLocationPermissions` hook also tracks notification permission status on both platforms via the `NotificationPermissionStatus` enum:

| NotificationPermissionStatus | Android | iOS |
|---|---|---|
| `GRANTED` | `POST_NOTIFICATIONS` granted (Android 13+) | `UNAuthorizationStatus.authorized` |
| `DENIED` | `POST_NOTIFICATIONS` denied | `UNAuthorizationStatus.denied` |
| `UNDETERMINED` | Never requested (or Android < 13) | `UNAuthorizationStatus.notDetermined` |

### Permission State Structure

The `permissionStatus` returned by `useLocationPermissions` uses a granular nested structure:

```typescript
interface PermissionState {
  hasAllPermissions: boolean;     // true when both location AND notification are granted
  location: {
    hasPermission: boolean;       // true when location permission is fully granted
    status: LocationPermissionStatus;
    canRequestAgain: boolean;
  };
  notification: {
    hasPermission: boolean;       // true when notification permission is granted
    status: NotificationPermissionStatus;
    canRequestAgain: boolean;
  };
}
```

| Property | Description |
|---|---|
| `hasAllPermissions` | `true` only when both location and notification are granted |
| `location.hasPermission` | `true` when location permission matches the requested level |
| `location.status` | Current `LocationPermissionStatus` value |
| `location.canRequestAgain` | `false` if user blocked location permanently |
| `notification.hasPermission` | `true` when notification permission is granted |
| `notification.status` | Current `NotificationPermissionStatus` value |
| `notification.canRequestAgain` | `false` if user blocked notifications permanently |

### Permission Methods

| Method | Android Behavior | iOS Behavior |
|---|---|---|
| `checkLocationPermission()` | Checks native permission status via `PermissionsAndroid` | Checks `CLLocationManager.authorizationStatus` |
| `requestLocationPermission(false)` | Requests foreground + background + notification | Requests WhenInUse, then Always, then Notification |
| `requestLocationPermission(true)` | Requests foreground only | Requests WhenInUse only |

## Persistence

| Aspect | Android | iOS |
|---|---|---|
| Database technology | Room (SQLite abstraction) | Core Data (SQLite abstraction) |
| Write strategy | Batched async writes (batch size 10, 5s timeout) | Batched async writes (batch size 10, 5s timeout) |
| Location entity fields | id, tripId, latitude, longitude, timestamp, accuracy, altitude, speed, bearing, verticalAccuracy, speedAccuracy, bearingAccuracy, provider, isFromMockProvider | Identical schema |
| Tracking state persistence | Room entity (TrackingStateEntity) | Core Data entity (TrackingStateEntity) |
| Schema migration | Room migration-safe versioning | Core Data lightweight migration |
| Stop token storage | SharedPreferences | UserDefaults |
| Recovery counter storage | SharedPreferences | UserDefaults |

## Background Mode

| Aspect | Android | iOS |
|---|---|---|
| Mechanism | Foreground Service with `FOREGROUND_SERVICE_LOCATION` type | Background Location Updates capability |
| Start requirement | Must call `startForeground()` within 5-10s (Android 12+) | Must set `allowsBackgroundLocationUpdates = true` |
| User indicator | Persistent notification | Blue status bar / Dynamic Island indicator |
| Indicator customization | Full control (title, text, icon, color, actions) | None (system-managed blue bar) |
| Service timeout | Android 15+ has time limits (handled by library restart) | No timeout (location entitlement keeps app alive) |
| App killed by user | Service usually continues | App terminates; no automatic recovery |
| App killed by system | Service continues independently | App terminates; significant location can re-launch |

## Geofencing

| Aspect | Android | iOS |
|---|---|---|
| Native API | `GeofencingClient` (Google Play Services) | `CLLocationManager` region monitoring |
| Detection model | Passive -- piggybacks on other apps' location requests | Active -- OS monitors regions independently |
| GPS keepalive (heartbeat) | Automatic `FusedLocationProviderClient` heartbeat (15-min, `BALANCED_POWER_ACCURACY`) when tracking is not active | Not needed (region monitoring is active) |
| Heartbeat battery impact | ~2-4%/day | N/A |
| Notification responsiveness | `setNotificationResponsiveness(5000)` (~5s delivery) | System-managed |
| Maximum geofences | 100 | 20 (shared with iBeacon regions) |
| DWELL detection | Native (`GeofencingClient` loitering) | Software-based timer |
| Persistence after reboot | `BootCompletedReceiver` re-registers geofences + restarts heartbeat | `CLLocationManager` persists regions across restarts |
| Persistence after force-quit | Survives (geofences stored in Room DB) | Survives (regions managed by OS) |

## Motion Activity

Motion activity detection and the stationary reduction are opt-in through `TrackingOptions.motionActivity` and off by default. The JavaScript API, the `onMotionActivity` event and the `MOTION_*` warnings are the same on both platforms; the detection source, permission model and timers differ. See the [Motion Activity guide](../guides/motion-activity.md#platform-differences) for the full behavior.

| Aspect | Android | iOS |
|---|---|---|
| Opt-in | `motionActivity` in `TrackingOptions` | `motionActivity` in `TrackingOptions`, plus a compile-time opt-in: `$BackgroundLocationMotionActivity = true` in the Podfile (or the Expo plugin prop `motionActivity`). Without it no CoreMotion code is compiled or linked |
| Detection source | Activity Recognition API (Google Play services); no fallback without Play services | CoreMotion (`CMMotionActivity`) |
| Delivery | Periodic samples every `sampleInterval` (default 30 s) plus ENTER transitions | Every CoreMotion update, as changes happen (`sampleInterval` is ignored) |
| Confidence | Most probable activity's 0-100 value: 75 or more is `HIGH`, 50-74 `MEDIUM`, below 50 `LOW`; ENTER transitions are `HIGH` | CoreMotion `.high`, `.medium` and `.low`, mapped directly |
| Permission | `android.permission.ACTIVITY_RECOGNITION`, a runtime permission on API 29+ (Android 10+); `com.google.android.gms.permission.ACTIVITY_RECOGNITION`, granted at install time, on API 28 and lower. The app declares both; the library manifest declares neither | Motion & Fitness; requires `NSMotionUsageDescription` in `Info.plist` |
| Permission prompt | `requestMotionPermission()` shows the system dialog on API 29+ through `PermissionsAndroid`; the native module never prompts. On Google Play, show your disclosure and get consent first | `requestMotionPermission()` prompts only while the status is undetermined, and only with the app in the foreground; it resolves `UNDETERMINED` when the user has not answered |
| Permission revoked mid-trip | Detected through a security error or a re-check | Re-checked when the app becomes active, at each `maxReducedDuration` timer, and when a timer fires while a stationary period is being confirmed |
| Reduced profile | `PRIORITY_LOW_POWER`, interval 60 s, fastest interval 30 s, no distance filter, through the fused provider. The foreground service keeps running | `desiredAccuracy = kCLLocationAccuracyThreeKilometers`, `distanceFilter = 500` m. Standard updates keep running, so the app is not suspended and CoreMotion keeps delivering |
| Reduction timers | Inexact `AlarmManager.setAndAllowWhileIdle` alarms (no exact-alarm permission). Outside Doze and battery saver they can fire up to about 75% later than configured; in Doze, allow-while-idle alarms fire at most once every 9 minutes per app. A timer that cannot be scheduled ends detection for the session (`MOTION_ACTIVITY_UNAVAILABLE`, full accuracy) | `DispatchSourceTimer`s on the library's serial queue. The maximum-reduced-duration and probe timers follow wall-clock time; the dwell and cooldown timers can run longer while the device sleeps, which only postpones a reduction |
| Notification while reduced | Content text switches to `reduceWhenStationary.notificationText`; title, icon, actions and channel are unchanged | No notification; the blue location indicator stays visible |
| Platform-specific options | `sampleInterval` and `reduceWhenStationary.notificationText` apply | Both are ignored |
| Geofencing while reduced | Registrations are untouched. The geofence heartbeat runs only when tracking is not active, so with only the low-power request alive, transitions can be reported later until movement restores full accuracy | Region monitoring is run by the system and is not changed |

On both platforms the reduction is a degrade, never a stop: it applies only to trips that are not `foregroundOnly` and do not use `PASSIVE` or `NO_POWER` accuracy, and full accuracy returns when movement or a vehicle is detected or the device moves away. See [How the Reduction Works](../guides/motion-activity.md#how-the-reduction-works) and [Geofencing While Reduced](../guides/motion-activity.md#geofencing-while-reduced).

### Motion Permission Status Mapping

| MotionPermissionStatus | Android | iOS |
|---|---|---|
| `GRANTED` | `ACTIVITY_RECOGNITION` granted (API 29+), or the Play services permission granted at install time because it is declared (API 28 and lower) | Motion & Fitness authorized |
| `DENIED` | Not granted, including never requested and "never ask again" | Denied or restricted |
| `UNDETERMINED` | Never returned | Not requested yet, or not answered (for example, requested while the app was not active) |
| `UNAVAILABLE` | Google Play services not available | CoreMotion code not compiled in, `NSMotionUsageDescription` missing or blank, or no motion hardware |

`checkMotionPermission()` never prompts. Call [`requestMotionPermission()`](../api-reference/functions.md#motion-activity-functions) before `startTracking()`; `startTracking()` never prompts for it. See [`MotionPermissionStatus`](../api-reference/enums.md#motionpermissionstatus) and [Requesting the Permission](../guides/motion-activity.md#requesting-the-permission).

## Crash Recovery

| Aspect | Android | iOS |
|---|---|---|
| Recovery mechanism | WorkManager (Android 12+) or direct service restart | RecoveryManager + Significant Location Monitoring |
| Wake-up trigger | WorkManager scheduled task | Significant location change event (cell tower) |
| Re-launch capability | Service restarts within same process | iOS re-launches the entire app in background |
| Stop token | SharedPreferences, 60-second validity | UserDefaults, 60-second validity |
| Restart loop limit | 5 restarts per hour | 5 recoveries per hour |
| Recovery after reboot | Service does not restart after reboot | Significant location monitoring survives reboot |
| User force-quit | Service may survive (manufacturer-dependent) | No recovery (Apple enforces user intent) |

## Notifications and Indicators

| Aspect | Android | iOS |
|---|---|---|
| Notification required | Yes (foreground service must show notification) | No notification concept |
| Notification title | Customizable via `notificationOptions.title` | Not applicable |
| Notification text | Customizable via `notificationOptions.text` | Not applicable |
| Notification icon | Customizable via `notificationOptions.smallIcon` | Not applicable |
| Notification color | Customizable via `notificationOptions.color` | Not applicable |
| Notification actions | Up to 3 action buttons via `notificationOptions.actions` | Not applicable |
| Notification channel | Customizable via `notificationOptions.channelId` | Not applicable |
| Update notification | `updateNotification(title, text)` | No-op (returns successfully) |
| Background indicator | Notification in shade | Blue status bar / Dynamic Island |

> **Cross-platform tip:** You can pass `notificationOptions` on iOS without error. The values are parsed and stored but have no visible effect on the notification UI. This means you can use the same `TrackingOptions` object on both platforms without platform-specific branching.

## TrackingOptions: Platform Applicability

| Option | Android | iOS | Notes |
|---|---|---|---|
| `accuracy` | Applied | Applied | Different native mappings (see Accuracy table) |
| `activityType` | Ignored | Applied | Maps to `CLLocationManager.activityType`. Defaults to `LocationActivityType.OTHER`. iOS-only hint. |
| `updateInterval` | Applied | Stored only | iOS does not support interval-based updates; uses distance filter |
| `fastestInterval` | Applied | Ignored | Android-only FusedLocationProvider feature |
| `maxWaitTime` | Applied | Ignored | Android-only batching parameter |
| `waitForAccurateLocation` | Applied | Stored only | iOS relies on `desiredAccuracy` instead |
| `distanceFilter` | Applied | Applied | Both platforms support minimum distance between updates |
| `foregroundOnly` | Applied | Applied | Controls `allowsBackgroundLocationUpdates` on iOS |
| `notificationOptions` | Applied | Stored only | Unified notification config object; no visible effect on iOS |
| `.title` | Applied | Ignored | Foreground service notification title |
| `.text` | Applied | Ignored | Foreground service notification body text |
| `.smallIcon` | Applied | Ignored | Android drawable resource name for the small icon |
| `.largeIcon` | Applied | Ignored | Android drawable resource name for the large icon |
| `.color` | Applied | Ignored | Hex color string for notification accent color |
| `.showTimestamp` | Applied | Ignored | Whether to show timestamp on the notification |
| `.subtext` | Applied | Ignored | Subtext displayed below the notification content |
| `.channelId` | Applied | Ignored | Android notification channel ID |
| `.channelName` | Applied | Ignored | Android notification channel name |
| `.priority` | Applied | Ignored | Notification priority (`NotificationPriority` enum) |
| `.actions` | Applied | Ignored | Up to 3 action buttons on the notification |
| `onUpdateInterval` | Applied | Applied | JS-level throttling, works on both platforms |
| `motionActivity` | Applied | Applied | Opt-in motion activity detection, off by default. iOS also needs the CoreMotion code compiled in (Podfile flag or Expo plugin prop) |
| `.sampleInterval` | Applied | Ignored | Activity Recognition sampling interval (default 30000 ms); CoreMotion reports changes as they happen |
| `.reduceWhenStationary` | Applied | Applied | Opt-in reduction (never a stop) of location updates while stationary |
| `.reduceWhenStationary.stationaryDelay` | Applied | Applied | Continuous high-confidence stationary time before reducing (default 5 minutes) |
| `.reduceWhenStationary.automotiveCooldown` | Applied | Applied | Minimum time since the last vehicle evidence, and since the session started, before reducing (default 10 minutes) |
| `.reduceWhenStationary.maxReducedDuration` | Applied | Applied | Longest reduced period before one full-accuracy fix is forced (default 30 minutes) |
| `.reduceWhenStationary.notificationText` | Applied | Ignored | Foreground-notification text while updates are reduced |

## Events

Both platforms emit the same events through `NativeEventEmitter` with the same data format.

### Location Update Event

| Field | Android | iOS | Notes |
|---|---|---|---|
| `tripId` | Present | Present | Same value |
| `latitude` | String | String | Same format |
| `longitude` | String | String | Same format |
| `timestamp` | Milliseconds since epoch | Milliseconds since epoch | Same format |
| `accuracy` | Horizontal accuracy (meters) | Horizontal accuracy (meters) | Same meaning |
| `altitude` | Meters above sea level | Meters above sea level | Same meaning |
| `speed` | Meters per second | Meters per second | Same meaning |
| `bearing` | Degrees (0-360) | Degrees (0-360, from `course`) | Same meaning |
| `verticalAccuracyMeters` | Available (API 26+) | Available | Same meaning |
| `speedAccuracyMetersPerSecond` | Available (API 26+) | Available | Same meaning |
| `bearingAccuracyDegrees` | Available (API 26+) | Available (from `courseAccuracy`) | Same meaning |
| `elapsedRealtimeNanos` | Available | Not available | Android-only |
| `provider` | "gps", "network", "passive" | "gps" or "simulated" | Different values |
| `isFromMockProvider` | Available (API 18+) | Available (from `sourceInformation`) | Same meaning |

### Warning Events

| Warning Type | Android | iOS |
|---|---|---|
| `SERVICE_TIMEOUT` | Emitted on Android 15+ service timeout | Not emitted (no service concept) |
| `TASK_REMOVED` | Emitted when app is swiped from recents | Not emitted |
| `LOCATION_UNAVAILABLE` | Emitted when GPS signal lost (not while motion reduction is active, except during its full-accuracy probe) | Emitted when CLLocationManager fails (not while motion reduction is active, except during its full-accuracy probe) |
| `LOCATION_UPDATES_PAUSED` | Not emitted | Emitted when iOS pauses updates for battery |
| `LOCATION_UPDATES_RESUMED` | Not emitted | Emitted when iOS resumes paused updates |
| `PERMISSION_REVOKED` | Not emitted natively (handled by hooks) | Emitted when permission is revoked mid-session |
| `PERMISSION_DOWNGRADED` | Not applicable | Emitted when Always is downgraded to WhenInUse |
| `MOTION_LOCATION_REDUCED` | Emitted when a stationary period is confirmed and updates switch to the low-power profile | Emitted when a stationary period is confirmed and updates switch to the reduced profile |
| `MOTION_LOCATION_RESTORED` | Emitted when full accuracy returns: movement or vehicle detected, device moved, detection stopped, or tracking restarted (including Android 15+ service-timeout restarts) | Emitted when full accuracy returns: movement or vehicle detected, device moved, or detection stopped (a session never restarts in place on iOS) |
| `MOTION_ACTIVITY_UNAVAILABLE` | Google Play services not available, or the activity recognition registration failed | CoreMotion code not compiled in, `NSMotionUsageDescription` missing or blank, or no motion hardware |
| `MOTION_PERMISSION_NOT_GRANTED` | `ACTIVITY_RECOGNITION` not granted or not declared (API 29+), the Play services permission not declared (API 28 and lower), or the permission was revoked | Motion & Fitness not requested yet, denied or restricted, or revoked mid-trip |

> **Note:** From 1.2.0, every warning carries `timestamp` (milliseconds since epoch, taken when the native layer emits the warning) on both platforms, for the existing types and the new ones. Before 1.2.0 the field was declared but never sent. The `MOTION_*` warnings always carry the active trip's `tripId`, and the motion reduction never emits `LOCATION_UPDATES_PAUSED` or `LOCATION_UPDATES_RESUMED`. `LocationWarningType` now has 11 members; widening the union can break an exhaustive `switch` or `never` check at compile time, so keep a `default` branch. See [Warnings](../guides/motion-activity.md#warnings) for the exact motion warning messages.

## Store Compliance

| Requirement | Google Play (Android) | App Store (iOS) |
|---|---|---|
| Compliance guide | [Google Play Compliance](./google-play-compliance.md) | [App Store Compliance](./app-store-compliance.md) |
| In-app disclosure | Required (blocking dialog before permission) | Not required (but recommended for good UX) |
| Usage descriptions | Not applicable | Required (Info.plist keys) |
| Privacy policy | Required (must mention location) | Required (must mention location) |
| Data safety / nutrition labels | Play Console Data Safety form | App Store Connect Privacy labels |
| Permission justification | Permissions declaration form in Play Console | Review notes + justification text |
| Demo video | Required for background location | Not required (but helpful for review) |
| Privacy manifest | Not applicable | Required (PrivacyInfo.xcprivacy) |
| Motion activity permission | The app declares and requests `ACTIVITY_RECOGNITION` (runtime on Android 10+); the library manifest adds none. Google Play treats it as health-related sensitive data: prominent disclosure and consent before the request, Health apps declaration, and Data safety (Health and fitness > Fitness info) when motion-derived data leaves the device | `NSMotionUsageDescription`, only when the CoreMotion code is compiled in |

## Testing Differences

| Scenario | Android | iOS |
|---|---|---|
| Simulated location | `adb shell` commands, mock location apps | Xcode scheme GPX files, Simulator menu |
| Background testing | Works reliably on emulator | Works on Simulator, but significant location does not |
| Device testing | Required for manufacturer-specific battery issues | Required for accurate battery and GPS behavior |
| Crash recovery | Can simulate via `adb shell am force-stop` | Can simulate via Xcode stop, but not force-quit |
| Permission reset | Settings > Apps > Permissions | Settings > Privacy > Location Services |
| Battery simulation | `adb shell dumpsys deviceidle force-idle` | No equivalent (must test on device) |
| Motion activity | Physical device with Google Play services (real sensors and Doze cannot be reproduced on an emulator) | Physical device with the CoreMotion code compiled in |

## Cross-Platform Code Pattern

The library is designed so you can use the same code on both platforms:

```typescript
import {
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
    if (!permissionStatus.hasAllPermissions) {
      await requestPermissions();
    }

    // Same options work on both platforms
    // notificationOptions are silently ignored on iOS
    await startTracking({
      accuracy: LocationAccuracy.HIGH_ACCURACY,
      distanceFilter: 50,
      notificationOptions: {
        title: 'Tracking Active',   // Android only, ignored on iOS
        text: 'Recording your route', // Android only, ignored on iOS
      },
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

- [iOS Setup Guide](../getting-started/ios-setup.md) -- iOS-specific configuration
- [iOS Background Behavior](./ios-background-behavior.md) -- Deep dive into iOS background location
- [App Store Compliance](./app-store-compliance.md) -- iOS store requirements
- [Google Play Compliance](./google-play-compliance.md) -- Android store requirements
- [Geofencing](../guides/geofencing.md) -- Geofencing guide with platform details
- [Motion Activity](../guides/motion-activity.md) -- Opt-in motion activity detection and the stationary reduction
