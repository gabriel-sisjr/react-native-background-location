# iOS Setup Guide

Complete setup guide for using `@gabriel-sisjr/react-native-background-location` on iOS.

## Prerequisites

| Requirement           | Minimum Version | Notes                                    |
| --------------------- | --------------- | ---------------------------------------- |
| Xcode                 | 14.0+           | Required for Swift 5.7+ and iOS 16 SDK   |
| CocoaPods             | 1.13+           | Or use `bundler` to manage the version   |
| iOS Deployment Target | 16.0+           | Set in both Podfile and Xcode project    |
| React Native          | 0.76+           | New Architecture (TurboModules) required |
| Node.js               | 18+             | For Metro bundler                        |

## Step 1: Install the Library

```bash
npm install @gabriel-sisjr/react-native-background-location
# or
yarn add @gabriel-sisjr/react-native-background-location
```

## Step 2: Install CocoaPods Dependencies

```bash
cd ios && pod install && cd ..
```

If you use the example app:

```bash
cd example/ios && pod install && cd ../..
```

## Step 3: Configure Info.plist

Add the following entries to your app's `Info.plist` (or `ios/<YourApp>/Info.plist`):

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>This app needs your location to track your trips and routes.</string>

<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>This app needs continuous access to your location to track trips even when the app is in the background.</string>

<key>NSLocationAlwaysUsageDescription</key>
<string>This app needs continuous access to your location to track trips even when the app is in the background.</string>

<key>UIBackgroundModes</key>
<array>
    <string>location</string>
</array>
```

> **Important:** All three `NSLocation*` keys are required. `NSLocationAlwaysUsageDescription` is needed for backwards compatibility with iOS versions prior to the "Always and When In Use" split. Apple will reject apps that are missing any of these keys when requesting Always authorization.

### Usage Description Guidelines

Apple reviews these strings carefully. They must:

- Be written in clear, user-facing language (not technical jargon)
- Explain **why** your app needs location access
- Be specific to your app's functionality
- Be localized if your app supports multiple languages

**Good examples:**

```xml
<!-- Fleet management app -->
<key>NSLocationWhenInUseUsageDescription</key>
<string>We use your location to show your current position on the map and record trip routes while you are using the app.</string>

<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>We use your location in the background to continuously record your trip route, even when the app is not visible. This ensures complete and accurate trip records for fleet management.</string>
```

**Bad examples (will likely cause rejection):**

```xml
<!-- Too vague -->
<string>This app uses your location.</string>

<!-- Too technical -->
<string>Required for CLLocationManager background updates via CoreLocation framework.</string>
```

## Step 4: Enable Background Modes in Xcode

1. Open your Xcode project (`.xcworkspace` file, not `.xcodeproj`)
2. Select your app target
3. Go to the **Signing & Capabilities** tab
4. Click **+ Capability**
5. Search for and add **Background Modes**
6. Check **Location updates**

Alternatively, verify your `Info.plist` contains:

```xml
<key>UIBackgroundModes</key>
<array>
    <string>location</string>
</array>
```

> **Note:** If you skip this step, `allowsBackgroundLocationUpdates` will be set to `true` at runtime without the entitlement, and iOS will throw an exception that crashes your app.

## Step 5: Privacy Manifest

The library includes a `PrivacyInfo.xcprivacy` file that is automatically bundled via CocoaPods. It declares:

- **Precise Location** (`NSPrivacyCollectedDataTypePreciseLocation`) -- collected for app functionality
- **Coarse Location** (`NSPrivacyCollectedDataTypeCoarseLocation`) -- collected for app functionality
- No tracking domains
- No tracking

You do not need to add a separate privacy manifest for the library. However, your **app-level** `PrivacyInfo.xcprivacy` must also declare location data collection. See [App Store Compliance](../production/APP_STORE_COMPLIANCE.md) for details.

## Step 6: Request Permissions in Your App

iOS uses a two-step permission flow:

1. **When In Use** -- User grants foreground location access
2. **Always** -- User upgrades to background location access (required for geofencing and reliable background tracking)

The library handles this flow automatically via `requestLocationPermission`:

```typescript
import BackgroundLocation from '@gabriel-sisjr/react-native-background-location';

// Request full background location permission (WhenInUse -> Always)
const result = await BackgroundLocation.requestLocationPermission(false);
// result.status: 'granted' | 'whenInUse' | 'denied' | 'blocked' | 'undetermined'

// Request only foreground (When In Use) permission
const foregroundResult =
  await BackgroundLocation.requestLocationPermission(true);
```

Use the hook to request permissions, which handles the full flow including WhenInUse-to-Always escalation on iOS:

```typescript
import { useLocationPermissions } from '@gabriel-sisjr/react-native-background-location';

function App() {
  const {
    permissionStatus,
    requestPermissions,
    checkPermissions,
    isRequesting,
  } = useLocationPermissions();

  const handleGrantPermissions = async () => {
    const granted = await requestPermissions();
    if (granted) {
      // Ready to start tracking
    }
  };

  return (
    <View>
      <Text>Status: {permissionStatus.status}</Text>
      <Button
        title="Grant Permissions"
        onPress={handleGrantPermissions}
        disabled={isRequesting}
      />
    </View>
  );
}
```

> **Geofencing note:** Ensure permissions are granted via `requestPermissions()` before calling `addGeofence()` or `addGeofences()`. The `requestPermissions()` function handles the full iOS permission flow including WhenInUse-to-Always escalation.

### Permission Status Values on iOS

| Status         | CLAuthorizationStatus  | Meaning                                                           |
| -------------- | ---------------------- | ----------------------------------------------------------------- |
| `undetermined` | `.notDetermined`       | User has not been asked yet                                       |
| `whenInUse`    | `.authorizedWhenInUse` | Foreground only -- background tracking works while app is visible |
| `granted`      | `.authorizedAlways`    | Full background tracking support                                  |
| `denied`       | `.denied`              | User explicitly denied                                            |
| `blocked`      | `.restricted`          | Restricted by parental controls or MDM                            |

## Step 7: Start Tracking

```typescript
import BackgroundLocation, {
  LocationAccuracy,
} from '@gabriel-sisjr/react-native-background-location';

const tripId = await BackgroundLocation.startTracking({
  accuracy: LocationAccuracy.HIGH_ACCURACY,
  distanceFilter: 50,
  // Notification options are ignored on iOS (no foreground service)
  notificationTitle: 'Tracking Active',
  notificationText: 'Recording your route',
});

console.log('Tracking started:', tripId);
```

> **Note:** Notification-related options (`notificationTitle`, `notificationText`, `notificationSmallIcon`, etc.) are accepted without error but have no effect on iOS. iOS shows a blue status bar indicator instead. See [Platform Comparison](../production/PLATFORM_COMPARISON.md) for details.

## Troubleshooting

### `pod install` Fails

**Error: "CocoaPods could not find compatible versions"**

```bash
# Update CocoaPods repo
pod repo update

# Clean and reinstall
cd ios
rm -rf Pods Podfile.lock
pod install --repo-update
```

**Error: "Unable to find a specification for BackgroundLocation"**

Ensure your `Podfile` does not manually specify the pod. The library is auto-linked by React Native's autolinking mechanism. Your `Podfile` should include:

```ruby
# Required for TurboModules
use_frameworks! :linkage => :static
```

### Missing Background Modes Capability

**Symptom:** App crashes with `NSInternalInconsistencyException` when starting background tracking.

**Fix:** Follow Step 4 above to enable the "Location updates" background mode in Xcode. Verify `UIBackgroundModes` contains `location` in your `Info.plist`.

### Location Not Working in Simulator

The iOS Simulator has limited location support:

- **Simulated locations work** -- Use Debug > Location > Custom Location in the Simulator menu, or set a GPX file in Xcode's scheme editor
- **Background location works** -- The simulator does support background location updates
- **Movement simulation** -- Use Debug > Location > Freeway Drive or City Run for movement simulation
- **Significant location changes do not work** -- The simulator cannot trigger significant location change events (crash recovery will not fire)

For thorough testing, always use a **physical device**.

### Location Updates Stop After a Few Minutes

1. Verify you have **Always** permission, not just **When In Use**
2. Check that Background Modes > Location updates is enabled
3. Ensure `foregroundOnly` is not set to `true` in your tracking options
4. Check `pausesLocationUpdatesAutomatically` -- the library sets this to `false` by default

### Build Errors After Adding the Library

```bash
# Clean Xcode derived data
rm -rf ~/Library/Developer/Xcode/DerivedData

# Clean and rebuild
cd ios
rm -rf Pods Podfile.lock build
pod install
cd ..
yarn example ios
```

### Core Data Model Not Found

**Symptom:** App crashes with "Failed to load Core Data model 'BackgroundLocationModel'"

This means the `.xcdatamodeld` file was not bundled correctly. Verify:

1. Run `pod install` again
2. Check that `BackgroundLocationCoreData` appears in your Xcode project under Pods
3. Clean build folder (Product > Clean Build Folder in Xcode)

### Permission Dialog Not Appearing

- iOS only shows the permission dialog **once**. If the user previously denied, they must go to Settings > Privacy & Security > Location Services > Your App
- Check `checkLocationPermission()` first to see current status
- If status is `denied` or `blocked`, direct the user to Settings:

```typescript
import { Linking, Platform } from 'react-native';

if (Platform.OS === 'ios') {
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
- [ ] Permission dialog appears when calling `requestLocationPermission`
- [ ] Location updates arrive when tracking starts
- [ ] Blue status bar indicator appears during background tracking
- [ ] App continues to receive location updates when backgrounded (with Always permission)

## See Also

- [Quick Start Guide](./QUICKSTART.md) -- Getting started with the library
- [Hooks Guide](./hooks.md) -- Using React hooks for location tracking
- [App Store Compliance](../production/APP_STORE_COMPLIANCE.md) -- Before publishing to the App Store
- [iOS Background Behavior](../production/IOS_BACKGROUND_BEHAVIOR.md) -- How iOS handles background location
- [Platform Comparison](../production/PLATFORM_COMPARISON.md) -- Android vs iOS differences
