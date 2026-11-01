---
sidebar_position: 5
title: Production Checklist
description: Cross-platform pre-release checklist for apps using @gabriel-sisjr/react-native-background-location — permissions, compliance, functionality, user experience, testing, and performance.
keywords:
  - production checklist
  - release readiness
  - testing
  - permissions
  - compliance
  - background location
  - react-native
  - android
  - ios
---

# Production Checklist

Use this checklist before releasing an app that uses `@gabriel-sisjr/react-native-background-location`. It consolidates requirements from the platform-specific compliance guides into a single cross-platform reference.

## Permissions and Compliance

- [ ] Android 11+ two-step permission flow implemented (foreground, then background separately)
- [ ] In-app disclosure shown **before** permission request (required by Google Play)
- [ ] Permission denial handled gracefully (explain why, offer Settings redirect)
- [ ] Settings redirect for permanently blocked permissions (`Linking.openSettings()`)
- [ ] Privacy policy updated with location data disclosure (collection, usage, retention, deletion)
- [ ] Google Play Console Data Safety form completed
- [ ] Google Play Console permissions declaration submitted for `ACCESS_BACKGROUND_LOCATION`
- [ ] iOS Info.plist contains `NSLocationWhenInUseUsageDescription` and `NSLocationAlwaysAndWhenInUseUsageDescription`
- [ ] iOS `PrivacyInfo.xcprivacy` present at both library and app level
- [ ] App Store Connect Privacy Nutrition Labels configured

See the [Google Play Compliance](./google-play-compliance.md) and [App Store Compliance](./app-store-compliance.md) guides for full details on each requirement.

## Functionality

- [ ] Crash recovery implemented (`isTracking()` checked on app startup)
- [ ] Error handling for all tracking operations (try/catch or `onError` callback)
- [ ] Location data uploaded to server after trip ends
- [ ] Old data cleared after successful upload (`clearTrip()`)
- [ ] Tracking stops when no longer needed (no indefinite background tracking)
- [ ] Exhaustive `switch` statements or `never` checks over `LocationWarningType` keep a `default` branch (1.2.0 widened the union to 11 members, whether or not motion activity is enabled)

See the [Crash Recovery](../guides/crash-recovery.md) and [Background Tracking](../guides/background-tracking.md) guides for implementation patterns.

## User Experience

- [ ] Battery usage disclosed to users (especially on Android)
- [ ] Android foreground notification is clear and helpful (custom title and text)
- [ ] Loading states shown during tracking operations (`isLoading` from hooks)
- [ ] Errors displayed to users with actionable recovery options

See the [Battery Optimization](../guides/battery-optimization.md) and [Notification Customization](../guides/notification-customization.md) guides.

## Testing

### Cross-Platform

- [ ] Tested on real devices (not emulator/simulator alone)
- [ ] Tested app restart during active tracking (both platforms)
- [ ] Tested app kill (swipe from recents) and data recovery
- [ ] Tested poor GPS conditions (indoors, urban canyons)

### Android

- [ ] Tested on Android 10, 11, 12, 13, 14, 15
- [ ] Tested with battery optimization enabled
- [ ] Tested device reboot during active tracking
- [ ] Tested on manufacturer-specific ROMs (Xiaomi MIUI, Samsung OneUI, Huawei EMUI) if targeting those markets

### iOS

- [ ] Tested on iOS 16+ (minimum supported version)
- [ ] Tested WhenInUse to Always permission escalation flow
- [ ] Tested background tracking with blue status bar indicator visible
- [ ] Tested `foregroundOnly` mode pauses tracking when backgrounded

See the [Platform Comparison](./platform-comparison.md) guide for behavioral differences between Android and iOS.

## Performance

- [ ] Long trip memory management implemented (periodic upload or display capping)
- [ ] Coordinate string-to-number parsing verified for map libraries (`parseFloat()`)
- [ ] Optional `Coords` properties handled correctly (accuracy, altitude, speed may be `undefined`)
- [ ] `distanceFilter` configured appropriately for the use case to reduce battery drain

See the [Background Tracking](../guides/background-tracking.md#memory-management) guide for memory management strategies.

## Motion Activity (If Enabled)

Motion activity is off by default. Skip this section if your app does not set `motionActivity`.

- [ ] Android: `android.permission.ACTIVITY_RECOGNITION` and `com.google.android.gms.permission.ACTIVITY_RECOGNITION` (with `android:maxSdkVersion="28"`) declared in the app's `AndroidManifest.xml` (the library manifest declares neither)
- [ ] iOS: `$BackgroundLocationMotionActivity = true` set in the Podfile before the first `target`, `pod install` run, and `NSMotionUsageDescription` added to `Info.plist`
- [ ] Expo: `motionActivity` config plugin prop set (it adds the Android permissions, the usage description and the Podfile flag); removing it later requires `npx expo prebuild --clean`, otherwise the permissions stay declared
- [ ] Google Play: a prominent disclosure of the motion data use shown before `requestMotionPermission()`, and the permission requested only after the user accepts (`ACTIVITY_RECOGNITION` is health-related sensitive data for Google Play)
- [ ] Google Play Console: Health apps declaration completed, and motion-derived data that leaves the device declared in the Data safety form under Health and fitness > Fitness info
- [ ] `requestMotionPermission()` called before `startTracking()` (`startTracking()` never prompts; on iOS the prompt appears only with the app in the foreground, otherwise the result is `UNDETERMINED`)
- [ ] Screens that show `useMotionActivity()` status call its `refresh()` after `stopTracking()` (a stop emits no event or warning)
- [ ] `MOTION_ACTIVITY_UNAVAILABLE`, `MOTION_PERMISSION_NOT_GRANTED`, `MOTION_LOCATION_REDUCED` and `MOTION_LOCATION_RESTORED` warnings handled in `onLocationWarning` (tracking continues at full accuracy when detection cannot start)
- [ ] `reduceWhenStationary.notificationText` localized for non-English apps (Android shows it in the foreground notification while updates are reduced)
- [ ] Motion activity device tests run on physical Android and iOS devices (see [Motion Activity Device Tests](../development/testing.md#motion-activity-device-tests))

> **Note:** The recommended settings for fleet apps are the default timings: `motionActivity: { reduceWhenStationary: true }`. Read [Recommended Settings](../guides/motion-activity.md#recommended-settings) and the [Risk Profile](../guides/motion-activity.md#risk-profile) before changing `stationaryDelay`, `automotiveCooldown` or `maxReducedDuration`.

See the [Motion Activity](../guides/motion-activity.md#setup) guide for setup on each platform.

## See Also

- [Google Play Compliance](./google-play-compliance.md) -- Android store requirements
- [App Store Compliance](./app-store-compliance.md) -- iOS store requirements
- [Platform Comparison](./platform-comparison.md) -- Android vs iOS differences
- [Battery Optimization](../guides/battery-optimization.md) -- Battery management guide
- [Crash Recovery](../guides/crash-recovery.md) -- Session recovery patterns
- [Motion Activity](../guides/motion-activity.md) -- Opt-in motion activity and the stationary reduction
