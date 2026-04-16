---
sidebar_position: 8
title: Battery Optimization
description: Battery management guide for background location tracking — distanceFilter optimization, accuracy trade-offs, Android manufacturer-specific issues, Doze mode, iOS background behavior, and recommended settings per use case.
keywords:
  - battery optimization
  - distanceFilter
  - accuracy
  - Doze mode
  - Xiaomi
  - Huawei
  - Samsung
  - battery saver
  - background location
  - iOS background
  - React Native
---

# Battery Optimization

This guide covers battery management for background location tracking on Android and iOS. Android manufacturers implement aggressive battery optimization that can kill background services. iOS manages battery through system-level controls.

## Understanding the Problem

On Android, aggressive battery optimization is an intentional feature -- not a bug. However, it can interfere with legitimate background services like location tracking.

### What Happens

1. User starts tracking
2. User minimizes app or turns off screen
3. Manufacturer's battery optimization kicks in
4. Background service is killed
5. Location tracking stops silently
6. User opens app expecting a complete route
7. User sees incomplete data

### Why It Happens

- Android Doze mode (stock Android)
- Manufacturer-specific "battery saver" features
- App standby buckets
- Background execution limits (Android 8+)
- Foreground service timeouts (Android 15+)

## Affected Manufacturers

| Manufacturer | OS | Severity | Notes |
|-------------|-----|----------|-------|
| Xiaomi | MIUI | High | Multiple restrictions, requires autostart |
| Huawei | EMUI/HarmonyOS | High | Protected apps list, app launch management |
| Samsung | OneUI | Medium | Sleeping apps, deep sleeping apps |
| Oppo | ColorOS | High | Battery optimization, auto-start management |
| Vivo | FuntouchOS | High | Background app management |
| OnePlus | OxygenOS | Medium | Battery optimization settings |
| Realme | Realme UI | High | Same as Oppo (ColorOS based) |
| Asus | ZenUI | Medium | Auto-start manager |
| Nokia | Stock+ | Low | Mostly stock Android behavior |
| Pixel | Stock | Low | Standard Doze, predictable behavior |

## Accuracy vs. Battery Trade-offs

### Accuracy Levels

```typescript
import { LocationAccuracy } from '@gabriel-sisjr/react-native-background-location';
import type { TrackingOptions } from '@gabriel-sisjr/react-native-background-location';

// Walking/cycling -- needs precision
const highAccuracyOptions: TrackingOptions = {
  accuracy: LocationAccuracy.HIGH_ACCURACY,
  updateInterval: 5000,
};

// General driving
const balancedOptions: TrackingOptions = {
  accuracy: LocationAccuracy.BALANCED_POWER_ACCURACY,
  updateInterval: 10000,
};

// Long-haul driving
const drivingOptions: TrackingOptions = {
  accuracy: LocationAccuracy.BALANCED_POWER_ACCURACY,
  updateInterval: 15000,
};
```

### Recommended Settings by Use Case

| Use Case | Interval | Accuracy | Distance Filter | Battery Impact |
|----------|----------|----------|-----------------|----------------|
| Walking / fitness | 5 sec | `HIGH_ACCURACY` | 10-25 m | High |
| Cycling | 5-10 sec | `HIGH_ACCURACY` | 25-50 m | Medium-High |
| Driving / delivery | 10-15 sec | `BALANCED_POWER_ACCURACY` | 50-100 m | Medium |
| Long trip | 30+ sec | `LOW_POWER` | 100-200 m | Low |
| Background check-in | 60+ sec | `LOW_POWER` | 500+ m | Very Low |

## Distance Filter Optimization

The `distanceFilter` option reduces battery consumption by suppressing location updates until the device has moved a minimum distance. This is the single most effective battery optimization.

```typescript
import {
  startTracking,
  LocationAccuracy,
} from '@gabriel-sisjr/react-native-background-location';
import type { TrackingOptions } from '@gabriel-sisjr/react-native-background-location';

// Only receive updates when the user moves 50+ meters
const batteryEfficientOptions: TrackingOptions = {
  accuracy: LocationAccuracy.BALANCED_POWER_ACCURACY,
  distanceFilter: 50,
  updateInterval: 10000,
};

await startTracking(batteryEfficientOptions);
```

### Platform Behavior

| Platform | Implementation | Notes |
|----------|---------------|-------|
| Android | `setMinUpdateDistanceMeters` | Works with all location providers |
| iOS | `CLLocationManager.distanceFilter` | Direct mapping to the native property |

### Recommended Distance Filter Values

- **Walking:** 10-25 meters
- **Driving:** 50-100 meters
- **City-level check-in:** 200-500 meters

## Dynamic Configuration

Adjust tracking settings based on the user's current speed or activity.

```typescript
import { LocationAccuracy } from '@gabriel-sisjr/react-native-background-location';
import type { TrackingOptions } from '@gabriel-sisjr/react-native-background-location';

function getTrackingOptions(currentSpeed: number): TrackingOptions {
  if (currentSpeed > 20) {
    // Driving (> 72 km/h)
    return {
      updateInterval: 15000,
      accuracy: LocationAccuracy.BALANCED_POWER_ACCURACY,
      distanceFilter: 100,
    };
  } else if (currentSpeed > 5) {
    // Cycling/Running (> 18 km/h)
    return {
      updateInterval: 8000,
      accuracy: LocationAccuracy.HIGH_ACCURACY,
      distanceFilter: 25,
    };
  } else {
    // Walking
    return {
      updateInterval: 5000,
      accuracy: LocationAccuracy.HIGH_ACCURACY,
      distanceFilter: 10,
    };
  }
}
```

## Handling SERVICE_TIMEOUT (Android 15+)

Android 15 introduces stricter foreground service time limits. The library handles this automatically by restarting the service, but you should monitor the warning.

```typescript
import { useLocationUpdates } from '@gabriel-sisjr/react-native-background-location';

function TrackingScreen() {
  useLocationUpdates({
    onLocationWarning: (warning) => {
      if (warning.type === 'SERVICE_TIMEOUT') {
        // Service auto-restarts, log for analytics
        console.log('Service timeout -- restarting');
      }
    },
  });
}
```

## Android Manufacturer-Specific Settings

### Xiaomi (MIUI)

**Path:** Settings > Apps > Manage apps > [Your App]

1. Enable **Autostart**
2. Set **Battery saver** to "No restrictions"
3. Remove from power saving list

**Additional:** In Security app: Permissions > Autostart > Enable. In recent apps: lock the app (pull down on the app card).

### Huawei (EMUI / HarmonyOS)

**Path:** Settings > Battery > App launch > [Your App]

1. Toggle OFF "Manage automatically"
2. Enable all three toggles:
   - Auto-launch: ON
   - Secondary launch: ON
   - Run in background: ON

**Additional:** Settings > Apps > [Your App] > Battery > Unmonitored.

### Samsung (OneUI)

**Path:** Settings > Battery > Background usage limits

1. Add to **Never sleeping apps**
2. Remove from "Sleeping apps" if present
3. Remove from "Deep sleeping apps" if present

**Additional:** Settings > Apps > [Your App] > Battery > Unrestricted.

### Oppo / Realme (ColorOS)

**Path:** Settings > Battery > [Your App]

1. Enable **Allow background activity**
2. Enable **Allow auto-launch**

### Vivo (FuntouchOS)

**Path:** Settings > Battery > Background power consumption

1. Find your app
2. Set to **Allow**

### OnePlus (OxygenOS)

**Path:** Settings > Battery > Battery optimization

1. Find your app
2. Select **Don't optimize**

## Detecting and Prompting Users

### Detecting Problematic Manufacturers

```typescript
import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';

const hasAggressiveBatteryOptimization = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') return false;
  const manufacturer = (await DeviceInfo.getManufacturer()).toLowerCase();
  return ['xiaomi', 'huawei', 'oppo', 'vivo', 'realme', 'oneplus'].includes(
    manufacturer
  );
};
```

### Showing Battery Optimization Guidance

```typescript
import { Alert, Linking, Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';

async function promptBatteryOptimization() {
  if (Platform.OS !== 'android') return;

  const manufacturer = (await DeviceInfo.getManufacturer()).toLowerCase();
  const instructions = getBatteryInstructions(manufacturer);

  Alert.alert(
    'Keep Tracking Active',
    `To ensure reliable tracking on your ${manufacturer} device:\n\n${instructions}`,
    [
      { text: 'Later', style: 'cancel' },
      { text: 'Open Settings', onPress: () => Linking.openSettings() },
    ]
  );
}

function getBatteryInstructions(manufacturer: string): string {
  switch (manufacturer) {
    case 'xiaomi':
      return (
        '1. Go to Settings > Apps > Manage apps\n' +
        '2. Find this app\n' +
        '3. Enable "Autostart"\n' +
        '4. Set Battery saver to "No restrictions"'
      );
    case 'huawei':
      return (
        '1. Go to Settings > Battery > App launch\n' +
        '2. Find this app\n' +
        '3. Toggle OFF automatic management\n' +
        '4. Enable all three toggles'
      );
    case 'samsung':
      return (
        '1. Go to Settings > Battery\n' +
        '2. Tap "Background usage limits"\n' +
        '3. Tap "Never sleeping apps"\n' +
        '4. Add this app to the list'
      );
    default:
      return (
        '1. Go to Settings > Apps > This app\n' +
        '2. Look for "Battery" or "Power"\n' +
        '3. Select "Unrestricted" or "Don\'t optimize"'
      );
  }
}
```

### When to Show the Prompt

Show the battery optimization prompt after the first successful tracking start, and limit to once per install (or once per month).

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

const BATTERY_PROMPT_KEY = '@battery_optimization_prompted';

async function shouldShowBatteryPrompt(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  if (!(await hasAggressiveBatteryOptimization())) return false;

  const lastPrompt = await AsyncStorage.getItem(BATTERY_PROMPT_KEY);
  if (lastPrompt) {
    const lastDate = new Date(lastPrompt);
    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    if (lastDate > monthAgo) return false;
  }
  return true;
}

async function onTrackingStarted() {
  if (await shouldShowBatteryPrompt()) {
    await AsyncStorage.setItem(BATTERY_PROMPT_KEY, new Date().toISOString());
    promptBatteryOptimization();
  }
}
```

## iOS Battery Management

iOS handles background location differently from Android. There are no manufacturer-specific issues, but system-level settings affect battery life.

### How iOS Background Location Works

iOS does not use a foreground service. `CLLocationManager` delivers location updates in the background, and the system manages when and how often updates are delivered.

### Accuracy Level Impact on iOS

| Accuracy | iOS Equivalent | Battery Impact | Use Case |
|----------|---------------|----------------|----------|
| `HIGH_ACCURACY` | `kCLLocationAccuracyBest` | Highest | Walking, precise tracking |
| `BALANCED_POWER_ACCURACY` | `kCLLocationAccuracyHundredMeters` | Medium | General navigation |
| `LOW_POWER` | `kCLLocationAccuracyKilometer` | Low | City-level tracking |
| `NO_POWER` / `PASSIVE` | `kCLLocationAccuracyThreeKilometers` | Minimal | Regional tracking |

### Distance Filter on iOS

The `distanceFilter` option maps directly to `CLLocationManager.distanceFilter`.

```typescript
const batteryEfficientOptions: TrackingOptions = {
  accuracy: LocationAccuracy.BALANCED_POWER_ACCURACY,
  distanceFilter: 50, // Only update on 50+ meter movement
};
```

### iOS Automatic Pause

iOS can automatically pause location updates when it detects the user is stationary. This is enabled by default and dramatically saves battery. Updates resume automatically when movement is detected.

> **Note:** When iOS pauses updates, no warning event is emitted. Updates simply resume when movement is detected. This is normal behavior.

### iOS Low Power Mode

When the user enables Low Power Mode on iOS:

- Location update frequency may be reduced
- Less accurate location sources may be used
- Background updates may be delayed

Your app cannot override Low Power Mode. Handle reduced update frequency gracefully.

### iOS Battery Tips

1. **Use `BALANCED_POWER_ACCURACY`** unless you need meter-level precision
2. **Use `distanceFilter`** to avoid updates when stationary
3. **Allow automatic pause** (enabled by default) unless continuous tracking is critical
4. **Do not poll for locations** -- use the event-driven `useLocationUpdates` hook

## In-App Battery Help Screen

Consider adding a help screen for users experiencing tracking issues.

```typescript
import React from 'react';
import { ScrollView, Text, Button, Linking } from 'react-native';

function BatteryHelpScreen() {
  return (
    <ScrollView style={{ padding: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: 'bold' }}>
        Keeping Tracking Active
      </Text>

      <Text style={{ marginTop: 12 }}>
        Some phones have aggressive battery optimization that can stop
        tracking when the app is in the background.
      </Text>

      <Text style={{ fontSize: 16, fontWeight: '600', marginTop: 16 }}>
        Signs of Battery Optimization Issues:
      </Text>
      <Text>- Gaps in your recorded routes</Text>
      <Text>- Tracking stops after a few minutes</Text>
      <Text>- Fewer location points than expected</Text>

      <Text style={{ fontSize: 16, fontWeight: '600', marginTop: 16 }}>
        How to Fix:
      </Text>
      <Text>
        Open your phone Settings and find battery optimization for this app.
        Select "Unrestricted" or "Don't optimize".
      </Text>

      <Button
        title="Open Device Settings"
        onPress={() => Linking.openSettings()}
      />

      <Text
        style={{ color: '#2196F3', marginTop: 16 }}
        onPress={() => Linking.openURL('https://dontkillmyapp.com/')}
      >
        See detailed instructions for your phone brand
      </Text>
    </ScrollView>
  );
}
```

The website [dontkillmyapp.com](https://dontkillmyapp.com/) maintains up-to-date instructions for all manufacturers.

## Testing Battery Optimization

### Test Scenarios

1. **Basic background test:** Start tracking, lock screen, wait 30 minutes, unlock and check locations.
2. **App kill test:** Start tracking, swipe from recents, wait 15 minutes, open and check.
3. **Reboot test:** Start tracking, reboot device, open app and check.
4. **Multiple app test:** Start tracking, use other apps heavily, return and check.

### Emulating Doze Mode (ADB)

```bash
# Put device in Doze mode
adb shell dumpsys deviceidle force-idle

# Exit Doze mode
adb shell dumpsys deviceidle unforce

# Check app standby bucket
adb shell am get-standby-bucket your.package.name

# Set standby bucket
adb shell am set-standby-bucket your.package.name active
```

### Device Testing

Before release, test on devices from problematic manufacturers. Emulators do not have manufacturer-specific optimizations, so always test on real hardware.

## Troubleshooting

### Tracking Stops After a Few Minutes

1. Check battery optimization settings for the specific manufacturer
2. Verify the foreground service notification is visible
3. Test on a different device/manufacturer

### Gaps in Route

1. Increase `distanceFilter` (less frequent but more reliable)
2. Use `BALANCED_POWER_ACCURACY` instead of `HIGH_ACCURACY`
3. Check for manufacturer-specific battery restrictions

### Service Killed Immediately

1. Check that foreground service permission is granted
2. Verify notification channel is created
3. Check for memory pressure issues

### Works on Emulator, Not on Device

1. Emulators do not have manufacturer optimizations
2. Always test on real devices before release
3. Prioritize testing on Xiaomi, Samsung, and Huawei devices

## Next Steps

- [Crash Recovery](./crash-recovery) -- How the library recovers from service kills
- [Background Tracking](./background-tracking) -- TrackingOptions and distance filter configuration
- [Real-Time Updates](./real-time-updates) -- Handling SERVICE_TIMEOUT warnings
