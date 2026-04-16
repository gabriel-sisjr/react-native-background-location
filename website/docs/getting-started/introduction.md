---
sidebar_position: 1
title: Introduction
description: Learn about @gabriel-sisjr/react-native-background-location, a cross-platform React Native TurboModule library for reliable background location tracking on Android and iOS.
keywords:
  - react-native
  - background-location
  - location-tracking
  - turbomodule
  - gps
  - android
  - ios
  - typescript
---

# Introduction

[![NPM Version](https://img.shields.io/npm/v/%40gabriel-sisjr%2Freact-native-background-location)](https://www.npmjs.com/package/@gabriel-sisjr/react-native-background-location)
[![NPM Downloads](https://img.shields.io/npm/dm/%40gabriel-sisjr%2Freact-native-background-location)](https://www.npmjs.com/package/@gabriel-sisjr/react-native-background-location)
[![CI Tests](https://github.com/gabriel-sisjr/react-native-background-location/actions/workflows/ci.yml/badge.svg)](https://github.com/gabriel-sisjr/react-native-background-location/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/gabriel-sisjr/react-native-background-location)](https://github.com/gabriel-sisjr/react-native-background-location/blob/develop/LICENSE)

`@gabriel-sisjr/react-native-background-location` is a cross-platform React Native library for background location tracking built on TurboModules (New Architecture). It tracks user location reliably on both Android and iOS even when the app is minimized, with persistent storage, crash recovery, and platform-native behavior.

## Key Features

- **Cross-platform background tracking** -- Works on both Android and iOS with a single TypeScript API
- **Real-time event-driven updates** -- Receive location updates via `NativeEventEmitter` as they happen
- **Crash recovery** -- Automatic session restoration using WorkManager (Android) and significant location monitoring (iOS)
- **Persistent storage** -- Locations are persisted to Room Database (Android) and Core Data (iOS) so no data is lost
- **Configurable accuracy and intervals** -- Tune accuracy, update intervals, and distance filters for battery efficiency
- **Session-based trip management** -- Organize locations by trip IDs, with auto-generated or custom identifiers
- **Full notification customization** -- Custom icons, colors, action buttons, and dynamic updates on Android
- **Foreground-only mode** -- Track without requiring background location permission
- **Geofencing support** -- Register geofence regions with transition monitoring and notifications
- **Unified React hooks** -- `useBackgroundLocation`, `useLocationPermissions`, `useLocationUpdates`, and `useLocationTracking`
- **Fully typed TypeScript API** -- Complete type definitions for all methods, options, events, and hook return types
- **Provider abstraction** -- Google Play Services primary with automatic Android Location API fallback

## Platform Support

| Feature | Android | iOS |
|---|---|---|
| Background tracking | Foreground service with notification | CLLocationManager with blue status bar |
| Persistent storage | Room Database (SQLite) | Core Data (SQLite) |
| Crash recovery | WorkManager | Significant location monitoring |
| Location provider | Fused Location (Google Play Services) + Android Location fallback | CLLocationManager |
| Min SDK / OS version | API 24 (Android 7.0) | iOS 13+ |
| Target SDK | 34 (Android 14) | Latest Xcode SDK |
| Notification customization | Full (icon, color, actions, dynamic updates) | N/A (system blue bar) |
| Geofencing | Google Geofencing API | CLCircularRegion |
| Max geofences | 100 | 20 |
| Distance filtering | Supported | Supported |
| Foreground-only mode | Supported | Supported |

## Requirements

| Requirement | Minimum Version |
|---|---|
| React Native | >= 0.73.0 |
| React | >= 18.2.0 |
| New Architecture (TurboModules) | Required |
| Node.js | 18+ |
| Xcode (iOS) | 15+ |
| CocoaPods (iOS) | 1.13+ |
| Android minSdkVersion | 24 |
| Kotlin (Android) | 1.9+ |

> **Note:** This library requires the React Native New Architecture (TurboModules) to be enabled. It does not support the legacy bridge architecture.

## How It Works

The library uses React Native's TurboModule system for direct JS-to-native communication:

1. **TypeScript layer** -- Your app interacts with hooks and functions that convert TypeScript enums to native-compatible strings
2. **TurboModule bridge** -- Codegen-generated spec connects JavaScript to native modules with type safety
3. **Native layer** -- Platform-specific implementations manage location services, storage, and lifecycle

On **Android**, a foreground service keeps location tracking alive in the background, with a visible notification. Location updates flow through Kotlin SharedFlow singletons and are collected by coroutine jobs in the module.

On **iOS**, `CLLocationManager` handles background location updates natively. The system shows a blue status bar indicator when the app is tracking in the background. No foreground notification is used.

Both platforms persist location data to local databases (Room / Core Data) so locations survive app restarts and crashes.

## Architecture Overview

```text
React Hooks / Functions
        |
        v
  src/index.tsx (enum-to-string conversion)
        |
        v
  TurboModule Spec (Codegen contract)
        |
    ----+----
    |       |
    v       v
 Android   iOS
 Kotlin    Swift
```

For a complete architecture breakdown, see the [Architecture documentation](../architecture/overview.md).

## Next Steps

- [Installation](./installation.md) -- Install the library and configure your project
- [Quick Start](./quick-start.md) -- Get tracking in 5 minutes with a working example
- [iOS Setup](./ios-setup.md) -- iOS-specific configuration and requirements
- [Permissions](./permissions.md) -- Understand the cross-platform permission model
