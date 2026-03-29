# Quick Start Guide

Get started with `@gabriel-sisjr/react-native-background-location` in 5 minutes.

![Starting and stopping location tracking](../assets/tracking.gif)

_Example: Starting and stopping location tracking with the library._

## Installation

```bash
npm install @gabriel-sisjr/react-native-background-location
# or
yarn add @gabriel-sisjr/react-native-background-location
```

## Platform Setup

### Android Setup

### 1. Add Permissions

Edit `android/app/src/main/AndroidManifest.xml`:

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

  <!-- Add these permissions -->
  <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
  <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
  <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
  <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
  <uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />

  <application>
    <!-- Your app config -->
  </application>
</manifest>
```

### 2. Request Permissions in Your App

> **⚠️ Critical for Android 11+:** Background location must be requested **separately** from foreground permissions. Requesting them together will silently fail.

```typescript
import { PermissionsAndroid, Platform, Alert } from 'react-native';

const requestPermissions = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') {
    return true;
  }

  // Step 1: Request foreground permissions FIRST
  const foreground = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
  ]);

  const foregroundGranted =
    foreground['android.permission.ACCESS_FINE_LOCATION'] === 'granted' ||
    foreground['android.permission.ACCESS_COARSE_LOCATION'] === 'granted';

  if (!foregroundGranted) {
    return false;
  }

  // Step 2: Request background permission SEPARATELY (Android 10+)
  if (Platform.Version >= 29) {
    // Show explanation before requesting (required for good UX)
    await new Promise<void>((resolve) => {
      Alert.alert(
        'Background Location',
        'To track your location in the background, please select "Allow all the time" on the next screen.',
        [{ text: 'Continue', onPress: () => resolve() }]
      );
    });

    const background = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION
    );

    return background === 'granted';
  }

  return true;
};
```

### 3. Start Tracking

```typescript
import BackgroundLocation, {
  LocationAccuracy,
  NotificationPriority,
  type TrackingOptions,
} from '@gabriel-sisjr/react-native-background-location';

// Request permissions first
const hasPermission = await requestPermissions();

if (hasPermission) {
  // Start tracking with default options
  const tripId = await BackgroundLocation.startTracking();
  console.log('Tracking started:', tripId);

  // Or with custom options
  const options: TrackingOptions = {
    accuracy: LocationAccuracy.HIGH_ACCURACY,
    updateInterval: 5000,
    fastestInterval: 3000,
    distanceFilter: 50, // Only update if moved 50+ meters
    notificationOptions: {
      priority: NotificationPriority.LOW,
      title: 'Tracking Active',
      text: 'Your location is being tracked',
    },
  };

  // Simple start with auto-generated tripId (v0.8.0+)
  const autoTripId = await BackgroundLocation.startTracking(options);

  // Or with custom tripId
  const customTripId = await BackgroundLocation.startTracking(
    'my-custom-trip-id',
    options
  );
}
```

### iOS Setup

#### 1. Add Info.plist Entries

Add the following keys to your `ios/<YourApp>/Info.plist`:

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>We need your location to track your trips.</string>
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>We need your location in the background to continue tracking your trips.</string>
```

#### 2. Enable Background Modes

In Xcode, go to your target's **Signing & Capabilities** tab:

1. Click **+ Capability**
2. Add **Background Modes**
3. Check **Location updates**

#### 3. Install CocoaPods

```bash
cd ios && pod install && cd ..
```

#### 4. Run on iOS

```bash
yarn example ios
```

> **iOS:** The iOS simulator has limited location simulation capabilities. Use **Debug > Simulate Location** in the Simulator menu or configure a GPX file in your Xcode scheme for more realistic testing. For best results, test on a physical iOS device.

> **iOS:** On iOS, there is no foreground notification. Instead, the system displays a blue status bar indicator when the app is tracking location in the background. Notification-related `TrackingOptions` fields are silently ignored on iOS.

### 4. Get Locations

```typescript
// Get all locations for the trip
const locations = await BackgroundLocation.getLocations(tripId);

locations.forEach((location) => {
  console.log('Lat:', location.latitude);
  console.log('Lng:', location.longitude);
  console.log('Time:', new Date(location.timestamp));
});
```

### 5. Stop Tracking

```typescript
// Stop tracking when done
await BackgroundLocation.stopTracking();
```

## Complete Example

```typescript
import React, { useState, useEffect } from 'react';
import { View, Button, Text, Alert, Platform, PermissionsAndroid } from 'react-native';
import BackgroundLocation, {
  LocationAccuracy,
} from '@gabriel-sisjr/react-native-background-location';

export default function App() {
  const [tracking, setTracking] = useState(false);
  const [tripId, setTripId] = useState<string | null>(null);
  const [locationCount, setLocationCount] = useState(0);

  // Check for active session on app start (crash recovery)
  useEffect(() => {
    const checkExistingSession = async () => {
      const status = await BackgroundLocation.isTracking();
      if (status.active && status.tripId) {
        setTracking(true);
        setTripId(status.tripId);
        const locations = await BackgroundLocation.getLocations(status.tripId);
        setLocationCount(locations.length);
      }
    };
    checkExistingSession();
  }, []);

  // Proper Android 11+ permission handling
  const requestPermissions = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true;

    // Step 1: Foreground permissions first
    const foreground = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
    ]);

    const foregroundGranted =
      foreground['android.permission.ACCESS_FINE_LOCATION'] === 'granted' ||
      foreground['android.permission.ACCESS_COARSE_LOCATION'] === 'granted';

    if (!foregroundGranted) return false;

    // Step 2: Background permission separately (Android 10+)
    if (Platform.Version >= 29) {
      await new Promise<void>((resolve) => {
        Alert.alert(
          'Background Location',
          'Select "Allow all the time" to track in background.',
          [{ text: 'Continue', onPress: () => resolve() }]
        );
      });

      const background = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION
      );
      return background === 'granted';
    }

    return true;
  };

  const startTracking = async () => {
    try {
      const hasPermission = await requestPermissions();

      if (!hasPermission) {
        Alert.alert('Error', 'Location permissions required');
        return;
      }

      // Start tracking with custom options (v0.8.0+)
      const id = await BackgroundLocation.startTracking({
        distanceFilter: 50,  // Only update if moved 50+ meters
        updateInterval: 5000,
        accuracy: LocationAccuracy.HIGH_ACCURACY,
      });
      setTripId(id);
      setTracking(true);
      Alert.alert('Success', `Tracking started: ${id}`);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const stopTracking = async () => {
    try {
      await BackgroundLocation.stopTracking();
      setTracking(false);
      Alert.alert('Success', 'Tracking stopped');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const getLocations = async () => {
    if (!tripId) return;

    try {
      const locations = await BackgroundLocation.getLocations(tripId);
      setLocationCount(locations.length);
      Alert.alert('Locations', `Found ${locations.length} location(s)`);
      // Note: latitude/longitude are strings, parse for maps
      locations.forEach((loc) => {
        console.log({
          lat: parseFloat(loc.latitude),
          lng: parseFloat(loc.longitude),
          time: new Date(loc.timestamp),
          accuracy: loc.accuracy, // optional
        });
      });
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 20 }}>
      <Text style={{ fontSize: 20, marginBottom: 20, textAlign: 'center' }}>
        Status: {tracking ? 'TRACKING' : 'STOPPED'}
      </Text>

      {tripId && (
        <>
          <Text style={{ marginBottom: 10, textAlign: 'center' }}>
            Trip ID: {tripId}
          </Text>
          <Text style={{ marginBottom: 20, textAlign: 'center' }}>
            Locations: {locationCount}
          </Text>
        </>
      )}

      <Button
        title={tracking ? 'Stop Tracking' : 'Start Tracking'}
        onPress={tracking ? stopTracking : startTracking}
      />

      {tripId && (
        <View style={{ marginTop: 10 }}>
          <Button title="Get Locations" onPress={getLocations} />
        </View>
      )}
    </View>
  );
}
```

## Quick Tips

### Distance Filter

Set `distanceFilter` to reduce battery usage by only recording locations when the device has moved a minimum distance:

```typescript
const options: TrackingOptions = {
  distanceFilter: 25, // Only record when moved 25+ meters
};
```

Recommended values:

- **Walking**: 10-25 meters
- **Driving**: 50-100 meters
- **Stationary with movement detection**: 5-10 meters

### Callback Throttling with Hooks

Use `onUpdateInterval` in hooks to throttle server sync without affecting location collection:

```typescript
import { useBackgroundLocation } from '@gabriel-sisjr/react-native-background-location';

const { locations } = useBackgroundLocation({
  updateInterval: 5000, // Collect location every 5 seconds
  onUpdateInterval: 30000, // Sync to server every 30 seconds
  onLocationUpdate: async (locations) => {
    // Only called every 30 seconds
    await syncToServer(locations);
  },
});
```

### Simplified API

The v0.8.0 API is cleaner with auto-generated tripIds:

```typescript
// Before (v0.7.x)
const tripId = uuid.v4();
await BackgroundLocation.startTracking(tripId, options);

// After (v0.8.0+)
const tripId = await BackgroundLocation.startTracking(options);
```

## Important Notes

### Coordinates are Strings

Coordinates are returned as strings for precision. Always parse for map libraries:

```typescript
// ✅ Correct
<Marker coordinate={{
  latitude: parseFloat(location.latitude),
  longitude: parseFloat(location.longitude),
}} />

// ❌ Wrong - will cause errors
<Marker coordinate={{ latitude: location.latitude, longitude: location.longitude }} />
```

### Foreground-Only Mode

If background permission is denied or not needed:

```typescript
const tripId = await BackgroundLocation.startTracking(undefined, {
  foregroundOnly: true, // No background permission required
});
```

### Google Play Compliance

Before publishing, ensure you:

1. Add prominent in-app disclosure before requesting permissions
2. Update your privacy policy to mention location tracking
3. Fill out the Play Console permissions declaration form

See [Google Play Compliance](../production/GOOGLE_PLAY_COMPLIANCE.md) for details.

## Next Steps

- Read the [full documentation](../../README.md) for all API methods
- Check the [example app](../../example/) for a complete implementation
- Review [Google Play Compliance](../production/GOOGLE_PLAY_COMPLIANCE.md) before publishing
- Learn about [battery optimization](../production/BATTERY_OPTIMIZATION.md)
- See [troubleshooting guide](../../README.md#troubleshooting)

## Testing

### On Android Device

1. Run on a real Android device (recommended)
2. Grant all location permissions
3. Start tracking and minimize the app
4. Move around with your device
5. Open the app and check locations

### On iOS Device

1. Run on a real iOS device (recommended) or use Simulator with location simulation
2. Grant "While Using" location permission, then grant "Always" when prompted
3. Start tracking and minimize the app
4. Move around with your device
5. Open the app and check locations

### Important Notes

- **Always test on a real device** - emulator/simulator GPS is unreliable
- **Android:** Background permission is critical for Android 10+
- **Android:** Foreground notification will appear when tracking
- **iOS:** Blue status bar indicator will appear when tracking in background
- **iOS:** Use Xcode's location simulation (GPX files) for consistent test data
- **Battery usage** can be significant with high-frequency updates on both platforms

## Common Issues

### Not tracking in background (Android)

- Ensure `ACCESS_BACKGROUND_LOCATION` is granted
- Check battery optimization settings
- Verify foreground service is running (notification visible)

### Not tracking in background (iOS)

- Ensure "Always" location permission is granted (not just "While Using")
- Verify "Location updates" Background Mode is enabled in Xcode
- Check that `NSLocationAlwaysAndWhenInUseUsageDescription` is in Info.plist

### Build errors (Android)

```bash
cd android && ./gradlew clean
cd ..
yarn start --reset-cache
yarn android
```

### Build errors (iOS)

```bash
cd ios && pod install && cd ..
yarn start --reset-cache
yarn example ios
```

### No locations captured

- Check GPS is enabled on device
- Ensure you're outdoors or near windows
- Wait a few seconds after starting tracking
- Verify permissions are granted

## Support

- [GitHub Issues](https://github.com/gabriel-sisjr/react-native-background-location/issues)
- [Full Documentation](README.md)
- [Example App](example/)
