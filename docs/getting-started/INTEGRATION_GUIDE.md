# Integration Guide

Step-by-step guide to integrate `@gabriel-sisjr/react-native-background-location` into your existing React Native app.

![Background location tracking](../assets/background.gif)

*Background location tracking in action - tracking continues even when the app is minimized.*

## Prerequisites

- React Native 0.70 or higher
- Android minSdkVersion 24+
- Google Play Services available on device
- New Architecture (TurboModules) enabled

## Step 1: Installation

```bash
# Using npm
npm install @gabriel-sisjr/react-native-background-location

# Using yarn
yarn add @gabriel-sisjr/react-native-background-location
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

> **⚠️ Critical for Android 11+:** Background location must be requested **separately** from foreground permissions. Requesting them together will silently fail on Android 11 and above.

Create a utility function to request permissions with proper sequencing:

```typescript
// utils/permissions.ts
import { PermissionsAndroid, Platform, Alert, Linking } from 'react-native';

/**
 * Request location permissions with proper Android 11+ sequencing
 */
export const requestLocationPermissions = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') {
    return true; // iOS permissions to be implemented
  }

  try {
    // Step 1: Request foreground permissions FIRST
    const foregroundResult = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
    ]);

    const foregroundGranted =
      foregroundResult['android.permission.ACCESS_FINE_LOCATION'] === 'granted' ||
      foregroundResult['android.permission.ACCESS_COARSE_LOCATION'] === 'granted';

    if (!foregroundGranted) {
      return false;
    }

    // Step 2: Request background permission SEPARATELY (Android 10+)
    // On Android 11+, this MUST be a separate request
    if (Platform.Version >= 29) {
      // Show explanation before requesting (required for good UX and Play Store)
      const shouldProceed = await new Promise<boolean>((resolve) => {
        Alert.alert(
          'Background Location Required',
          'To track your location when the app is closed or in the background, ' +
          'please select "Allow all the time" on the next screen.\n\n' +
          'This is required for trip tracking to work properly.',
          [
            { text: 'Cancel', onPress: () => resolve(false), style: 'cancel' },
            { text: 'Continue', onPress: () => resolve(true) },
          ]
        );
      });

      if (!shouldProceed) {
        return false;
      }

      const backgroundResult = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION
      );

      return backgroundResult === 'granted';
    }

    return true;
  } catch (error) {
    console.error('Error requesting location permissions:', error);
    return false;
  }
};

/**
 * Check current permission status
 */
export const checkLocationPermissions = async (): Promise<{
  foreground: boolean;
  background: boolean;
}> => {
  if (Platform.OS !== 'android') {
    return { foreground: true, background: true };
  }

  const fine = await PermissionsAndroid.check(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
  );
  const coarse = await PermissionsAndroid.check(
    PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION
  );
  const background = Platform.Version >= 29
    ? await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION
      )
    : true;

  return {
    foreground: fine || coarse,
    background,
  };
};

/**
 * Open app settings for manual permission grant
 */
export const openAppSettings = () => {
  Linking.openSettings();
};
```

## Step 4: Implement Tracking

### 4.1 Create a Location Service Wrapper

```typescript
// services/LocationService.ts
import BackgroundLocation, { type Coords } from '@gabriel-sisjr/react-native-background-location';
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
import type { Coords } from '@gabriel-sisjr/react-native-background-location';

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

## Step 7: Handle Crash Recovery

The library persists tracking state across app restarts. Always check for active sessions:

```typescript
// App.tsx or your root component
import { useEffect, useState } from 'react';
import BackgroundLocation from '@gabriel-sisjr/react-native-background-location';

export default function App() {
  const [recoveredTripId, setRecoveredTripId] = useState<string | null>(null);

  useEffect(() => {
    const recoverSession = async () => {
      try {
        const status = await BackgroundLocation.isTracking();

        if (status.active && status.tripId) {
          // Active session - service is still running
          console.log('Active session found:', status.tripId);
          setRecoveredTripId(status.tripId);
        } else if (status.tripId && !status.active) {
          // Trip exists but service stopped (app was killed)
          console.log('Orphaned trip found:', status.tripId);

          // Option A: Resume tracking
          await BackgroundLocation.startTracking(status.tripId);
          setRecoveredTripId(status.tripId);

          // Option B: Just recover data without resuming
          // const locations = await BackgroundLocation.getLocations(status.tripId);
          // await uploadLocations(status.tripId, locations);
          // await BackgroundLocation.clearTrip(status.tripId);
        }
      } catch (error) {
        console.error('Session recovery failed:', error);
      }
    };

    recoverSession();
  }, []);

  // Pass recoveredTripId to your tracking components
}
```

## Step 8: Google Play Compliance (Required)

Before publishing to Google Play, you **must** complete these steps:

### 8.1 In-App Disclosure

Show a prominent disclosure **before** requesting permissions:

```typescript
async function showLocationDisclosure(): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      'Location Tracking',
      'This app collects location data to track your trips even when the app is ' +
      'closed or not in use.\n\n' +
      'Your location data is used to:\n' +
      '• Record your travel routes\n' +
      '• Calculate trip statistics\n' +
      '• [Add your specific use cases]\n\n' +
      'You can stop tracking at any time from the app.',
      [
        { text: 'Deny', onPress: () => resolve(false), style: 'cancel' },
        { text: 'Accept', onPress: () => resolve(true) },
      ]
    );
  });
}

// Use BEFORE requesting permissions
const handleStartTracking = async () => {
  const accepted = await showLocationDisclosure();
  if (!accepted) return;

  const hasPermission = await requestLocationPermissions();
  if (!hasPermission) return;

  await BackgroundLocation.startTracking();
};
```

### 8.2 Privacy Policy

Your privacy policy **must** mention:
- That you collect location data
- Whether it's collected in the background
- How the data is used
- Retention period
- How users can request deletion

### 8.3 Play Console Declarations

1. **Data Safety Form**: App content → Data safety → Declare location collection
2. **Permissions Declaration**: App content → Sensitive app permissions → Background location

See [Google Play Compliance Guide](../production/GOOGLE_PLAY_COMPLIANCE.md) for complete details.

## Production Checklist

### Permissions & Compliance
- [ ] Android 11+ two-step permission flow implemented
- [ ] In-app disclosure shown before permission request
- [ ] Permission denial handled gracefully
- [ ] Settings redirect for blocked permissions
- [ ] Privacy policy updated with location disclosure
- [ ] Play Console data safety form completed
- [ ] Play Console permissions declaration submitted

### Functionality
- [ ] Crash recovery implemented (`isTracking()` on startup)
- [ ] Error handling for all tracking operations
- [ ] Location data uploaded to server
- [ ] Old data cleared after upload (`clearTrip()`)
- [ ] Tracking stops when no longer needed

### User Experience
- [ ] Battery usage disclosed to users
- [ ] Foreground notification is clear and helpful
- [ ] Loading states shown during operations
- [ ] Errors displayed to users with recovery options

### Testing
- [ ] Tested on real device (not emulator)
- [ ] Tested on Android 10, 11, 12, 13, 14, 15
- [ ] Tested with battery optimization enabled
- [ ] Tested app restart during tracking
- [ ] Tested app kill (swipe from recents)
- [ ] Tested device reboot during tracking
- [ ] Tested poor GPS conditions (indoors)

### Performance
- [ ] Long trip memory management implemented
- [ ] Coordinate parsing for map libraries
- [ ] Optional properties handled correctly

## Troubleshooting

### Background location not working on Android 11+
1. Verify you're requesting permissions in two steps
2. Check that background permission is granted (not just foreground)
3. Verify foreground service notification is visible

### Tracking stops on certain devices
1. Check battery optimization settings
2. See [Battery Optimization Guide](../production/BATTERY_OPTIMIZATION.md)
3. Prompt users to whitelist your app

### Location updates are infrequent
1. Verify `updateInterval` setting
2. Check if in low-power mode
3. Ensure GPS has clear sky view

## Support

For issues or questions:
- [GitHub Issues](https://github.com/gabriel-sisjr/react-native-background-location/issues)
- [Full Documentation](../../README.md)
- [API Reference](../../README.md#api-reference)
- [Hooks Guide](./hooks.md)

