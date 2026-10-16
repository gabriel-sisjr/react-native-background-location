---
sidebar_position: 2
title: Installation
description: Install @gabriel-sisjr/react-native-background-location and configure Android and iOS for background location tracking.
keywords:
  - react-native
  - installation
  - setup
  - android
  - ios
  - background-location
  - turbomodule
  - permissions
  - expo
---

# Installation

## Install the Package

```bash
# Using npm
npm install @gabriel-sisjr/react-native-background-location

# Using yarn
yarn add @gabriel-sisjr/react-native-background-location
```

The library uses React Native autolinking, so no manual linking is required.

## Peer Dependencies

Ensure your project satisfies these peer dependencies:

| Package | Required Version |
|---|---|
| `react` | >= 18.2.0 |
| `react-native` | >= 0.73.0 |
| `expo` (optional) | `*` -- only needed for the [Expo config plugin](../guides/expo-config-plugin.md), which requires Expo SDK 54 or later |

The New Architecture (TurboModules) must be enabled in your project. This is the default for React Native >= 0.76 and for Expo SDK 54 and later.

## Android Setup (bare React Native)

### Add Permissions to AndroidManifest.xml

Edit `android/app/src/main/AndroidManifest.xml` and add the required permissions inside the `<manifest>` tag:

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

  <!-- Location permissions -->
  <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
  <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />

  <!-- Background location (Android 10+) -->
  <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />

  <!-- Foreground service permissions -->
  <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
  <uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />

  <application>
    <!-- Your existing app configuration -->
  </application>
</manifest>
```

> **Important:** These are manifest declarations only. Runtime permission requests are still required on Android 6.0+ and must follow the correct sequencing. See the [Permissions guide](./permissions.md) for the full runtime flow.

### Optional: Notification Icon and Color

You can configure default notification appearance for the foreground service using AndroidManifest metadata:

```xml
<!-- Inside <application> -->
<meta-data android:name="com.backgroundlocation.default_notification_icon"
           android:resource="@drawable/ic_notification" />
<meta-data android:name="com.backgroundlocation.default_notification_color"
           android:resource="@color/notification_accent" />
```

Alternatively, place a drawable named `bg_location_notification_icon` in `res/drawable/` for automatic detection.

### Rebuild

```bash
cd android && ./gradlew clean && cd ..
yarn start --reset-cache
yarn android
```

## iOS Setup (bare React Native)

iOS requires additional configuration beyond installing the package. See the dedicated [iOS Setup](./ios-setup.md) page for complete instructions, including:

- Info.plist usage description entries
- Background Modes capability
- CocoaPods installation
- Privacy manifest details
- Troubleshooting build errors

Quick summary for minimal setup:

```bash
# 1. Add Info.plist entries (see iOS Setup page)
# 2. Enable Background Modes > Location updates in Xcode
# 3. Install pods
cd ios && pod install && cd ..
```

## Expo

This library contains native Kotlin (Android) and Swift (iOS) code, so it **does not run in Expo Go**. Use Expo SDK 54 or later with a [development build](https://docs.expo.dev/develop/development-builds/introduction/) or EAS Build.

With the config plugin you do **not** follow the Android and iOS setup sections above -- they are for bare React Native projects. Instead:

1. Install the library: `npx expo install @gabriel-sisjr/react-native-background-location`
2. Add `"@gabriel-sisjr/react-native-background-location"` to the `plugins` array of your `app.json` (or `app.config.ts`)
3. Run `npx expo prebuild --clean` to generate the native projects. The plugin adds the Android permissions, the iOS usage strings and `UIBackgroundModes`, and raises the iOS deployment target to 16.0
4. Build with `npx expo run:android` or `npx expo run:ios` (or EAS Build)

See the [Expo config plugin guide](../guides/expo-config-plugin.md) for the options, the supported SDK versions and troubleshooting.

## Verifying the Installation

After installation and setup, verify the library is linked correctly:

```typescript
import { isTracking } from '@gabriel-sisjr/react-native-background-location';

// This should resolve without errors
const status = await isTracking();
console.log('Library loaded, tracking active:', status.active);
```

If the app crashes at launch (a red screen in development) with `TurboModuleRegistry.getEnforcing(...): 'BackgroundLocation' could not be found`, the native module is not linked -- on Expo, see [the startup crash](../guides/expo-config-plugin.md#the-app-crashes-at-startup-with-backgroundlocation-could-not-be-found). Common causes:

- New Architecture is not enabled (on Expo, remove `newArchEnabled: false` from your config and run `npx expo prebuild --clean`; the config plugin stops the prebuild, and any other Expo command that loads your config, while the New Architecture is disabled)
- Native project was not rebuilt after installation
- CocoaPods not installed (iOS)

## Next Steps

- [Quick Start](./quick-start.md) -- Build a working tracking screen in 5 minutes
- [iOS Setup](./ios-setup.md) -- Complete iOS-specific configuration
- [Permissions](./permissions.md) -- Understand the permission flow on both platforms
