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

The New Architecture (TurboModules) must be enabled in your project. This is the default for React Native >= 0.76.

## Android Setup

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

## iOS Setup

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

## Expo Compatibility

This library uses native TurboModules and **does not support Expo Go**. To use it in an Expo project, you must use a [development build](https://docs.expo.dev/develop/development-builds/introduction/) or the bare workflow.

If you are using Expo with a development build:

1. Install the library as shown above
2. Run `npx expo prebuild` to generate native projects
3. Follow the Android and iOS setup steps on the generated native projects
4. Build with `npx expo run:android` or `npx expo run:ios`

> **Note:** The library includes native Kotlin (Android) and Swift (iOS) code that requires compilation. Expo Go does not support custom native modules.

## Verifying the Installation

After installation and setup, verify the library is linked correctly:

```typescript
import { isTracking } from '@gabriel-sisjr/react-native-background-location';

// This should resolve without errors
const status = await isTracking();
console.log('Library loaded, tracking active:', status.active);
```

If you see a warning about `BackgroundLocation not available`, the native module is not linked. Common causes:

- New Architecture is not enabled
- Native project was not rebuilt after installation
- CocoaPods not installed (iOS)

## Next Steps

- [Quick Start](./quick-start.md) -- Build a working tracking screen in 5 minutes
- [iOS Setup](./ios-setup.md) -- Complete iOS-specific configuration
- [Permissions](./permissions.md) -- Understand the permission flow on both platforms
