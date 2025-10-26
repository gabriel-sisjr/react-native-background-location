import { useState, useEffect } from 'react';
import {
  Text,
  View,
  StyleSheet,
  Button,
  ScrollView,
  PermissionsAndroid,
  Platform,
  Alert,
  SafeAreaView,
} from 'react-native';
import BackgroundLocation, {
  type Coords,
} from 'react-native-background-location';

export default function App() {
  const [isTracking, setIsTracking] = useState(false);
  const [currentTripId, setCurrentTripId] = useState<string | null>(null);
  const [locations, setLocations] = useState<Coords[]>([]);
  const [permissionGranted, setPermissionGranted] = useState(false);

  useEffect(() => {
    checkTrackingStatus();
  }, []);

  const checkTrackingStatus = async () => {
    try {
      const status = await BackgroundLocation.isTracking();
      setIsTracking(status.active);
      setCurrentTripId(status.tripId || null);
    } catch (error) {
      console.error('Error checking tracking status:', error);
    }
  };

  const requestLocationPermissions = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
          PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
        ]);

        const allGranted =
          granted['android.permission.ACCESS_FINE_LOCATION'] === 'granted' &&
          granted['android.permission.ACCESS_COARSE_LOCATION'] === 'granted' &&
          granted['android.permission.ACCESS_BACKGROUND_LOCATION'] ===
            'granted';

        setPermissionGranted(allGranted);

        if (!allGranted) {
          Alert.alert(
            'Permissions Required',
            'This app needs location permissions (including background) to track your location.',
            [{ text: 'OK' }]
          );
        }

        return allGranted;
      } catch (error) {
        console.error('Error requesting permissions:', error);
        return false;
      }
    }
    return true;
  };

  const handleStartTracking = async () => {
    const hasPermission =
      permissionGranted || (await requestLocationPermissions());

    if (!hasPermission) {
      Alert.alert(
        'Error',
        'Location permissions are required to start tracking'
      );
      return;
    }

    try {
      const tripId = await BackgroundLocation.startTracking();
      setCurrentTripId(tripId);
      setIsTracking(true);
      Alert.alert('Success', `Tracking started with trip ID: ${tripId}`);
    } catch (error: any) {
      console.error('Error starting tracking:', error);
      Alert.alert('Error', `Failed to start tracking: ${error.message}`);
    }
  };

  const handleStopTracking = async () => {
    try {
      await BackgroundLocation.stopTracking();
      setIsTracking(false);
      Alert.alert('Success', 'Tracking stopped');
    } catch (error: any) {
      console.error('Error stopping tracking:', error);
      Alert.alert('Error', `Failed to stop tracking: ${error.message}`);
    }
  };

  const handleGetLocations = async () => {
    if (!currentTripId) {
      Alert.alert('Error', 'No active trip ID');
      return;
    }

    try {
      const locs = await BackgroundLocation.getLocations(currentTripId);
      setLocations(locs);
      Alert.alert('Success', `Retrieved ${locs.length} location(s)`);
    } catch (error: any) {
      console.error('Error getting locations:', error);
      Alert.alert('Error', `Failed to get locations: ${error.message}`);
    }
  };

  const handleClearTrip = async () => {
    if (!currentTripId) {
      Alert.alert('Error', 'No active trip ID');
      return;
    }

    Alert.alert(
      'Clear Trip Data',
      `Are you sure you want to clear all data for trip ${currentTripId}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await BackgroundLocation.clearTrip(currentTripId);
              setLocations([]);
              Alert.alert('Success', 'Trip data cleared');
            } catch (error: any) {
              console.error('Error clearing trip:', error);
              Alert.alert('Error', `Failed to clear trip: ${error.message}`);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
      >
        <Text style={styles.title}>Background Location Example</Text>

        <View style={styles.statusContainer}>
          <Text style={styles.statusLabel}>Status:</Text>
          <Text
            style={[
              styles.statusText,
              isTracking ? styles.tracking : styles.stopped,
            ]}
          >
            {isTracking ? 'TRACKING' : 'STOPPED'}
          </Text>
        </View>

        {currentTripId && (
          <View style={styles.tripIdContainer}>
            <Text style={styles.label}>Current Trip ID:</Text>
            <Text style={styles.tripId}>{currentTripId}</Text>
          </View>
        )}

        <View style={styles.buttonContainer}>
          {!permissionGranted && (
            <Button
              title="Request Permissions"
              onPress={requestLocationPermissions}
              color="#4CAF50"
            />
          )}

          {!isTracking ? (
            <Button
              title="Start Tracking"
              onPress={handleStartTracking}
              color="#2196F3"
            />
          ) : (
            <Button
              title="Stop Tracking"
              onPress={handleStopTracking}
              color="#f44336"
            />
          )}

          <Button
            title="Get Locations"
            onPress={handleGetLocations}
            disabled={!currentTripId}
            color="#FF9800"
          />

          <Button
            title="Clear Trip Data"
            onPress={handleClearTrip}
            disabled={!currentTripId}
            color="#9C27B0"
          />
        </View>

        <View style={styles.locationsContainer}>
          <Text style={styles.sectionTitle}>
            Locations ({locations.length}):
          </Text>

          {locations.length === 0 ? (
            <Text style={styles.emptyText}>No locations yet</Text>
          ) : (
            locations.map((location, index) => (
              <View key={index} style={styles.locationItem}>
                <Text style={styles.locationText}>
                  #{index + 1} - Lat: {location.latitude}, Lng:{' '}
                  {location.longitude}
                </Text>
                <Text style={styles.timestampText}>
                  {new Date(location.timestamp).toLocaleString()}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#fff',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusLabel: {
    fontSize: 18,
    fontWeight: '600',
    marginRight: 10,
    color: '#666',
  },
  statusText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  tracking: {
    color: '#4CAF50',
  },
  stopped: {
    color: '#f44336',
  },
  tripIdContainer: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#fff',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  label: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  tripId: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#333',
  },
  buttonContainer: {
    gap: 10,
    marginBottom: 20,
  },
  locationsContainer: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    fontStyle: 'italic',
    paddingVertical: 20,
  },
  locationItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  locationText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  timestampText: {
    fontSize: 12,
    color: '#999',
  },
});
