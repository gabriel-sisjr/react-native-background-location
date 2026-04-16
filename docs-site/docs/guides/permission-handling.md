---
sidebar_position: 6
title: Permission Handling
description: Deep dive into the useLocationPermissions hook — Android and iOS permission flows, foreground and background location, notification permissions, handling denied and blocked states, and permission UX best practices.
keywords:
  - permissions
  - useLocationPermissions
  - PermissionState
  - location permission
  - notification permission
  - Android permissions
  - iOS authorization
  - Always
  - WhenInUse
  - React Native
---

# Permission Handling

This guide covers the `useLocationPermissions` hook, the full permission flow on both platforms, handling denied and blocked states, and best practices for permission UX.

## Overview

Background location tracking and geofencing require multiple permissions:

| Permission | Android | iOS |
|-----------|---------|-----|
| Foreground location | `ACCESS_FINE_LOCATION` | WhenInUse authorization |
| Background location | `ACCESS_BACKGROUND_LOCATION` (Android 10+) | Always authorization |
| Notifications | `POST_NOTIFICATIONS` (Android 13+) | `UNUserNotificationCenter` |

The `useLocationPermissions` hook manages all of these in a single, sequential flow.

## Basic Usage

```typescript
import { useLocationPermissions } from '@gabriel-sisjr/react-native-background-location';

function PermissionScreen() {
  const {
    permissionStatus,
    requestPermissions,
    checkPermissions,
    isRequesting,
  } = useLocationPermissions();

  if (!permissionStatus.hasAllPermissions) {
    return (
      <View>
        <Text>Location permissions required</Text>
        <Button
          title="Grant Permissions"
          onPress={requestPermissions}
          disabled={isRequesting}
        />
      </View>
    );
  }

  return <TrackingScreen />;
}
```

## PermissionState Structure

The hook returns a granular `permissionStatus` object with nested location and notification states.

```typescript
interface PermissionState {
  // True when BOTH location AND notification permissions are granted
  hasAllPermissions: boolean;

  location: {
    hasPermission: boolean;
    status: LocationPermissionStatus;
    canRequestAgain: boolean;
  };

  notification: {
    hasPermission: boolean;
    status: NotificationPermissionStatus;
    canRequestAgain: boolean;
  };
}
```

### Location Permission Status

| Status | Description |
|--------|-------------|
| `granted` | Full background location access granted |
| `whenInUse` | iOS only: WhenInUse permission granted. `hasPermission` is `true`. |
| `denied` | User denied permissions, can request again |
| `blocked` | User permanently denied (must open Settings) |
| `undetermined` | Permissions not yet requested |

### Notification Permission Status

| Status | Description |
|--------|-------------|
| `granted` | Notification permission granted |
| `denied` | User denied notification permission |
| `undetermined` | Not yet requested |

### `hasAllPermissions`

This combined flag is `true` only when both `location.hasPermission` and `notification.hasPermission` are `true`. Use it for general permission gates. Use the individual sub-objects when you need to check or display specific states.

## Return Values

| Value | Type | Description |
|-------|------|-------------|
| `permissionStatus` | `PermissionState` | Current permission state |
| `requestPermissions` | `() => Promise<boolean>` | Request all required permissions. Returns `true` based on location result. |
| `checkPermissions` | `() => Promise<boolean>` | Check current permissions without requesting |
| `isRequesting` | `boolean` | Whether a request is in progress |

## Android Permission Flow

On Android, `requestPermissions()` follows a multi-step sequential flow:

```
Step 1: Request foreground location
  ACCESS_FINE_LOCATION + ACCESS_COARSE_LOCATION
    |
Step 2: Request background location (Android 10+)
  ACCESS_BACKGROUND_LOCATION
    |
Step 3: Request notification permission (Android 13+)
  POST_NOTIFICATIONS
```

Each step only proceeds if the previous step succeeded.

### Android Version Differences

| Version | Foreground | Background | Notifications |
|---------|-----------|-----------|---------------|
| Android 9 (API 28) and below | Granted together | Not needed | Not needed |
| Android 10 (API 29) | Separate prompt | `ACCESS_BACKGROUND_LOCATION` | Not needed |
| Android 11 (API 30) | Separate prompt | Redirects to Settings | Not needed |
| Android 12 (API 31) | Separate prompt | Redirects to Settings | Not needed |
| Android 13 (API 33)+ | Separate prompt | Redirects to Settings | `POST_NOTIFICATIONS` prompt |

## iOS Permission Flow

On iOS, `requestPermissions()` follows a three-step flow using native CLLocationManager:

```
Step 1: Request WhenInUse authorization
  CLLocationManager.requestWhenInUseAuthorization()
    |
Step 2: Escalate to Always authorization
  CLLocationManager.requestAlwaysAuthorization()
    |
Step 3: Request notification permission
  UNUserNotificationCenter.requestAuthorization()
```

### iOS Authorization States

| State | `location.status` | `location.hasPermission` | Notes |
|-------|-------------------|-------------------------|-------|
| Not Determined | `undetermined` | `false` | First launch, no prompt shown |
| When In Use | `whenInUse` | `true` | Tracking works but may be limited |
| Always | `granted` | `true` | Full background tracking and geofencing |
| Denied | `denied` | `false` | Can show prompt again |
| Restricted | `blocked` | `false` | Must open Settings |

> **iOS note:** When `status` is `whenInUse`, `hasPermission` is `true` because basic tracking can still function. However, for reliable background tracking and geofencing, "Always" authorization is required. The `requestPermissions()` function handles the full escalation flow.

### WhenInUse-to-Always Escalation

The library handles the iOS two-step authorization escalation automatically:

1. Requests `WhenInUse` first
2. Uses a `shouldIgnoreNextAuthCallback` guard to prevent premature delegate callback resolution
3. Calls `requestAlwaysAuthorization()` to escalate

This is transparent to your code -- just call `requestPermissions()`.

## Handling Permission States

### Denied State

The user denied permissions but can be prompted again.

```typescript
function PermissionHandler() {
  const { permissionStatus, requestPermissions } = useLocationPermissions();

  if (permissionStatus.location.status === 'denied') {
    return (
      <View>
        <Text>We need location permissions to track your trips</Text>
        <Button title="Grant Permissions" onPress={requestPermissions} />
      </View>
    );
  }

  return <TrackingScreen />;
}
```

### Blocked State

The user permanently denied permissions. The only option is to open Settings.

```typescript
import { Linking } from 'react-native';

function PermissionHandler() {
  const { permissionStatus } = useLocationPermissions();

  if (permissionStatus.location.status === 'blocked') {
    return (
      <View>
        <Text>Permissions permanently denied</Text>
        <Text>
          Please enable location access in your device Settings.
        </Text>
        <Button
          title="Open Settings"
          onPress={() => Linking.openSettings()}
        />
      </View>
    );
  }

  return <TrackingScreen />;
}
```

### The `canRequestAgain` Flag

Both `location` and `notification` include a `canRequestAgain` boolean. Use this to determine whether to show a "Request" button or a "Go to Settings" button.

```typescript
const { permissionStatus } = useLocationPermissions();

if (!permissionStatus.location.hasPermission) {
  if (permissionStatus.location.canRequestAgain) {
    // Show "Grant Permissions" button
  } else {
    // Show "Open Settings" button
  }
}
```

## Ensuring "Always" Permission for Geofencing

Geofencing requires "Always" location authorization on iOS. Use this pattern to verify and request the correct permission level.

```typescript
import {
  useLocationPermissions,
  LocationPermissionStatus,
} from '@gabriel-sisjr/react-native-background-location';
import { Alert, Linking } from 'react-native';

function GeofencePermissionGate({ children }: { children: React.ReactNode }) {
  const { permissionStatus, requestPermissions, isRequesting } =
    useLocationPermissions();

  const handleRequestPermissions = async () => {
    const granted = await requestPermissions();
    if (
      !granted &&
      permissionStatus.location.status === LocationPermissionStatus.BLOCKED
    ) {
      Alert.alert(
        'Permission Required',
        'Please enable "Always" location access in Settings for geofencing.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
    }
  };

  if (permissionStatus.location.status !== LocationPermissionStatus.GRANTED) {
    return (
      <View>
        <Text>Geofencing requires "Always" location permission</Text>
        <Button
          title="Enable Always Permission"
          onPress={handleRequestPermissions}
          disabled={isRequesting}
        />
      </View>
    );
  }

  return <>{children}</>;
}
```

## Checking Notification Permissions

The notification permission state is available through `permissionStatus.notification`.

```typescript
import {
  useLocationPermissions,
  NotificationPermissionStatus,
} from '@gabriel-sisjr/react-native-background-location';

function NotificationPermissionCheck() {
  const { permissionStatus } = useLocationPermissions();

  const { notification } = permissionStatus;

  if (notification.status === NotificationPermissionStatus.DENIED) {
    return (
      <View>
        <Text>
          Notification permission denied. Geofence alerts will not be visible.
        </Text>
        <Button
          title="Open Settings"
          onPress={() => Linking.openSettings()}
        />
      </View>
    );
  }

  return null;
}
```

> **Note:** The return value of `requestPermissions()` is based on location permission only. Notification permission is requested but does not affect the return value.

## Complete Permission Flow Example

```typescript
import React from 'react';
import { View, Text, Button, Linking, Alert } from 'react-native';
import { useLocationPermissions } from '@gabriel-sisjr/react-native-background-location';

function App() {
  const {
    permissionStatus,
    requestPermissions,
    isRequesting,
  } = useLocationPermissions();

  // Step 1: Check if permissions are granted
  if (permissionStatus.hasAllPermissions) {
    return <MainApp />;
  }

  // Step 2: Handle blocked state
  if (permissionStatus.location.status === 'blocked') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Location Access Required</Text>
        <Text style={styles.body}>
          Location permissions have been permanently denied.
          Please enable them in Settings to use this app.
        </Text>
        <Button
          title="Open Settings"
          onPress={() => Linking.openSettings()}
        />
      </View>
    );
  }

  // Step 3: Handle denied / undetermined states
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome</Text>
      <Text style={styles.body}>
        This app needs location access to track your trips in the background.
      </Text>

      {/* Show individual permission states */}
      <View style={styles.statusRow}>
        <Text>Location: {permissionStatus.location.status}</Text>
        <Text>Notification: {permissionStatus.notification.status}</Text>
      </View>

      <Button
        title="Grant Permissions"
        onPress={async () => {
          const granted = await requestPermissions();
          if (!granted) {
            Alert.alert(
              'Permissions Required',
              'Location access is required for tracking.'
            );
          }
        }}
        disabled={isRequesting}
      />

      {isRequesting && <Text>Requesting permissions...</Text>}
    </View>
  );
}
```

## Best Practices

### 1. Request Permissions Before Tracking

Always check and request permissions before calling `startTracking()` or `addGeofence()`.

```typescript
const { permissionStatus, requestPermissions } = useLocationPermissions();
const { startTracking } = useBackgroundLocation();

const handleStart = async () => {
  if (!permissionStatus.hasAllPermissions) {
    const granted = await requestPermissions();
    if (!granted) return;
  }
  await startTracking();
};
```

### 2. Explain Why Before Requesting

Show a clear explanation of why the app needs location access before triggering the system prompt.

```typescript
function PermissionRationale({ onContinue }: { onContinue: () => void }) {
  return (
    <View>
      <Text style={styles.title}>Location Access</Text>
      <Text style={styles.body}>
        We use your location to record trip routes and provide
        accurate delivery tracking. Your data is stored securely
        on your device.
      </Text>
      <Button title="Continue" onPress={onContinue} />
    </View>
  );
}
```

### 3. Handle Each State Gracefully

Provide clear UI for every permission state. Never leave the user without guidance.

```typescript
function PermissionUI() {
  const { permissionStatus, requestPermissions } = useLocationPermissions();
  const { location } = permissionStatus;

  switch (location.status) {
    case 'undetermined':
      return <PermissionRationale onContinue={requestPermissions} />;
    case 'denied':
      return (
        <View>
          <Text>Permission denied. Tap below to try again.</Text>
          <Button title="Request Again" onPress={requestPermissions} />
        </View>
      );
    case 'blocked':
      return (
        <View>
          <Text>Permission blocked. Open Settings to enable.</Text>
          <Button title="Open Settings" onPress={() => Linking.openSettings()} />
        </View>
      );
    case 'whenInUse':
      return (
        <View>
          <Text>
            Background access needed for reliable tracking.
            Tap below to upgrade to "Always" access.
          </Text>
          <Button title="Enable Background" onPress={requestPermissions} />
        </View>
      );
    case 'granted':
      return <TrackingScreen />;
  }
}
```

### 4. Do Not Request on App Launch

Avoid requesting permissions immediately when the app opens. Wait until the user reaches a feature that requires location access, and explain why the permission is needed first.

### 5. Check Permissions on Foreground Resume

Permissions can change while the app is backgrounded (e.g., user revokes in Settings). The hook automatically checks on mount, but you can also call `checkPermissions()` manually.

```typescript
import { useEffect } from 'react';
import { AppState } from 'react-native';

function App() {
  const { checkPermissions } = useLocationPermissions();

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        checkPermissions();
      }
    });
    return () => subscription.remove();
  }, [checkPermissions]);
}
```

## TypeScript Imports

```typescript
import {
  // Hook
  useLocationPermissions,

  // Enums
  LocationPermissionStatus,
  NotificationPermissionStatus,
} from '@gabriel-sisjr/react-native-background-location';

import type {
  // Types
  PermissionState,
  LocationPermissionState,
  NotificationPermissionState,
  UseLocationPermissionsResult,
} from '@gabriel-sisjr/react-native-background-location';
```

## Next Steps

- [Background Tracking](./background-tracking) -- Start tracking after permissions are granted
- [Geofencing](./geofencing) -- Geofencing requires "Always" permission on iOS
- [Notification Customization](./notification-customization) -- Android notification setup
