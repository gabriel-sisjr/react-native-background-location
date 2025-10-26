# Integration Guide

Step-by-step guide to integrate `react-native-background-location` into your existing React Native app.

## Prerequisites

- React Native 0.70 or higher
- Android minSdkVersion 21+
- Google Play Services available on device
- New Architecture (TurboModules) enabled

## Step 1: Installation

```bash
# Using npm
npm install react-native-background-location

# Using yarn
yarn add react-native-background-location
```

The library uses autolinking, so no manual linking is required.

## Step 2: Android Configuration

### 2.1 Update AndroidManifest.xml

Add the following permissions to `android/app/src/main/AndroidManifest.xml`:

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  
  <!-- Location permissions -->
  <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
  <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
  
  <!-- Background location for Android 10+ -->
  <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
  
  <!-- Foreground service permissions -->
  <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
  <uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />

  <application>
    <!-- Your existing app configuration -->
  </application>
</manifest>
```

### 2.2 Rebuild Your App

```bash
cd android
./gradlew clean
cd ..
yarn start --reset-cache
yarn android
```

## Step 3: Request Permissions

Create a utility function to request permissions:

```typescript
// utils/permissions.ts
import { PermissionsAndroid, Platform } from 'react-native';

export const requestLocationPermissions = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') {
    return true; // iOS permissions to be implemented
  }

  try {
    // First request foreground permissions
    const foregroundGranted = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
    ]);

    const foregroundPermissionsGranted =
      foregroundGranted['android.permission.ACCESS_FINE_LOCATION'] === 'granted' &&
      foregroundGranted['android.permission.ACCESS_COARSE_LOCATION'] === 'granted';

    if (!foregroundPermissionsGranted) {
      return false;
    }

    // Then request background permission (required for Android 10+)
    // Note: On Android 11+, this should be requested in a separate step after foreground
    if (Platform.Version >= 29) {
      const backgroundGranted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION
      );

      return backgroundGranted === 'granted';
    }

    return true;
  } catch (error) {
    console.error('Error requesting location permissions:', error);
    return false;
  }
};
```

## Step 4: Implement Tracking

### 4.1 Create a Location Service Wrapper

```typescript
// services/LocationService.ts
import BackgroundLocation, { type Coords } from 'react-native-background-location';
import { requestLocationPermissions } from '../utils/permissions';

class LocationTrackingService {
  private currentTripId: string | null = null;

  async startTracking(customTripId?: string): Promise<string | null> {
    // Check permissions first
    const hasPermission = await requestLocationPermissions();
    
    if (!hasPermission) {
      throw new Error('Location permissions not granted');
    }

    try {
      const tripId = await BackgroundLocation.startTracking(customTripId);
      this.currentTripId = tripId;
      return tripId;
    } catch (error) {
      console.error('Failed to start tracking:', error);
      throw error;
    }
  }

  async stopTracking(): Promise<void> {
    try {
      await BackgroundLocation.stopTracking();
      this.currentTripId = null;
    } catch (error) {
      console.error('Failed to stop tracking:', error);
      throw error;
    }
  }

  async isTracking(): Promise<{ active: boolean; tripId?: string }> {
    return BackgroundLocation.isTracking();
  }

  async getLocations(tripId?: string): Promise<Coords[]> {
    const id = tripId || this.currentTripId;
    
    if (!id) {
      throw new Error('No trip ID available');
    }

    return BackgroundLocation.getLocations(id);
  }

  async clearTrip(tripId?: string): Promise<void> {
    const id = tripId || this.currentTripId;
    
    if (!id) {
      throw new Error('No trip ID available');
    }

    return BackgroundLocation.clearTrip(id);
  }

  getCurrentTripId(): string | null {
    return this.currentTripId;
  }
}

export default new LocationTrackingService();
```

### 4.2 Use in Your Component

```typescript
// screens/TripScreen.tsx
import { useState, useEffect } from 'react';
import { View, Button, Text, Alert } from 'react-native';
import LocationService from '../services/LocationService';
import type { Coords } from 'react-native-background-location';

export default function TripScreen() {
  const [isTracking, setIsTracking] = useState(false);
  const [tripId, setTripId] = useState<string | null>(null);
  const [locations, setLocations] = useState<Coords[]>([]);

  useEffect(() => {
    // Check if already tracking on mount
    checkTrackingStatus();
  }, []);

  const checkTrackingStatus = async () => {
    const status = await LocationService.isTracking();
    setIsTracking(status.active);
    if (status.tripId) {
      setTripId(status.tripId);
    }
  };

  const handleStartTrip = async () => {
    try {
      const id = await LocationService.startTracking();
      setTripId(id);
      setIsTracking(true);
      Alert.alert('Success', 'Trip started successfully');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleEndTrip = async () => {
    try {
      await LocationService.stopTracking();
      setIsTracking(false);
      Alert.alert('Success', 'Trip ended successfully');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleViewLocations = async () => {
    try {
      const locs = await LocationService.getLocations();
      setLocations(locs);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  return (
    <View style={{ padding: 20 }}>
      <Text>Status: {isTracking ? 'Tracking' : 'Not tracking'}</Text>
      {tripId && <Text>Trip ID: {tripId}</Text>}
      
      <Button
        title={isTracking ? 'End Trip' : 'Start Trip'}
        onPress={isTracking ? handleEndTrip : handleStartTrip}
      />
      
      {isTracking && (
        <Button
          title="View Locations"
          onPress={handleViewLocations}
        />
      )}

      <Text>Locations collected: {locations.length}</Text>
    </View>
  );
}
```

## Step 5: Handle App Lifecycle

Make sure to handle cases where the app is closed and reopened:

```typescript
// App.tsx or your root component
import { useEffect } from 'react';
import LocationService from './services/LocationService';

export default function App() {
  useEffect(() => {
    // Check if there's an active tracking session
    const checkActiveSession = async () => {
      const status = await LocationService.isTracking();
      if (status.active && status.tripId) {
        console.log('Found active tracking session:', status.tripId);
        // Update your app state accordingly
      }
    };

    checkActiveSession();
  }, []);

  // Rest of your app
}
```

## Step 6: Upload Locations to Server

Example of sending locations to your backend:

```typescript
// services/LocationUploadService.ts
import LocationService from './LocationService';

export const uploadTripData = async (tripId: string): Promise<void> => {
  try {
    const locations = await LocationService.getLocations(tripId);
    
    const response = await fetch('https://your-api.com/trips', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tripId,
        locations: locations.map(loc => ({
          latitude: parseFloat(loc.latitude),
          longitude: parseFloat(loc.longitude),
          timestamp: loc.timestamp,
        })),
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to upload trip data');
    }

    // Clear local data after successful upload
    await LocationService.clearTrip(tripId);
  } catch (error) {
    console.error('Upload error:', error);
    throw error;
  }
};
```

## Best Practices

### 1. Always Request Permissions Before Tracking

```typescript
const hasPermission = await requestLocationPermissions();
if (!hasPermission) {
  // Show explanation to user
  // Guide them to settings if needed
  return;
}
```

### 2. Handle Permission Denials Gracefully

```typescript
if (!hasPermission) {
  Alert.alert(
    'Location Permission Required',
    'This app needs location access to track your trips. Please enable location permissions in settings.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Open Settings', onPress: () => Linking.openSettings() },
    ]
  );
}
```

### 3. Stop Tracking When No Longer Needed

```typescript
// Don't leave tracking running indefinitely
await LocationService.stopTracking();
```

### 4. Clear Old Data Regularly

```typescript
// After successful upload
await LocationService.clearTrip(tripId);
```

### 5. Monitor Battery Impact

```typescript
// Consider adding battery optimization warnings
if (Platform.OS === 'android') {
  Alert.alert(
    'Battery Usage',
    'Location tracking in background can impact battery life. You can stop tracking at any time.'
  );
}
```

## Troubleshooting

### Location not updating

1. Verify all permissions are granted
2. Check foreground service is running (notification visible)
3. Test on real device outdoors
4. Check device battery optimization settings

### Build errors

```bash
cd android
./gradlew clean
cd ..
rm -rf node_modules
yarn install
yarn android
```

### Module not found

Ensure autolinking is working:
```bash
npx react-native config
```

## Production Checklist

- [ ] Permissions requested correctly
- [ ] Error handling implemented
- [ ] Battery usage disclosed to users
- [ ] Tracking stopped when not needed
- [ ] Location data uploaded to server
- [ ] Old data cleared after upload
- [ ] App handles being closed/reopened
- [ ] Tested on multiple Android versions
- [ ] Tested with battery optimization enabled
- [ ] Privacy policy updated

## Support

For issues or questions:
- [GitHub Issues](https://github.com/gabriel-sisjr/react-native-background-location/issues)
- [Documentation](README.md)
- [API Reference](README.md#api-reference)

