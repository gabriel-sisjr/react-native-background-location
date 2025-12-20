# Battery Optimization Guide

Android manufacturers implement aggressive battery optimization that can kill background services, including location tracking. This guide helps you handle these manufacturer-specific behaviors.

## Understanding the Problem

Android's battery optimization is **not a bug** - it's an intentional feature. However, it can interfere with legitimate background services like location tracking.

### What Happens

1. User starts tracking
2. User minimizes app or turns off screen
3. Manufacturer's battery optimization kicks in
4. Background service is killed
5. Location tracking stops silently
6. User opens app expecting a complete route
7. User sees incomplete data or no data

### Why It Happens

- Android Doze mode (stock Android)
- Manufacturer-specific "battery saver" features
- App standby buckets
- Background execution limits (Android 8+)
- Foreground service timeouts (Android 15+)

## Affected Manufacturers

| Manufacturer | OS Name | Severity | Notes |
|--------------|---------|----------|-------|
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

## Detection and User Guidance

### Detecting Manufacturer

```typescript
import { Platform, NativeModules } from 'react-native';
import DeviceInfo from 'react-native-device-info';

const getManufacturer = async (): Promise<string> => {
  if (Platform.OS !== 'android') return 'unknown';
  return (await DeviceInfo.getManufacturer()).toLowerCase();
};

const hasAggressiveBatteryOptimization = async (): Promise<boolean> => {
  const manufacturer = await getManufacturer();
  return ['xiaomi', 'huawei', 'oppo', 'vivo', 'realme', 'oneplus'].includes(manufacturer);
};
```

### Prompting Users

```typescript
import { Alert, Linking, Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';

async function promptBatteryOptimization() {
  if (Platform.OS !== 'android') return;

  const manufacturer = (await DeviceInfo.getManufacturer()).toLowerCase();

  const instructions = getBatteryInstructions(manufacturer);

  Alert.alert(
    'Keep Tracking Active',
    `To ensure reliable location tracking on your ${manufacturer} device:\n\n${instructions.steps}`,
    [
      { text: 'Later', style: 'cancel' },
      {
        text: 'Open Settings',
        onPress: () => {
          // Open app settings - user must navigate to battery manually
          Linking.openSettings();
        },
      },
    ]
  );
}

function getBatteryInstructions(manufacturer: string): { steps: string } {
  switch (manufacturer) {
    case 'xiaomi':
      return {
        steps:
          '1. Go to Settings → Apps → Manage apps\n' +
          '2. Find this app\n' +
          '3. Enable "Autostart"\n' +
          '4. Set Battery saver to "No restrictions"',
      };

    case 'huawei':
      return {
        steps:
          '1. Go to Settings → Battery → App launch\n' +
          '2. Find this app\n' +
          '3. Toggle OFF automatic management\n' +
          '4. Enable all three toggles (Auto-launch, Secondary launch, Run in background)',
      };

    case 'samsung':
      return {
        steps:
          '1. Go to Settings → Battery\n' +
          '2. Tap "Background usage limits"\n' +
          '3. Tap "Never sleeping apps"\n' +
          '4. Add this app to the list',
      };

    case 'oppo':
    case 'realme':
      return {
        steps:
          '1. Go to Settings → Battery\n' +
          '2. Find this app\n' +
          '3. Enable "Allow background activity"\n' +
          '4. Also check App Management → Auto-startup',
      };

    case 'vivo':
      return {
        steps:
          '1. Go to Settings → Battery\n' +
          '2. Tap "Background power consumption"\n' +
          '3. Find this app\n' +
          '4. Select "Allow"',
      };

    case 'oneplus':
      return {
        steps:
          '1. Go to Settings → Battery → Battery optimization\n' +
          '2. Find this app\n' +
          '3. Select "Don\'t optimize"',
      };

    default:
      return {
        steps:
          '1. Go to Settings → Apps → This app\n' +
          '2. Look for "Battery" or "Power"\n' +
          '3. Select "Unrestricted" or "Don\'t optimize"',
      };
  }
}
```

### When to Show the Prompt

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

const BATTERY_PROMPT_KEY = '@battery_optimization_prompted';

async function shouldShowBatteryPrompt(): Promise<boolean> {
  // Only on Android
  if (Platform.OS !== 'android') return false;

  // Only on problematic manufacturers
  if (!(await hasAggressiveBatteryOptimization())) return false;

  // Only once per install (or once per month)
  const lastPrompt = await AsyncStorage.getItem(BATTERY_PROMPT_KEY);
  if (lastPrompt) {
    const lastDate = new Date(lastPrompt);
    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    if (lastDate > monthAgo) return false;
  }

  return true;
}

async function markBatteryPromptShown() {
  await AsyncStorage.setItem(BATTERY_PROMPT_KEY, new Date().toISOString());
}

// Usage: After first successful tracking start
async function onTrackingStarted() {
  if (await shouldShowBatteryPrompt()) {
    await markBatteryPromptShown();
    promptBatteryOptimization();
  }
}
```

## Manufacturer-Specific Settings

### Xiaomi (MIUI)

**Path:** Settings → Apps → Manage apps → [Your App]

**Required settings:**
1. **Autostart**: Enable
2. **Battery saver**: No restrictions
3. **Power saving**: Not in power saving list

**Additional:**
- Security app → Permissions → Autostart → Enable
- In recent apps, lock the app (pull down on app card)

### Huawei (EMUI / HarmonyOS)

**Path:** Settings → Battery → App launch → [Your App]

**Required settings:**
1. Toggle OFF "Manage automatically"
2. Enable:
   - Auto-launch: ON
   - Secondary launch: ON
   - Run in background: ON

**Additional:**
- Settings → Apps → [Your App] → Battery → Unmonitored
- Phone Manager → Battery → Protected apps → Add

### Samsung (OneUI)

**Path:** Settings → Battery → Background usage limits

**Required settings:**
1. Never sleeping apps → Add your app
2. Remove from "Sleeping apps" if present
3. Remove from "Deep sleeping apps" if present

**Additional:**
- Settings → Apps → [Your App] → Battery → Unrestricted

### Oppo / Realme (ColorOS)

**Path:** Settings → Battery → [Your App]

**Required settings:**
1. Allow background activity: Enable
2. Allow auto-launch: Enable

**Additional:**
- Settings → App Management → App list → [Your App] → Power saver → Allow

### Vivo (FuntouchOS)

**Path:** Settings → Battery → Background power consumption

**Required settings:**
1. Find your app
2. Set to "Allow"

**Additional:**
- i Manager → App manager → Autostart → Enable

### OnePlus (OxygenOS)

**Path:** Settings → Battery → Battery optimization

**Required settings:**
1. Find your app
2. Select "Don't optimize"

## Library Configuration for Battery Efficiency

### Use Appropriate Accuracy

```typescript
import { LocationAccuracy } from '@gabriel-sisjr/react-native-background-location';

// For most tracking use cases
const balancedOptions = {
  accuracy: LocationAccuracy.BALANCED_POWER_ACCURACY,
  updateInterval: 10000, // 10 seconds
};

// For walking/cycling (needs more precision)
const highAccuracyOptions = {
  accuracy: LocationAccuracy.HIGH_ACCURACY,
  updateInterval: 5000, // 5 seconds
};

// For driving (can be less frequent)
const drivingOptions = {
  accuracy: LocationAccuracy.BALANCED_POWER_ACCURACY,
  updateInterval: 15000, // 15 seconds
};
```

### Use Appropriate Intervals

| Use Case | Interval | Accuracy | Battery Impact |
|----------|----------|----------|----------------|
| Walking | 5 sec | HIGH_ACCURACY | High |
| Cycling | 5-10 sec | HIGH_ACCURACY | Medium-High |
| Driving | 10-15 sec | BALANCED | Medium |
| Long trip | 30+ sec | LOW_POWER | Low |
| Background check-in | 60+ sec | LOW_POWER | Very Low |

### Dynamic Configuration

```typescript
// Adjust based on speed
function getTrackingOptions(currentSpeed: number): TrackingOptions {
  if (currentSpeed > 20) {
    // Driving (> 72 km/h)
    return {
      updateInterval: 15000,
      accuracy: LocationAccuracy.BALANCED_POWER_ACCURACY,
    };
  } else if (currentSpeed > 5) {
    // Cycling/Running (> 18 km/h)
    return {
      updateInterval: 8000,
      accuracy: LocationAccuracy.HIGH_ACCURACY,
    };
  } else {
    // Walking
    return {
      updateInterval: 5000,
      accuracy: LocationAccuracy.HIGH_ACCURACY,
    };
  }
}
```

## Handling SERVICE_TIMEOUT (Android 15+)

Android 15 introduces stricter foreground service time limits. Handle the warning:

```typescript
import { useLocationUpdates } from '@gabriel-sisjr/react-native-background-location';

function TrackingScreen() {
  useLocationUpdates({
    onLocationWarning: (warning) => {
      if (warning.type === 'SERVICE_TIMEOUT') {
        // Service will automatically restart
        // Log for analytics
        console.log('Service timeout - restarting');

        // Optionally notify user
        // (The service restarts automatically, so no action needed)
      }
    },
  });
}
```

## Testing Battery Optimization

### Test Scenarios

1. **Basic background test**
   - Start tracking
   - Lock screen
   - Wait 30 minutes
   - Unlock and check locations

2. **App kill test**
   - Start tracking
   - Swipe app from recents
   - Wait 15 minutes
   - Open app and check

3. **Reboot test**
   - Start tracking
   - Reboot device
   - Open app and check

4. **Multiple app test**
   - Start tracking
   - Use other apps heavily
   - Return and check

### Testing on Specific Devices

Before release, test on devices from problematic manufacturers:
- Xiaomi (any MIUI device)
- Samsung (any OneUI device)
- Huawei (if available)

### Emulating Battery Optimization

```bash
# Put device in Doze mode
adb shell dumpsys deviceidle force-idle

# Exit Doze mode
adb shell dumpsys deviceidle unforce

# Check app standby bucket
adb shell am get-standby-bucket your.package.name

# Set standby bucket (ACTIVE, WORKING_SET, FREQUENT, RARE, RESTRICTED)
adb shell am set-standby-bucket your.package.name active
```

## User Education

### In-App Battery Guide

Consider adding a help screen explaining battery settings:

```typescript
function BatteryHelpScreen() {
  return (
    <ScrollView>
      <Text style={styles.title}>Keeping Tracking Active</Text>

      <Text style={styles.body}>
        Some phones have aggressive battery optimization that can stop
        tracking when the app is in the background.
      </Text>

      <Text style={styles.subtitle}>Signs of Battery Optimization Issues:</Text>
      <Text style={styles.bullet}>• Gaps in your recorded routes</Text>
      <Text style={styles.bullet}>• Tracking stops after a few minutes</Text>
      <Text style={styles.bullet}>• Fewer location points than expected</Text>

      <Text style={styles.subtitle}>How to Fix:</Text>
      <Text style={styles.body}>
        Open your phone's Settings and find battery optimization for this app.
        Select "Unrestricted" or "Don't optimize".
      </Text>

      <Button
        title="Open Device Settings"
        onPress={() => Linking.openSettings()}
      />

      <Text style={styles.link} onPress={() => openUrl('https://dontkillmyapp.com/')}>
        See detailed instructions for your phone brand →
      </Text>
    </ScrollView>
  );
}
```

### Link to DontKillMyApp

The website [dontkillmyapp.com](https://dontkillmyapp.com/) maintains up-to-date instructions for all manufacturers:

```typescript
const openBatteryHelp = async () => {
  const manufacturer = (await DeviceInfo.getManufacturer()).toLowerCase();
  const url = `https://dontkillmyapp.com/${manufacturer}`;

  try {
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      await Linking.openURL('https://dontkillmyapp.com/');
    }
  } catch {
    await Linking.openURL('https://dontkillmyapp.com/');
  }
};
```

## Troubleshooting

### Tracking Stops After Few Minutes

1. Check battery optimization settings
2. Verify foreground service notification is visible
3. Test on different device/manufacturer

### Gaps in Route

1. Increase `updateInterval` (paradoxically, less frequent = more reliable)
2. Use `BALANCED_POWER_ACCURACY` instead of `HIGH_ACCURACY`
3. Check for manufacturer-specific issues

### Service Killed Immediately

1. Check that foreground service permission is granted
2. Verify notification channel is created
3. Check for memory pressure issues

### Works on Emulator, Not on Device

1. Emulators don't have manufacturer optimizations
2. Always test on real devices before release
3. Test on devices from problematic manufacturers

## See Also

- [dontkillmyapp.com](https://dontkillmyapp.com/) - Comprehensive manufacturer database
- [Crash Recovery Guide](./CRASH_RECOVERY.md) - Handling service restarts
- [Google Play Compliance](./GOOGLE_PLAY_COMPLIANCE.md) - Related requirements
- [Real-Time Updates Guide](../getting-started/REAL_TIME_UPDATES.md) - Handling warnings
