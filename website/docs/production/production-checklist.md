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

- [ ] Tested on iOS 13+ (minimum supported version)
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

## See Also

- [Google Play Compliance](./google-play-compliance.md) -- Android store requirements
- [App Store Compliance](./app-store-compliance.md) -- iOS store requirements
- [Platform Comparison](./platform-comparison.md) -- Android vs iOS differences
- [Battery Optimization](../guides/battery-optimization.md) -- Battery management guide
- [Crash Recovery](../guides/crash-recovery.md) -- Session recovery patterns
