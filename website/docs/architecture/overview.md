---
sidebar_position: 1
title: Architecture Overview
description: High-level architecture of react-native-background-location — the three-layer design, key design decisions, technology choices per platform, and cross-cutting concerns.
keywords:
  - architecture
  - turbomodule
  - react-native
  - background-location
  - design decisions
  - android
  - ios
  - typescript
---

# Architecture Overview

This document describes the high-level architecture of `@gabriel-sisjr/react-native-background-location`. The library follows a three-layer design that separates the public TypeScript API from platform-specific native implementations through a TurboModule bridge contract.

## Three-Layer Design

```mermaid
graph TD
    A["TypeScript API Layer<br/>(src/index.tsx, hooks, types)"] -->|enum-to-string conversion| B["TurboModule Spec Layer<br/>(NativeBackgroundLocation.ts)"]
    B -->|Codegen| C1["Android Native Layer<br/>(Kotlin, Room, Coroutines)"]
    B -->|Codegen| C2["iOS Native Layer<br/>(Swift, Core Data, CLLocationManager)"]

    style A fill:#3178c6,color:#fff
    style B fill:#f0db4f,color:#333
    style C1 fill:#a4c639,color:#fff
    style C2 fill:#147efb,color:#fff
```

### Layer 1: TypeScript API

The public-facing layer that application code consumes directly. It provides:

- **Functions** -- `startTracking`, `stopTracking`, `isTracking`, `getLocations`, `clearTrip`, `updateNotification`, the full geofencing API, and the opt-in motion activity functions (`addMotionActivityListener`, `checkMotionPermission`, `requestMotionPermission`, `getMotionActivityState`).
- **React hooks** -- `useLocationPermissions`, `useBackgroundLocation`, `useLocationTracking`, `useLocationUpdates`, `useGeofencing`, `useGeofenceEvents`, `useMotionActivity`.
- **Types and enums** -- `LocationAccuracy`, `NotificationPriority`, `TrackingOptions`, `Coords`, `GeofenceRegion`, the motion activity enums (`MotionActivityType`, `MotionConfidence`, `MotionPermissionStatus`, `MotionDetectionStatus`, `MotionReductionStatus`), and others.
- **Error classes** -- `GeofenceError` with typed `GeofenceErrorCode` discriminator.

This layer handles enum-to-string conversion, JSON serialization of complex objects, input validation, and graceful degradation when the native module is unavailable (e.g., simulators).

> The library publishes **named exports only**. There is no default export. Import individual functions directly: `import { startTracking, stopTracking } from '@gabriel-sisjr/react-native-background-location'`.

### Layer 2: TurboModule Spec

`NativeBackgroundLocation.ts` defines the `Spec extends TurboModule` interface consumed by React Native Codegen. This is the contract between TypeScript and native code. Key constraints imposed by Codegen shape this layer:

- **No TypeScript enums** -- Enum values are passed as plain strings. The TypeScript layer converts enums before crossing the bridge.
- **No complex object arrays** -- Geofence regions and notification actions are JSON-serialized into strings.
- **Inline interface definitions** -- `TrackingOptionsSpec` and `PermissionStatusResult` are defined directly in the spec file for Codegen compatibility.
- **Flat optional keys** -- The `motionActivity` option crosses the bridge as optional `motion*` primitives (`motionActivityEnabled`, `motionStationaryDelay` and so on). None of them is present when the feature is off.

### Layer 3: Native Implementations

Each platform implements the TurboModule spec using platform-idiomatic patterns:

| Concern | Android | iOS |
|---------|---------|-----|
| Language | Kotlin | Swift + Objective-C++ bridge |
| Background execution | Foreground Service (`LocationService`) | CLLocationManager background mode |
| Persistence | Room Database (SQLite) | Core Data (SQLite) |
| Event streaming | SharedFlow singletons + coroutine collection | RCTEventEmitter |
| Crash recovery | WorkManager (`RecoveryWorker`) | Significant location monitoring (`RecoveryManager`) |
| Location provider | Dual: FusedLocationProvider / AndroidLocationProvider | CLLocationManager |
| Geofencing | GeofencingClient (Google Play Services) | CLLocationManager region monitoring |
| Motion activity (opt-in) | Activity Recognition API (Google Play services) in the `motion/` package, driven by `LocationService` | CoreMotion in `ios/Motion/`, driven by `MotionCoordinator`; compiled in only with the Podfile flag |

## Key Design Decisions

### TurboModule Over Bridge Modules

The library uses React Native's New Architecture (TurboModules) exclusively. TurboModules provide synchronous native module access, type-safe Codegen contracts, and lazy initialization -- all critical for a library that manages long-running background services.

### Enum-to-String Conversion at the Bridge

Codegen does not support TypeScript enums. Rather than exposing raw strings in the public API, the library maintains proper TypeScript enums (`LocationAccuracy`, `NotificationPriority`) and converts them to strings in `src/index.tsx` before they cross the bridge via `toTrackingOptionsSpec()`. This keeps the public API type-safe while satisfying Codegen constraints.

### JSON Serialization for Complex Objects

Codegen does not support typed object arrays. Geofence regions, notification actions, and notification options are serialized to JSON strings in TypeScript and deserialized on the native side. This pattern keeps the spec interface simple while supporting arbitrarily complex data structures.

### Named Exports Only

The library exports individual named functions and hooks rather than a monolithic class or default export. This enables tree-shaking, improves discoverability in IDE autocompletion, and avoids the fragile singleton pattern.

### Graceful Degradation

Every public function checks for native module availability before calling into native code. When the module is unavailable (simulators, misconfigured builds), functions log a warning and return sensible fallback values instead of crashing. Geofencing functions throw explicitly since silent degradation would be misleading for geofence registration.

### Stop Token Mechanism

A SharedPreferences/UserDefaults flag with a 60-second TTL prevents the recovery system from restarting tracking after an explicit `stopTracking()` call. The token is checked at multiple points in the recovery pipeline to eliminate race conditions between stop and recovery.

### Restart Loop Detection (Android)

A counter in SharedPreferences tracks service restarts within a 1-hour window. If the count exceeds 5, the service refuses to start and clears tracking state. This prevents infinite crash-restart loops from draining battery or producing system ANRs.

### Batched Database Writes

Both platforms buffer location writes and flush in batches (up to 10 items, or every 5 seconds). This reduces I/O overhead during high-frequency GPS updates. A `forceFlush()` call guarantees consistency before any read operation.

### Opt-In Motion Activity

Motion activity detection, and the reduction of location updates while the device is stationary, are off by default. With `motionActivity` absent, `false` or `null`, the library behaves as in 1.1.0: no Activity Recognition client (except, on Android, to remove a registration left by an earlier session), no CoreMotion call, no motion permission check or prompt, no `onMotionActivity` event and no `MOTION_*` warning.

```mermaid
graph TD
    subgraph ANDROIDMOT["Android, always compiled"]
        LSVC["LocationService<br/>(foreground service)"] --> MSESS["MotionSession<br/>(motion/ package)"]
        MRCV["MotionActivityReceiver<br/>(non-exported)"] --> MSESS
        MSESS --> ARAPI["Activity Recognition API<br/>(Google Play services)"]
        MSESS --> AGATE["MotionGate"]
    end
    subgraph IOSMOT["iOS, CoreMotion behind the Podfile flag"]
        LMWR["LocationManagerWrapper"] --> MCOORD["MotionCoordinator<br/>(ios/Motion/)"]
        MCOORD --> CMSRC["CoreMotionActivitySource<br/>(CMMotionActivityManager)"]
        MCOORD --> IGATE["MotionGate"]
    end
```

- **Android** -- The `motion/` package is always compiled, but the foreground service creates an Activity Recognition client only for a trip that enables the feature, or to remove a registration left by an earlier session. The library manifest adds a non-exported receiver and no permission: the app declares `ACTIVITY_RECOGNITION` itself.
- **iOS** -- The CoreMotion code is compiled in only when the app's Podfile sets `$BackgroundLocationMotionActivity = true` (the Expo `motionActivity` plugin prop adds that line). Without it, no CoreMotion code is compiled or linked, and the app needs no `NSMotionUsageDescription` because of this library.
- **Degrade, never stop** -- The reduction switches to a coarse, low-power location profile while the foreground service (Android) or the standard location updates (iOS) keep running. A detection failure (no Google Play services, no permission, not compiled in) becomes at most one `onLocationWarning` per session, and tracking continues at full accuracy. `startTracking()` never throws, rejects or prompts because of motion.

See the [Motion Activity guide](../guides/motion-activity.md) for setup, behaviour and warnings.

## Technology Stack

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| JS/TS layer | TypeScript, React | Type safety, hook-based API |
| Bridge | TurboModule + Codegen | Type-safe contract, lazy init, New Architecture |
| Android module | Kotlin | Coroutines, null safety, Android-first language |
| Android persistence | Room (SQLite) | Type-safe queries, reactive flows, schema versioning |
| Android concurrency | Coroutines (SupervisorJob + Dispatchers.Main) | Structured concurrency, cancellation support |
| Android background | Foreground Service + WorkManager | Reliable background execution, OS compliance |
| Android location | Google Play Services (FusedLocationProvider) | Battery-efficient, fused sensor data |
| Android fallback | Android LocationManager | Devices without Google Play Services |
| Android motion (opt-in) | Activity Recognition API (Google Play services) | System activity classifier; inexact `AlarmManager` alarms for the reduction timers, no exact-alarm permission |
| iOS module | Swift + Objective-C++ bridge | Modern Swift with TurboModule bridge compatibility |
| iOS persistence | Core Data (SQLite) | Apple-native, thread-safe, schema migration |
| iOS location | CLLocationManager | Only official iOS location API |
| iOS recovery | Significant location monitoring | System-managed, low-power app relaunch |
| iOS motion (opt-in) | CoreMotion (`CMMotionActivityManager`) | System activity classifier; compiled in only with the Podfile flag |
| Build system | react-native-builder-bob | CommonJS + ESM + TypeScript declarations |
| Monorepo | Yarn 3.6.1 + Turborepo | Workspace management, parallel builds |

## Cross-Cutting Concerns

### Event System

Both platforms emit the same five event types to JavaScript:

| Event | Description |
|-------|-------------|
| `onLocationUpdate` | New location coordinate received |
| `onLocationError` | Fatal error (permission revoked, provider error) |
| `onLocationWarning` | Non-fatal warning (service timeout, task removed, GPS lost, motion activity reduction and availability); every payload carries a `timestamp` |
| `onNotificationAction` | Notification action button pressed |
| `onMotionActivity` | Detected motion activity changed; only for a trip started with `motionActivity` enabled |

The event names and payload shapes are identical on both platforms, providing a unified API surface for hooks like `useLocationUpdates`, `useGeofenceEvents` and `useMotionActivity`.

### Permission Model

The library provides a cross-platform permission flow through `useLocationPermissions`:

- **Android**: Requests `ACCESS_FINE_LOCATION`, then `ACCESS_BACKGROUND_LOCATION` (API 29+), then `POST_NOTIFICATIONS` (API 33+).
- **iOS**: Requests "When In Use" first, then escalates to "Always" via a two-step flow with a `shouldIgnoreNextAuthCallback` guard to handle iOS delegate timing.
- **Motion activity (opt-in)**: Separate from the location flow and not covered by `useLocationPermissions`. `checkMotionPermission()` never prompts; `requestMotionPermission()` shows the Android 10+ `ACTIVITY_RECOGNITION` dialog (through `PermissionsAndroid`) or, while access is undetermined, the iOS Motion & Fitness prompt. `startTracking()` never prompts for it.

### Persistence and Recovery

Both platforms persist tracking state (active status, trip ID, options) to the database. On crash or system kill, the recovery mechanism reads this state and resumes tracking automatically. The stop token prevents recovery after an intentional stop.

The motion options are part of this state: on Android in the `tracking_state` table (Room schema v2; Android recovery now also restores `distanceFilter`), on iOS in `UserDefaults` next to the Core Data state. The reduction state is never persisted: a recovered trip restarts motion detection through the normal path, without prompting, at full accuracy.

## Next Steps

- [Data Flow](./data-flow.md) -- Detailed data flow from hook to native and back.
- [Android Native Architecture](./android-native.md) -- Deep dive into the Android implementation.
- [iOS Native Architecture](./ios-native.md) -- Deep dive into the iOS implementation.
- [Motion Activity](../guides/motion-activity.md) -- Setup and behaviour of the opt-in motion activity feature.
