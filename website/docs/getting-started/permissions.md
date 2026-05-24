---
sidebar_position: 5
title: Permissions
description: Cross-platform guide to location and notification permissions on Android and iOS for @gabriel-sisjr/react-native-background-location.
keywords:
  - permissions
  - location-permissions
  - android-permissions
  - ios-permissions
  - background-location
  - notification-permission
  - useLocationPermissions
  - react-native
  - ACCESS_BACKGROUND_LOCATION
  - CLLocationManager
---

# Permissions

Background location tracking requires runtime permissions on both Android and iOS. This guide covers the permission model for each platform, the recommended hook-based approach, and the manual PermissionsAndroid alternative for Android.

## The useLocationPermissions Hook (Recommended)

The `useLocationPermissions` hook provides a unified cross-platform permission API. It handles the correct multi-step sequencing on both platforms automatically.

```tsx
import {
  useLocationPermissions,
  LocationPermissionStatus,
  NotificationPermissionStatus,
} from '@gabriel-sisjr/react-native-background-location';

function PermissionGate({ children }: { children: React.ReactNode }) {
  const {
    permissionStatus,
    requestPermissions,
    checkPermissions,
    isRequesting,
  } = useLocationPermissions();

  if (!permissionStatus.location.hasPermission) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: 20 }}>
        <Text>Location permission is required to track trips.</Text>
        <Button
          title={isRequesting ? 'Requesting...' : 'Grant Permissions'}
          onPress={requestPermissions}
          disabled={isRequesting}
        />
        {permissionStatus.location.status ===
          LocationPermissionStatus.BLOCKED && (
          <Button
            title="Open Settings"
            onPress={() => Linking.openSettings()}
          />
        )}
      </View>
    );
  }

  return <>{children}</>;
}
```

### Permission State Shape

The `permissionStatus` object returned by the hook uses a granular nested structure:

```typescript
interface PermissionState {
  hasAllPermissions: boolean; // true only when both location AND notification are granted
  location: {
    hasPermission: boolean; // true if location access is granted
    status: LocationPermissionStatus;
    canRequestAgain: boolean;
  };
  notification: {
    hasPermission: boolean; // true if notification permission is granted
    status: NotificationPermissionStatus;
    canRequestAgain: boolean; // true only when status is UNDETERMINED
  };
}
```

> **Note:** `hasAllPermissions` requires both location **and** notification permissions. If you only need to check location (which is sufficient for tracking), use `permissionStatus.location.hasPermission` instead.

### Return Values

| Property             | Type                                                        | Description                                                                                                                                                                                                                             |
| -------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `permissionStatus`   | `PermissionState`                                           | Current state of location and notification permissions                                                                                                                                                                                  |
| `requestPermissions` | `(options?: RequestPermissionsOptions) => Promise<boolean>` | Requests all permissions. Returns `true` if location is granted. Accepts an optional `options.backgroundRationale` for localized Android dialog copy (see [Localized Permission Rationales](#localized-permission-rationales-android)). |
| `checkPermissions`   | `() => Promise<boolean>`                                    | Checks current status without prompting. Returns `true` if location is granted                                                                                                                                                          |
| `isRequesting`       | `boolean`                                                   | `true` while a permission request is in progress                                                                                                                                                                                        |

### What requestPermissions Does

On **Android**, `requestPermissions()` executes three sequential steps:

1. Requests `ACCESS_FINE_LOCATION` + `ACCESS_COARSE_LOCATION` (foreground)
2. Requests `ACCESS_BACKGROUND_LOCATION` separately (Android 10+)
3. Requests `POST_NOTIFICATIONS` (Android 13+) or checks via native module (older versions)

On **iOS**, `requestPermissions()` executes two sequential steps:

1. Requests location permission with WhenInUse-to-Always escalation via `CLLocationManager`
2. Requests notification permission via `UNUserNotificationCenter`

Notification permission denial is **non-blocking** -- `requestPermissions()` returns `true` as long as location permission is granted. Check `permissionStatus.notification` separately if you need notification state.

## Android Permission Model

Android uses a layered permission system where each permission level must be requested separately and in the correct order.

### Required Manifest Permissions

These must be declared in `AndroidManifest.xml` (see [Installation](./installation.md)):

| Permission                    | When Required         | Purpose                              |
| ----------------------------- | --------------------- | ------------------------------------ |
| `ACCESS_FINE_LOCATION`        | Always                | GPS-based location                   |
| `ACCESS_COARSE_LOCATION`      | Always                | Network-based location               |
| `ACCESS_BACKGROUND_LOCATION`  | Android 10+ (API 29+) | Location when app is not visible     |
| `FOREGROUND_SERVICE`          | Always                | Required for background service      |
| `FOREGROUND_SERVICE_LOCATION` | Android 14+ (API 34+) | Foreground service type declaration  |
| `POST_NOTIFICATIONS`          | Android 13+ (API 33+) | Show foreground service notification |

### Runtime Permission Flow

The correct order for requesting permissions on Android is critical. Requesting background and foreground permissions together will **silently fail** on Android 11+.

```text
Step 1: Foreground Location
  ACCESS_FINE_LOCATION + ACCESS_COARSE_LOCATION
    |
    v
Step 2: Background Location (Android 10+)
  ACCESS_BACKGROUND_LOCATION
  (must be a separate request)
    |
    v
Step 3: Notification (Android 13+)
  POST_NOTIFICATIONS
```

### Android API Level Differences

| API Level | Android Version | Permission Behavior                                                                    |
| --------- | --------------- | -------------------------------------------------------------------------------------- |
| 24-28     | 7.0 -- 9.0      | Foreground permission grants background access automatically                           |
| 29        | 10              | Background location requires separate `ACCESS_BACKGROUND_LOCATION` request             |
| 30+       | 11+             | Background location must be requested **separately** (combined request silently fails) |
| 33+       | 13+             | Notification permission (`POST_NOTIFICATIONS`) required at runtime                     |
| 34+       | 14+             | `FOREGROUND_SERVICE_LOCATION` type must be declared                                    |

### Manual Android Permissions (Without Hook)

If you prefer to manage permissions manually using React Native's `PermissionsAndroid` API:

```typescript
import { PermissionsAndroid, Platform, Alert, Linking } from 'react-native';

async function requestLocationPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  // Step 1: Request foreground permissions
  const foreground = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
  ]);

  const foregroundGranted =
    foreground['android.permission.ACCESS_FINE_LOCATION'] === 'granted' ||
    foreground['android.permission.ACCESS_COARSE_LOCATION'] === 'granted';

  if (!foregroundGranted) {
    return false;
  }

  // Step 2: Request background permission (Android 10+)
  if (Number(Platform.Version) >= 29) {
    // Show rationale before the system dialog
    await new Promise<void>((resolve) => {
      Alert.alert(
        'Background Location',
        'To track your location when the app is closed, please select ' +
          '"Allow all the time" on the next screen.',
        [{ text: 'Continue', onPress: () => resolve() }]
      );
    });

    const background = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION
    );

    if (background !== 'granted') {
      return false;
    }
  }

  // Step 3: Request notification permission (Android 13+)
  if (Number(Platform.Version) >= 33) {
    await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
    );
    // Notification denial is non-blocking for tracking
  }

  return true;
}
```

### Checking Android Permissions

```typescript
async function checkPermissions(): Promise<{
  foreground: boolean;
  background: boolean;
  notification: boolean;
}> {
  if (Platform.OS !== 'android') {
    return { foreground: true, background: true, notification: true };
  }

  const fine = await PermissionsAndroid.check(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
  );
  const coarse = await PermissionsAndroid.check(
    PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION
  );
  const background =
    Number(Platform.Version) >= 29
      ? await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION
        )
      : true;
  const notification =
    Number(Platform.Version) >= 33
      ? await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
        )
      : true;

  return {
    foreground: fine || coarse,
    background,
    notification,
  };
}
```

### Handling "Never Ask Again" (Android)

When a user selects "Don't ask again" on Android, you can no longer show the system permission dialog. Direct them to Settings:

```typescript
const result = await PermissionsAndroid.request(
  PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
);

if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
  Alert.alert(
    'Permission Required',
    'Location permission was permanently denied. Please enable it in Settings.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Open Settings', onPress: () => Linking.openSettings() },
    ]
  );
}
```

The hook handles this automatically -- check `permissionStatus.location.status === 'blocked'` and `canRequestAgain === false`.

## Localized Permission Rationales (Android)

The `requestPermissions` closure returned by `useLocationPermissions` accepts an optional `backgroundRationale` field that controls the copy shown in the `ACCESS_BACKGROUND_LOCATION` system dialog on Android API 29+.

The feature is **opt-in and non-breaking** -- existing zero-arg `requestPermissions()` calls continue to work unchanged and use the built-in English defaults.

### Usage

```tsx
import { useLocationPermissions } from '@gabriel-sisjr/react-native-background-location';

function PermissionGate() {
  const { requestPermissions } = useLocationPermissions();

  const handleGrant = async () => {
    const granted = await requestPermissions({
      backgroundRationale: {
        title: 'Permissão de localização',
        message:
          'Precisamos da sua localização em segundo plano para registrar suas viagens.',
        buttonPositive: 'Permitir',
        buttonNegative: 'Cancelar',
        buttonNeutral: 'Mais tarde',
      },
    });

    if (!granted) {
      // handle denial
    }
  };

  return <Button title="Grant Permissions" onPress={handleGrant} />;
}
```

### Behavior

- **Opt-in.** Both `requestPermissions()` and `requestPermissions({})` continue to surface the built-in English defaults. Pass `backgroundRationale` only when you need localized copy.
- **Android API 29+ only.** The option is wired exclusively into the `PermissionsAndroid.request(ACCESS_BACKGROUND_LOCATION, ...)` system dialog. It is silently ignored on iOS, on Android < 29, on the foreground-only flow (`PermissionsAndroid.requestMultiple`), and on the `POST_NOTIFICATIONS` request.
- **Per-field merge.** Each of the five fields (`title`, `message`, `buttonPositive`, `buttonNegative`, `buttonNeutral`) is resolved independently. Passing `{ title: 'Permissão' }` overrides only the title and leaves the other four fields at their English defaults.
- **Trim-then-truthy fallback.** Each field is trimmed; if the trimmed string is non-empty, it is used. Otherwise the default is used. This means `undefined`, `null`, `''`, and whitespace-only values (`'   '`, `'\t\n'`) all fall back to the default.
- **No native code involved.** The rationale never crosses the TurboModule bridge -- the merge happens in JavaScript and is forwarded directly to React Native's `PermissionsAndroid.request()`.

### Default English Strings

If a field is omitted or falls back, the library uses these built-in defaults:

| Field            | Default Value                                                                   |
| ---------------- | ------------------------------------------------------------------------------- |
| `title`          | `Background Location Permission`                                                |
| `message`        | `This app needs access to your location in the background to track your trips.` |
| `buttonPositive` | `OK`                                                                            |
| `buttonNegative` | `Cancel`                                                                        |
| `buttonNeutral`  | `Ask Me Later`                                                                  |

> **Note:** The default wording is internal and may evolve between minor versions without a SemVer bump. If you depend on exact wording (for QA, screenshots, or store review), pass an explicit `backgroundRationale` so your copy is the source of truth.

### Future Sibling Fields

The field is named `backgroundRationale` (not the generic `rationale`) so future releases can add `foregroundRationale` and `notificationRationale` as additional optional fields without a breaking rename. These siblings are **reserved** and not yet implemented.

See the [`useLocationPermissions` hook reference](../api-reference/hooks/useLocationPermissions.md#requestpermissions-parameters) and the [`PermissionRationale`](../api-reference/types.md#permissionrationale) / [`RequestPermissionsOptions`](../api-reference/types.md#requestpermissionsoptions) type entries for the full API contract.

## iOS Permission Model

iOS uses a two-tier location permission model and a separate notification permission.

### Permission Flow

```text
Step 1: WhenInUse Authorization
  CLLocationManager.requestWhenInUseAuthorization()
  User sees: "Allow While Using App" / "Don't Allow"
    |
    v
Step 2: Always Authorization (escalation)
  CLLocationManager.requestAlwaysAuthorization()
  User sees: "Change to Always Allow" / "Keep Only While Using"
    |
    v
Step 3: Notification Authorization
  UNUserNotificationCenter.requestAuthorization()
  User sees: "Allow Notifications" / "Don't Allow"
```

The `useLocationPermissions` hook handles all three steps when you call `requestPermissions()`.

### Location Permission Status Values

| Status         | CLAuthorizationStatus  | Meaning                                        |
| -------------- | ---------------------- | ---------------------------------------------- |
| `undetermined` | `.notDetermined`       | User has not been asked yet                    |
| `whenInUse`    | `.authorizedWhenInUse` | Foreground only -- app can track while visible |
| `granted`      | `.authorizedAlways`    | Full background tracking support               |
| `denied`       | `.denied`              | User explicitly denied                         |
| `blocked`      | `.restricted`          | Restricted by parental controls or MDM         |

### Notification Permission Status Values

| Status         | UNAuthorizationStatus | Meaning                             |
| -------------- | --------------------- | ----------------------------------- |
| `undetermined` | `.notDetermined`      | User has not been asked yet         |
| `granted`      | `.authorized`         | Notifications allowed               |
| `denied`       | `.denied`             | User denied -- tracking still works |

### iOS Permission Behavior

Key differences from Android:

- **One-shot dialogs:** iOS shows each permission dialog only **once**. If denied, the user must change the setting manually in Settings > Privacy & Security > Location Services
- **WhenInUse is partial:** With `whenInUse` permission, tracking works while the app is in the foreground or recently backgrounded, but is not reliable for long-term background tracking
- **Always is required for background:** For reliable background tracking, the user must grant "Always" permission
- **Notification is independent:** Notification denial does not affect location tracking or geofence detection -- only visual notification display
- **No foreground notification:** iOS uses a blue status bar indicator instead of a notification. All `notificationOptions` are silently ignored

### Directing Users to Settings (iOS)

When permission is denied on iOS, direct the user to the app's settings page:

```typescript
import { Linking, Platform } from 'react-native';

function openAppSettings() {
  if (Platform.OS === 'ios') {
    Linking.openURL('app-settings:');
  } else {
    Linking.openSettings();
  }
}
```

## Notification Permission

Notification permission is separate from location permission on both platforms:

| Platform              | When Required | Impact of Denial                                                       |
| --------------------- | ------------- | ---------------------------------------------------------------------- |
| Android 13+ (API 33+) | At runtime    | Foreground service notification may not appear, but tracking continues |
| Android < 13          | Auto-granted  | N/A                                                                    |
| iOS                   | At runtime    | Geofence transition alerts will not display, but detection continues   |

The hook requests notification permission as the final step after location permission. Notification denial is **non-blocking** -- the return value of `requestPermissions()` only reflects location permission status.

To check notification permission separately:

```tsx
const { permissionStatus } = useLocationPermissions();

if (!permissionStatus.notification.hasPermission) {
  console.warn('Notifications disabled -- geofence alerts will not appear');
}
```

## Permission Decision Tree

Use this to determine the minimum permissions your app needs:

| Use Case                              | Location Permission      | Background | Notification        |
| ------------------------------------- | ------------------------ | ---------- | ------------------- |
| Foreground-only tracking              | Foreground (fine/coarse) | Not needed | Optional            |
| Background tracking                   | Foreground + Background  | Required   | Recommended         |
| Background tracking + geofence alerts | Foreground + Background  | Required   | Required for alerts |

For foreground-only tracking, you can skip the background permission request entirely:

```tsx
import { startTracking } from '@gabriel-sisjr/react-native-background-location';

// No background permission needed
const tripId = await startTracking({
  foregroundOnly: true,
});
```

## Google Play and App Store Compliance

### Google Play (Android)

Before publishing to Google Play with background location:

1. **In-app disclosure:** Show a prominent explanation before requesting background location
2. **Privacy policy:** Disclose location data collection, background access, and data retention
3. **Play Console declarations:** Complete Data Safety Form and Sensitive App Permissions form

See the [Production guide](../production/google-play-compliance.md) for complete compliance details.

### App Store (iOS)

Apple reviews location usage descriptions during App Review:

1. All three `NSLocation*` Info.plist keys must be present and clearly written
2. Privacy manifest must declare location data collection
3. App must have a legitimate reason for "Always" authorization

See the [iOS Setup](./ios-setup.md) for Info.plist requirements.

## Next Steps

- [Quick Start](./quick-start.md) -- Start tracking with a working example
- [iOS Setup](./ios-setup.md) -- iOS-specific configuration details
- [Hooks Guide](../api-reference/hooks/useBackgroundLocation.md) -- Complete hooks API documentation
- [Google Play Compliance](../production/google-play-compliance.md) -- Publishing requirements for Android
