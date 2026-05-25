---
sidebar_position: 2
title: Data Flow
description: Complete data flow diagrams for react-native-background-location — from React hooks through the TurboModule bridge to native services and back via event emitters.
keywords:
  - data flow
  - event emitter
  - SharedFlow
  - RCTEventEmitter
  - NativeEventEmitter
  - turbomodule
  - location tracking
  - geofencing
---

# Data Flow

This document traces the complete data flow for location tracking and geofencing -- from the React hook layer through the TurboModule bridge, into native services, and back to JavaScript via event emitters.

## High-Level Flow

```mermaid
sequenceDiagram
    participant Hook as React Hook
    participant API as src/index.tsx
    participant Spec as TurboModule Spec
    participant Native as Native Module
    participant Service as Location Service
    participant Storage as Database
    participant Emitter as Event Emitter

    Hook->>API: startTracking(options)
    API->>API: enum→string conversion
    API->>Spec: startTracking(tripId, specOptions)
    Spec->>Native: Forward to native
    Native->>Service: Start foreground service
    Service->>Service: Request location updates

    loop On each location update
        Service->>Storage: Batch write location
        Service->>Emitter: Emit location event
        Emitter->>Hook: onLocationUpdate callback
    end

    Hook->>API: stopTracking()
    API->>Spec: stopTracking()
    Spec->>Native: Forward to native
    Native->>Native: Set stop token
    Native->>Service: Stop service
```

## Start Tracking Flow

When `startTracking()` is called, data crosses three boundaries before reaching the location provider.

### Step 1: TypeScript API (src/index.tsx)

```mermaid
flowchart LR
    A[TrackingOptions] --> B[toTrackingOptionsSpec]
    B --> C{Convert enums}
    C --> D["LocationAccuracy.HIGH → 'HIGH_ACCURACY'"]
    C --> E["NotificationPriority.HIGH → 'HIGH'"]
    B --> F{Serialize objects}
    F --> G["notificationActions → JSON string"]
    F --> H["notificationOptions → JSON string"]
    G --> I[TrackingOptionsSpec]
    H --> I
    D --> I
    E --> I
```

The `toTrackingOptionsSpec()` utility in `src/utils/trackingOptionsMapper.ts` handles two conversions that Codegen cannot:

1. **Enum-to-string** -- `LocationAccuracy` and `NotificationPriority` enum values become plain strings.
2. **Object-to-JSON** -- `notificationActions` (capped at 3 items) and `notificationOptions` are serialized to JSON strings.

### Step 2: TurboModule Bridge

The `TrackingOptionsSpec` interface crosses the bridge with all values in Codegen-compatible types (strings, numbers, booleans). The native side receives a `ReadableMap` (Android) or `NSDictionary` (iOS) and reconstructs the typed options.

### Step 3: Native Service Initialization

- **Android**: `BackgroundLocationModule` parses the `ReadableMap` into a Kotlin `TrackingOptions` data class, saves tracking state to Room DB, and starts `LocationService` as a foreground service.
- **iOS**: `BackgroundLocation.mm` forwards to `LocationManagerWrapper.swift`, which configures `CLLocationManager` with the mapped accuracy, distance filter, and background mode settings.

## Location Update Flow

Once tracking is active, location updates flow from the OS through the native layer and back to JavaScript.

### Android Event Pipeline

```mermaid
flowchart TD
    GPS["GPS / Network Provider"] --> LP["LocationProvider<br/>(Fused or Android)"]
    LP --> LS["LocationService"]
    LS --> ST{"Stop token<br/>valid?"}
    ST -->|Yes| DROP[Drop update]
    ST -->|No| PROC["Process location"]
    PROC --> STORE["LocationStorage<br/>(Room DB batch write)"]
    PROC --> LEE["LocationEventEmitter"]
    LEE --> LEF["LocationEventFlow<br/>(SharedFlow singleton)"]
    LEF --> MOD["BackgroundLocationModule<br/>(coroutine Job collection)"]
    MOD --> RCT["RCTDeviceEventEmitter"]
    RCT --> NEE["NativeEventEmitter"]
    NEE --> HOOK["useLocationUpdates hook"]
```

Android uses **SharedFlow singletons** to decouple event producers from consumers:

| SharedFlow | Sealed Interface | Producer | Consumer |
|------------|-----------------|----------|----------|
| `LocationEventFlow` | `LocationEvent` (Update, Error, Warning) | `LocationEventEmitter` | `BackgroundLocationModule` |
| `GeofenceEventFlow` | `GeofenceEvent` (Transition) | `GeofenceEventEmitter` | `BackgroundLocationModule` |
| `NotificationActionFlow` | `NotificationActionEvent` (ActionClicked) | `NotificationActionReceiver` | `BackgroundLocationModule` |

All three flows share the same configuration: `replay = 0`, `extraBufferCapacity = 64`, `onBufferOverflow = DROP_OLDEST`. The non-suspending `tryEmit()` API ensures producers never block.

`BackgroundLocationModule` collects from all three flows using coroutine Jobs scoped to `moduleScope` (SupervisorJob + Dispatchers.Main). Each collected event is forwarded to JavaScript via `RCTDeviceEventEmitter`.

### iOS Event Pipeline

```mermaid
flowchart TD
    GPS["CLLocationManager"] --> DEL["LocationManagerDelegate"]
    DEL --> ST{"Stop token<br/>valid?"}
    ST -->|Yes| DROP[Drop update]
    ST -->|No| PROC["Process location"]
    PROC --> STORE["LocationStorage<br/>(Core Data batch write)"]
    PROC --> RCT["RCTEventEmitter<br/>(sendEvent)"]
    RCT --> NEE["NativeEventEmitter"]
    NEE --> HOOK["useLocationUpdates hook"]
```

iOS uses **RCTEventEmitter** directly. `LocationManagerDelegate` processes each `CLLocation` from the `didUpdateLocations:` callback, writes to Core Data, and emits to JavaScript via `sendEvent(withName:body:)`. There is no intermediate flow layer -- the delegate bridges directly to the React Native event system.

### Platform Comparison

| Aspect | Android | iOS |
|--------|---------|-----|
| Event decoupling | SharedFlow singletons (3 flows) | Direct delegate-to-emitter |
| Buffer strategy | 64-element ring buffer, DROP_OLDEST | No buffer (immediate emit) |
| Thread model | Coroutine collection on Main dispatcher | Main thread delegate callbacks |
| Producer API | Non-suspending `tryEmit()` | Synchronous `sendEvent()` |
| Consumer lifecycle | Coroutine Jobs tied to `moduleScope` | RCTEventEmitter managed by React Native |

## Event Payload Format

Both platforms emit identical event payloads to JavaScript:

### onLocationUpdate

```typescript
{
  tripId: string;
  latitude: number;
  longitude: number;
  timestamp: number;
  accuracy?: number;
  altitude?: number;
  speed?: number;
  bearing?: number;
  verticalAccuracy?: number;
  speedAccuracy?: number;
  bearingAccuracy?: number;
  elapsedRealtimeNanos?: number;
  provider?: string;
  isMocked?: boolean;
}
```

### onLocationError

```typescript
{
  tripId: string;
  type: 'PERMISSION_REVOKED' | 'PROVIDER_ERROR';
  message: string;
}
```

### onLocationWarning

```typescript
{
  tripId: string;
  type: 'SERVICE_TIMEOUT' | 'TASK_REMOVED' | 'LOCATION_UNAVAILABLE';
  message: string;
}
```

### onNotificationAction

```typescript
{
  tripId: string;
  actionId: string;
}
```

## Storage Flow

### Write Path

```mermaid
flowchart LR
    LOC["New location"] --> BUF["In-memory buffer<br/>(ConcurrentLinkedQueue / Array)"]
    BUF --> CHECK{"Buffer size >= 10<br/>OR 5s elapsed?"}
    CHECK -->|Yes| FLUSH["Batch INSERT<br/>(Room / Core Data)"]
    CHECK -->|No| WAIT["Wait for next<br/>location or timer"]
    FLUSH -->|Failure| RETRY["Re-add to buffer"]
```

Both platforms use the same batching strategy:

- Locations are buffered in memory.
- Flush triggers when the buffer reaches **10 items** or a **5-second timer** fires.
- On flush failure, items are re-added to the buffer for retry.

### Read Path

```mermaid
flowchart LR
    READ["getLocations(tripId)"] --> FF["forceFlush()"]
    FF --> DRAIN["Drain buffer<br/>to database"]
    DRAIN --> QUERY["SELECT * FROM locations<br/>WHERE tripId = ?"]
    QUERY --> RESULT["Coords[]"]
```

Every read operation calls `forceFlush()` first to drain pending writes, guaranteeing that the returned data includes the most recent buffered locations.

## Geofencing Data Flow

### Registration

```mermaid
sequenceDiagram
    participant App as Application
    participant API as src/index.tsx
    participant Spec as TurboModule Spec
    participant Native as Native Module

    App->>API: addGeofence(region)
    API->>API: validateGeofenceRegion()
    API->>API: Check for duplicate identifier
    API->>API: serializeGeofenceRegion() → JSON
    API->>Spec: addGeofence(json)
    Spec->>Native: Register with platform
    Native->>Native: Persist to database
    Native->>Native: Register with GeofencingClient / CLLocationManager
```

Geofence regions go through three transformations before reaching the platform:

1. **Validation** -- `validateGeofenceRegion()` checks identifier, radius, coordinates, and metadata.
2. **Duplicate check** -- Queries active geofences to prevent duplicate identifiers.
3. **Serialization** -- `serializeGeofenceRegion()` converts the typed `GeofenceRegion` to a JSON string for the bridge.

### Transition Events

```mermaid
flowchart TD
    GEO["Platform geofence trigger<br/>(ENTER / EXIT / DWELL)"] --> GEE["GeofenceEventEmitter<br/>(Android) / Delegate (iOS)"]
    GEE --> STORE["Persist transition<br/>(geofence_transitions table)"]
    GEE --> EMIT["Emit to JS"]
    EMIT --> HOOK["useGeofenceEvents hook"]
```

Transition events are both persisted (for later retrieval via `getGeofenceTransitions()`) and emitted in real-time to JavaScript.

## Stop Tracking Flow

```mermaid
sequenceDiagram
    participant App as Application
    participant API as src/index.tsx
    participant Native as Native Module
    participant Service as Location Service
    participant Recovery as Recovery System

    App->>API: stopTracking()
    API->>Native: stopTracking()
    Native->>Native: Set stop token (60s TTL)
    Native->>Native: Cancel recovery work
    Native->>Service: Stop location updates
    Native->>Native: Save state synchronously
    Native->>Service: Stop foreground service

    Note over Recovery: Recovery checks stop token<br/>at 3 points before restarting

    Recovery->>Recovery: Check stop token → found → abort
```

The stop token is the critical mechanism that prevents the recovery system from restarting a service that was intentionally stopped. It is set synchronously (`commit()` on Android, synchronous UserDefaults write on iOS) during `stopTracking()` and checked at three points in the recovery pipeline.

## Recovery Flow

### Android (WorkManager)

```mermaid
flowchart TD
    CRASH["App crash / system kill"] --> WM["WorkManager triggers<br/>RecoveryWorker"]
    WM --> T1{Stop token?}
    T1 -->|Set| ABORT1["Abort recovery"]
    T1 -->|Clear| READ["Read tracking state<br/>from Room DB"]
    READ --> T2{Stop token?}
    T2 -->|Set| ABORT2["Abort recovery"]
    T2 -->|Clear| PERM{"Permissions<br/>still granted?"}
    PERM -->|No| CLEAR["Clear tracking state"]
    PERM -->|Yes| T3{Stop token?}
    T3 -->|Set| ABORT3["Abort recovery"]
    T3 -->|Clear| START["Start LocationService<br/>with saved options"]
```

### iOS (Significant Location Monitoring)

```mermaid
flowchart TD
    CRASH["App crash / system kill"] --> SIG["System relaunches app<br/>via significant location change"]
    SIG --> RM["RecoveryManager"]
    RM --> TOKEN{Stop token?}
    TOKEN -->|Set| ABORT["Abort recovery"]
    TOKEN -->|Clear| RATE{"Under rate limit?<br/>(5/hour)"}
    RATE -->|No| SKIP["Skip recovery"]
    RATE -->|Yes| READ["Read tracking state<br/>from Core Data"]
    READ --> RESUME["Resume CLLocationManager<br/>with saved options"]
```

## Hook Data Flow

### useLocationUpdates

```mermaid
flowchart TD
    MOUNT["Hook mounts"] --> HYD["One-time DB hydration<br/>(getLocations)"]
    HYD --> SUB["Subscribe to NativeEventEmitter"]
    SUB --> LIVE["Receive live updates"]
    LIVE --> STATE["Update React state"]

    BG["App goes to background"] --> FG["App returns to foreground"]
    FG --> REHYD["AppState re-hydration<br/>(getLocations)"]
    REHYD --> STATE

    USER["Manual call"] --> REFRESH["refreshLocations()"]
    REFRESH --> REHYD
```

The hook uses three data sources:

1. **Mount hydration** -- One-time `getLocations()` call on mount to load persisted data.
2. **Live events** -- `NativeEventEmitter` subscription for real-time updates.
3. **Foreground re-hydration** -- `AppState` listener triggers `getLocations()` when the app returns from background, catching any updates that arrived while the JS bridge was inactive.

## Next Steps

- [Android Native Architecture](./android-native.md) -- Deep dive into SharedFlow, coroutines, and the foreground service.
- [iOS Native Architecture](./ios-native.md) -- Deep dive into CLLocationManager, Core Data, and the permission escalation flow.
