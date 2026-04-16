---
sidebar_position: 4
title: iOS Setup
description: Complete iOS configuration guide for @gabriel-sisjr/react-native-background-location including Info.plist, Background Modes, CocoaPods, and privacy manifest.
keywords:
  - ios
  - setup
  - info-plist
  - background-modes
  - cocoapods
  - privacy-manifest
  - CLLocationManager
  - xcode
  - react-native
  - background-location
---

# iOS Setup

Complete setup guide for configuring `@gabriel-sisjr/react-native-background-location` on iOS.

## Prerequisites

| Requirement | Minimum Version | Notes |
|---|---|---|
| Xcode | 14.0+ | Required for Swift 5.7+ and iOS 16 SDK |
| CocoaPods | 1.13+ | Or use `bundler` to manage the version |
| iOS Deployment Target | 16.0+ | Set in both Podfile and Xcode project |
| React Native | 0.76+ | New Architecture (TurboModules) required |
| Node.js | 18+ | For Metro bundler |

## Step 1: Install CocoaPods Dependencies

After installing the npm package (see [Installation](./installation.md)):

```bash
cd ios && pod install && cd ..
```

If you encounter issues, try a clean install:

```bash
cd ios
rm -rf Pods Podfile.lock
pod install --repo-update
cd ..
```

## Step 2: Configure Info.plist

Add the following entries to `ios/<YourApp>/Info.plist`. All three `NSLocation*` keys are required for App Store approval.

```xml
<!-- Required: WhenInUse permission description -->
<key>NSLocationWhenInUseUsageDescription</key>
<string>We need your location to track your trips and routes.</string>

<!-- Required: Always permission description (for background tracking) -->
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>We need continuous location access to track trips even when
the app is in the background.</string>

<!-- Required: Legacy Always permission (backwards compatibility) -->
<key>NSLocationAlwaysUsageDescription</key>
<string>We need continuous location access to track trips even when
the app is in the background.</string>

<!-- Background Modes declaration -->
<key>UIBackgroundModes</key>
<array>
    <string>location</string>
</array>
```

> **Important:** All three `NSLocation*` keys are required. `NSLocationAlwaysUsageDescription` is needed for backwards compatibility with iOS versions prior to the "Always and When In Use" split. Apple will reject apps that are missing any of these keys when requesting Always authorization.

### Usage Description Guidelines

Apple reviews these strings carefully during App Review. They must:

- Be written in clear, user-facing language (not technical jargon)
- Explain **why** your app needs location access
- Be specific to your app's functionality
- Be localized if your app supports multiple languages

**Good examples:**

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>We use your location to show your current position on the map
and record trip routes while you are using the app.</string>

<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>We use your location in the background to continuously record
your trip route, even when the app is not visible. This ensures
complete and accurate trip records for fleet management.</string>
```

**Examples that will likely cause rejection:**

```xml
<!-- Too vague -->
<string>This app uses your location.</string>

<!-- Too technical -->
<string>Required for CLLocationManager background updates via
CoreLocation framework.</string>
```

## Step 3: Enable Background Modes in Xcode

1. Open your `.xcworkspace` file in Xcode (not `.xcodeproj`)
2. Select your app target
3. Go to the **Signing & Capabilities** tab
4. Click **+ Capability**
5. Search for and add **Background Modes**
6. Check **Location updates**

> **Warning:** If you skip this step, setting `allowsBackgroundLocationUpdates = true` at runtime without the entitlement will cause iOS to throw an `NSInternalInconsistencyException` that crashes your app.

You can verify this is configured correctly by checking that your `Info.plist` contains:

```xml
<key>UIBackgroundModes</key>
<array>
    <string>location</string>
</array>
```

## Step 4: Privacy Manifest (iOS 17+)

The library includes a `PrivacyInfo.xcprivacy` file that is automatically bundled via CocoaPods. It declares:

- **Precise Location** (`NSPrivacyCollectedDataTypePreciseLocation`) -- collected for app functionality
- **Coarse Location** (`NSPrivacyCollectedDataTypeCoarseLocation`) -- collected for app functionality
- No tracking domains
- No tracking

You do **not** need to add a separate privacy manifest for the library. However, your **app-level** `PrivacyInfo.xcprivacy` must also declare location data collection for App Store submissions targeting iOS 17+.

## Step 5: Notification Permission

No additional `Info.plist` keys are required for notification permission. The library requests notification authorization at runtime via `UNUserNotificationCenter.requestAuthorization()`. This is handled automatically by the `useLocationPermissions` hook.

Notification permission is separate from location permission:

- Notification denial does **not** block tracking or geofence detection
- Only visual notification display is affected (e.g., geofence transition alerts)
- iOS shows the notification permission dialog **once**. If the user denies, they must re-enable it in Settings

## iOS Platform Behavior

Unlike Android, iOS handles background location differently:

| Aspect | iOS Behavior |
|---|---|
| Background indicator | Blue status bar (no notification) |
| Notification options | Silently ignored (Android-only feature) |
| Location provider | CLLocationManager |
| Permission flow | WhenInUse first, then Always escalation |
| Crash recovery | Significant location monitoring |
| Storage | Core Data (SQLite) |

The `notificationOptions` field in `TrackingOptions` is accepted without error on iOS but has no effect. iOS always uses the system blue status bar indicator for background location.

## Troubleshooting

### pod install Fails

**"CocoaPods could not find compatible versions":**

```bash
pod repo update
cd ios
rm -rf Pods Podfile.lock
pod install --repo-update
```

**"Unable to find a specification for BackgroundLocation":**

The library is auto-linked by React Native. Ensure your `Podfile` does not manually specify the pod. Your `Podfile` should include:

```ruby
# Required for TurboModules
use_frameworks! :linkage => :static
```

### Missing Background Modes Capability

**Symptom:** App crashes with `NSInternalInconsistencyException` when starting background tracking.

**Fix:** Follow Step 3 above to enable the "Location updates" background mode. Verify `UIBackgroundModes` contains `location` in your `Info.plist`.

### Location Not Working in Simulator

The iOS Simulator has limited location support:

- **Simulated locations work** -- Use Debug > Location > Custom Location in the Simulator menu
- **Movement simulation** -- Use Debug > Location > Freeway Drive or City Run
- **Significant location changes do not work** -- Crash recovery will not fire in the simulator

For thorough testing, always use a **physical device**.

### Location Updates Stop After a Few Minutes

1. Verify you have **Always** permission, not just **When In Use**
2. Check that Background Modes > Location updates is enabled
3. Ensure `foregroundOnly` is not set to `true` in your tracking options

### Build Errors After Adding the Library

```bash
# Clean Xcode derived data
rm -rf ~/Library/Developer/Xcode/DerivedData

# Clean and rebuild
cd ios
rm -rf Pods Podfile.lock build
pod install
cd ..
```

### Core Data Model Not Found

**Symptom:** App crashes with "Failed to load Core Data model 'BackgroundLocationModel'"

1. Run `pod install` again
2. Check that `BackgroundLocationCoreData` appears in your Xcode project under Pods
3. Clean build folder (Product > Clean Build Folder in Xcode)

### Permission Dialog Not Appearing

iOS only shows each permission dialog **once**. If the user previously denied:

- **Location:** Settings > Privacy & Security > Location Services > Your App
- **Notifications:** Settings > Your App > Notifications

Check the current status before directing users:

```tsx
import { useLocationPermissions } from '@gabriel-sisjr/react-native-background-location';

const { permissionStatus } = useLocationPermissions();

// If denied or blocked, direct to Settings
if (
  permissionStatus.location.status === 'denied' ||
  permissionStatus.location.status === 'blocked'
) {
  // Open app settings
  Linking.openURL('app-settings:');
}
```

## Verification Checklist

After setup, verify the following:

- [ ] `pod install` completes without errors
- [ ] App builds and runs on simulator
- [ ] Info.plist contains all three `NSLocation*` usage description keys
- [ ] Info.plist contains `UIBackgroundModes` with `location`
- [ ] Background Modes capability is visible in Xcode
- [ ] Location permission dialog appears when calling `requestPermissions()`
- [ ] Notification permission dialog appears after location permission is granted
- [ ] Location updates arrive when tracking starts
- [ ] Blue status bar indicator appears during background tracking
- [ ] App continues to receive location updates when backgrounded (with Always permission)

## Next Steps

- [Permissions](./permissions.md) -- Cross-platform permission model in depth
- [Quick Start](./quick-start.md) -- Build a working tracking screen
- [App Store Compliance](../production/app-store-compliance.md) -- Requirements before submitting to the App Store
