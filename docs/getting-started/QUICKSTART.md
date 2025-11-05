# Quick Start Guide

Get started with `@gabriel-sisjr/react-native-background-location` in 5 minutes.

![Starting and stopping location tracking](../assets/tracking.gif)

*Example: Starting and stopping location tracking with the library.*

## Installation

```bash
npm install @gabriel-sisjr/react-native-background-location
# or
yarn add @gabriel-sisjr/react-native-background-location
```

## Android Setup

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

```typescript
import { PermissionsAndroid } from 'react-native';

const requestPermissions = async () => {
  const granted = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
    PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
  ]);

  return Object.values(granted).every(g => g === 'granted');
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
    notificationPriority: NotificationPriority.LOW,
  };
  const customTripId = await BackgroundLocation.startTracking(undefined, options);
}
```

### 4. Get Locations

```typescript
// Get all locations for the trip
const locations = await BackgroundLocation.getLocations(tripId);

locations.forEach(location => {
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
import React, { useState } from 'react';
import { View, Button, Text, Alert, PermissionsAndroid } from 'react-native';
import BackgroundLocation from '@gabriel-sisjr/react-native-background-location';

export default function App() {
  const [tracking, setTracking] = useState(false);
  const [tripId, setTripId] = useState<string | null>(null);

  const requestPermissions = async () => {
    const granted = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
      PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
    ]);

    return Object.values(granted).every(g => g === 'granted');
  };

  const startTracking = async () => {
    try {
      const hasPermission = await requestPermissions();
      
      if (!hasPermission) {
        Alert.alert('Error', 'Location permissions required');
        return;
      }

      const id = await BackgroundLocation.startTracking();
      setTripId(id);
      setTracking(true);
      Alert.alert('Success', `Tracking started: ${id}`);
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const stopTracking = async () => {
    try {
      await BackgroundLocation.stopTracking();
      setTracking(false);
      Alert.alert('Success', 'Tracking stopped');
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const getLocations = async () => {
    if (!tripId) return;

    try {
      const locations = await BackgroundLocation.getLocations(tripId);
      Alert.alert('Locations', `Found ${locations.length} location(s)`);
      console.log(locations);
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 20 }}>
      <Text style={{ fontSize: 20, marginBottom: 20, textAlign: 'center' }}>
        Status: {tracking ? 'TRACKING' : 'STOPPED'}
      </Text>

      {tripId && (
        <Text style={{ marginBottom: 20, textAlign: 'center' }}>
          Trip ID: {tripId}
        </Text>
      )}

      <Button
        title={tracking ? 'Stop Tracking' : 'Start Tracking'}
        onPress={tracking ? stopTracking : startTracking}
      />

      {tripId && (
        <Button
          title="Get Locations"
          onPress={getLocations}
        />
      )}
    </View>
  );
}
```

## Next Steps

- Read the [full documentation](README.md) for all API methods
- Check the [example app](example/) for a complete implementation
- Learn about [battery optimization](README.md#battery-optimization)
- See [troubleshooting guide](README.md#troubleshooting)

## Testing

### On Device
1. Run on a real Android device (recommended)
2. Grant all location permissions
3. Start tracking and minimize the app
4. Move around with your device
5. Open the app and check locations

### Important Notes

- **Always test on a real device** - emulator GPS is unreliable
- **Background permission** is critical for Android 10+
- **Foreground notification** will appear when tracking
- **Battery usage** can be significant with high-frequency updates

## Common Issues

### Not tracking in background
- Ensure `ACCESS_BACKGROUND_LOCATION` is granted
- Check battery optimization settings
- Verify foreground service is running (notification visible)

### Build errors
```bash
cd android && ./gradlew clean
cd ..
yarn start --reset-cache
yarn android
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

