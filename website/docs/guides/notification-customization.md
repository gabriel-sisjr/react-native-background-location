---
sidebar_position: 5
title: Notification Customization
description: Configure Android foreground service notifications — title, text, icons, colors, priority, channels, action buttons, dynamic updates, and geofence notification templates.
keywords:
  - notification
  - NotificationOptions
  - NotificationPriority
  - foreground service
  - Android
  - notification channel
  - notification actions
  - updateNotification
  - geofence notifications
  - React Native
---

# Notification Customization

This guide covers the configuration of notifications for both background tracking and geofence transitions. On Android, the foreground service requires a persistent notification. On iOS, the system displays a blue status bar indicator instead -- custom notifications are not applicable for tracking.

## Platform Behavior

| Feature | Android | iOS |
|---------|---------|-----|
| Tracking notification | Persistent foreground service notification (required) | Blue status bar indicator (system-managed) |
| Geofence notifications | Customizable via `NotificationOptions` | Customizable via `NotificationOptions` (requires UNUserNotificationCenter) |
| Action buttons | Supported (up to 3) | Not applicable for tracking; not yet supported for geofencing |

## NotificationOptions Interface

The `NotificationOptions` interface is shared across all notification-producing features.

```typescript
interface NotificationOptions {
  enabled?: boolean;          // Show notifications (default: true)
  title?: string;             // Notification title
  text?: string;              // Notification body text
  channelName?: string;       // Android notification channel name
  channelId?: string;         // Custom channel ID
  priority?: NotificationPriority; // LOW, DEFAULT, HIGH, MAX
  smallIcon?: string;         // Android drawable resource name
  largeIcon?: string;         // Android drawable resource name
  color?: string;             // Hex color (e.g., "#FF5722")
  showTimestamp?: boolean;    // Show timestamp on notification
  subtext?: string;           // Subtext below content
  actions?: NotificationAction[]; // Up to 3 action buttons
  transitionOverrides?: Partial<Record<
    'ENTER' | 'EXIT' | 'DWELL',
    Omit<NotificationOptions, 'transitionOverrides' | 'enabled'>
  >>; // Per-transition overrides (geofencing only)
}
```

### NotificationPriority

| Priority | Behavior |
|----------|----------|
| `LOW` | Minimal notification, no sound or vibration |
| `DEFAULT` | Standard notification behavior |
| `HIGH` | More prominent, may make sound |
| `MAX` | Urgent notification, heads-up display |

```typescript
import { NotificationPriority } from '@gabriel-sisjr/react-native-background-location';
```

## Tracking Notification (Android)

The foreground service notification is configured through the `notificationOptions` field in `TrackingOptions`.

### Setting Defaults at Start

```typescript
import {
  startTracking,
  LocationAccuracy,
  NotificationPriority,
} from '@gabriel-sisjr/react-native-background-location';

await startTracking({
  accuracy: LocationAccuracy.HIGH_ACCURACY,
  updateInterval: 5000,
  notificationOptions: {
    title: 'Trip in Progress',
    text: 'Tracking your location in the background',
    priority: NotificationPriority.LOW,
    channelName: 'Location Tracking',
    color: '#4CAF50',
    showTimestamp: true,
    smallIcon: 'ic_tracking',     // Must exist in res/drawable
    largeIcon: 'ic_app_logo',     // Must exist in res/drawable
    subtext: 'Background tracking active',
  },
});
```

### Dynamic Updates

Update the notification while tracking is active using `updateNotification()`. This is useful for showing progress, changing the text based on trip state, or updating after a route change.

```typescript
import { updateNotification } from '@gabriel-sisjr/react-native-background-location';

// Update notification text during a trip
await updateNotification({
  title: 'Delivery in Progress',
  text: `Stop 3 of 5 - ETA 10 min`,
});

// Update with new priority
await updateNotification({
  title: 'Almost There',
  text: 'Arriving at destination',
  priority: NotificationPriority.HIGH,
});
```

Only the fields you provide are updated. Fields not specified retain their current values.

## Notification Icons

### Runtime Configuration

Pass drawable resource names (without file extension) to `smallIcon` and `largeIcon`.

```typescript
await startTracking({
  notificationOptions: {
    smallIcon: 'ic_tracking_small',  // res/drawable/ic_tracking_small.png
    largeIcon: 'ic_tracking_large',  // res/drawable/ic_tracking_large.png
  },
});
```

### Static Defaults via AndroidManifest

You can set default notification icons via `<meta-data>` in your `AndroidManifest.xml` instead of passing them at runtime. These are used as fallbacks when no icon is specified in `notificationOptions`.

```xml
<application>
  <meta-data
    android:name="com.backgroundlocation.notification.small_icon"
    android:resource="@drawable/ic_notification" />
  <meta-data
    android:name="com.backgroundlocation.notification.large_icon"
    android:resource="@drawable/ic_notification_large" />
</application>
```

### Icon Resolution Order

1. `smallIcon` / `largeIcon` from `notificationOptions` (runtime)
2. `<meta-data>` values from `AndroidManifest.xml`
3. Convention drawable name (`ic_notification`)
4. System default icon

## Notification Channel

Android 8.0+ requires a notification channel. The library creates one automatically.

```typescript
await startTracking({
  notificationOptions: {
    channelId: 'my_tracking_channel',
    channelName: 'Location Tracking',
    priority: NotificationPriority.LOW,
  },
});
```

> **Important:** On Android 8.0+ (API 26), notification channels are immutable after creation. If you change `channelId` or `channelName` after the channel already exists on a device, the changes will not take effect for that channel. Use a new `channelId` or instruct users to clear notification settings.

## Notification Action Buttons

Add up to 3 interactive buttons to the tracking notification.

### Configuration

```typescript
import type {
  NotificationAction,
} from '@gabriel-sisjr/react-native-background-location';

await startTracking({
  notificationOptions: {
    title: 'Delivery Active',
    text: 'En route to destination',
    actions: [
      { id: 'stop', label: 'Stop' },
      { id: 'pause', label: 'Pause' },
      { id: 'emergency', label: 'SOS' },
    ],
  },
});
```

### Handling Action Presses

Use the `onNotificationAction` callback in `useLocationUpdates` to react to button presses.

```typescript
import {
  useLocationUpdates,
  stopTracking,
} from '@gabriel-sisjr/react-native-background-location';

function TrackingWithActions() {
  useLocationUpdates({
    onNotificationAction: (event) => {
      console.log(`Action pressed: ${event.actionId}`);

      switch (event.actionId) {
        case 'stop':
          stopTracking();
          break;
        case 'pause':
          // Handle pause logic
          break;
        case 'emergency':
          callEmergencyService();
          break;
      }
    },
  });

  return <TrackingUI />;
}
```

### NotificationAction Interface

```typescript
interface NotificationAction {
  id: string;    // Unique identifier for the action
  label: string; // Text displayed on the button
}
```

### NotificationActionEvent

```typescript
interface NotificationActionEvent {
  tripId: string;   // Active trip ID
  actionId: string; // ID of the pressed action
}
```

## Geofence Notifications

Geofence transition notifications support the same `NotificationOptions` interface with the addition of template variables and `transitionOverrides`.

### Global Configuration

```typescript
import { configureGeofenceNotifications } from '@gabriel-sisjr/react-native-background-location';

await configureGeofenceNotifications({
  title: '{{transitionType}} -- {{identifier}}',
  text: 'Geofence transition at {{latitude}}, {{longitude}}',
  channelName: 'Geofence Alerts',
  priority: NotificationPriority.HIGH,
  color: '#FF5722',
  showTimestamp: true,
});
```

### Template Variables

| Variable | Example | Description |
|----------|---------|-------------|
| `{{identifier}}` | `warehouse-north` | Geofence identifier |
| `{{transitionType}}` | `ENTER` | `ENTER`, `EXIT`, or `DWELL` |
| `{{latitude}}` | `-23.5505` | Device latitude at transition |
| `{{longitude}}` | `-46.6333` | Device longitude at transition |
| `{{radius}}` | `200` | Geofence radius in meters |
| `{{timestamp}}` | `2026-03-25T14:30:00Z` | ISO 8601 timestamp |
| `{{metadata.KEY}}` | *(value)* | Metadata field from the geofence |

### Per-Transition Overrides

Customize notification content per transition type.

```typescript
await configureGeofenceNotifications({
  title: 'Geofence Alert',
  text: 'Transition detected',
  transitionOverrides: {
    ENTER: {
      title: 'Entered Zone',
      text: 'You entered {{identifier}}',
      color: '#4CAF50',
    },
    EXIT: {
      title: 'Left Zone',
      text: 'You left {{identifier}}',
      color: '#f44336',
    },
    DWELL: {
      title: 'Dwelling',
      text: 'You have been at {{identifier}} for a while',
      color: '#FF9800',
    },
  },
});
```

### Per-Geofence Overrides

Individual geofences can override the global configuration.

```typescript
import { addGeofence } from '@gabriel-sisjr/react-native-background-location';

// Custom notification for this geofence
await addGeofence({
  identifier: 'headquarters',
  latitude: 40.7128,
  longitude: -74.006,
  radius: 500,
  notificationOptions: {
    title: 'Welcome to HQ!',
    text: 'You arrived at {{identifier}}',
  },
});

// Suppress notifications for this geofence
await addGeofence({
  identifier: 'silent-zone',
  latitude: -23.5505,
  longitude: -46.6333,
  radius: 300,
  notificationOptions: false,
});
```

### Hook-Based Configuration

```typescript
import { useGeofencing } from '@gabriel-sisjr/react-native-background-location';

const { addGeofence } = useGeofencing({
  notificationOptions: {
    title: '{{transitionType}} -- {{identifier}}',
    text: 'Transition at {{latitude}}, {{longitude}}',
  },
});
```

> **Note:** Geofence notification action buttons (`actions` field) are not yet supported. This field is available for foreground service notifications only.

## iOS Considerations

### Tracking

iOS does not use a foreground service. The system displays a blue status bar indicator when the app uses background location. There is no way to customize this indicator -- it is entirely system-managed. All `notificationOptions` for tracking are ignored on iOS.

### Geofence Notifications

iOS geofence notifications use `UNUserNotificationCenter`. The `useLocationPermissions` hook requests notification permission as step 3 of its permission flow on iOS.

Without notification authorization, transition events are still detected and delivered to JS callbacks, but no visual notification is shown.

### Foreground Display

By default, iOS does not display notification banners when the app is in the foreground. To show geofence notifications while the app is open, your `AppDelegate` must implement `UNUserNotificationCenterDelegate` and allow foreground presentation.

## Complete Example

```typescript
import React from 'react';
import { View, Text, Button } from 'react-native';
import {
  useBackgroundLocation,
  useLocationUpdates,
  LocationAccuracy,
  NotificationPriority,
  stopTracking,
} from '@gabriel-sisjr/react-native-background-location';

function NotificationDemo() {
  const { startTracking, isTracking } = useBackgroundLocation();

  useLocationUpdates({
    onNotificationAction: (event) => {
      if (event.actionId === 'stop') {
        stopTracking();
      }
    },
  });

  const handleStart = async () => {
    await startTracking(undefined, {
      accuracy: LocationAccuracy.HIGH_ACCURACY,
      updateInterval: 5000,
      notificationOptions: {
        title: 'Delivery Active',
        text: 'En route to destination',
        priority: NotificationPriority.LOW,
        channelName: 'Delivery Tracking',
        color: '#2196F3',
        showTimestamp: true,
        subtext: 'Background tracking',
        actions: [
          { id: 'stop', label: 'Stop Tracking' },
        ],
      },
    });
  };

  return (
    <View>
      <Text>Tracking: {isTracking ? 'Active' : 'Inactive'}</Text>
      <Button
        title={isTracking ? 'Stop' : 'Start with Custom Notification'}
        onPress={isTracking ? () => stopTracking() : handleStart}
      />
    </View>
  );
}
```

## Next Steps

- [Background Tracking](./background-tracking.md) -- Full TrackingOptions configuration
- [Advanced Geofencing](./geofencing-advanced.md) -- Template variables and per-geofence overrides in depth
- [Permission Handling](./permission-handling.md) -- Notification permission flow on iOS
