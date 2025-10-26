import {
  Text,
  View,
  StyleSheet,
  Button,
  ScrollView,
  Alert,
  SafeAreaView,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import {
  useLocationPermissions,
  useBackgroundLocation,
  LocationPermissionStatus,
} from 'react-native-background-location';

export default function App() {
  // Manage permissions with hook
  const { permissionStatus, requestPermissions, isRequesting } =
    useLocationPermissions();

  // Manage tracking with hook
  const {
    isTracking,
    tripId,
    locations,
    isLoading,
    error,
    startTracking,
    stopTracking,
    refreshLocations,
    clearCurrentTrip,
    clearError,
  } = useBackgroundLocation({
    onTrackingStart: (id) => {
      Alert.alert('Success', `Tracking started with trip ID: ${id}`);
    },
    onTrackingStop: () => {
      Alert.alert('Success', 'Tracking stopped');
    },
    onError: (err) => {
      console.error('Tracking error:', err);
    },
  });

  // Handle permission-blocked state
  if (permissionStatus.status === LocationPermissionStatus.BLOCKED) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>Permissions Blocked</Text>
          <Text style={styles.description}>
            Location permissions are permanently denied. Please enable them in
            your device settings.
          </Text>
          <Button
            title="Open Settings"
            onPress={() => Linking.openSettings()}
            color="#4CAF50"
          />
        </View>
      </SafeAreaView>
    );
  }

  // Handle permission request
  if (!permissionStatus.hasPermission) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>Location Permissions Required</Text>
          <Text style={styles.description}>
            This app needs access to your location (including in the background)
            to track your trips.
          </Text>
          {isRequesting ? (
            <ActivityIndicator size="large" color="#2196F3" />
          ) : (
            <Button
              title="Grant Permissions"
              onPress={requestPermissions}
              color="#4CAF50"
            />
          )}
        </View>
      </SafeAreaView>
    );
  }

  // Handle errors
  const handleClearTrip = () => {
    Alert.alert(
      'Clear Trip Data',
      `Are you sure you want to clear all data for trip ${tripId}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: clearCurrentTrip,
        },
      ]
    );
  };

  // Main tracking UI
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
      >
        <Text style={styles.title}>Background Location Example</Text>
        <Text style={styles.subtitle}>Using React Hooks</Text>

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

        {tripId && (
          <View style={styles.tripIdContainer}>
            <Text style={styles.label}>Current Trip ID:</Text>
            <Text style={styles.tripId}>{tripId}</Text>
          </View>
        )}

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Error: {error.message}</Text>
            <Button title="Dismiss" onPress={clearError} color="#f44336" />
          </View>
        )}

        <View style={styles.buttonContainer}>
          {isLoading ? (
            <ActivityIndicator size="large" color="#2196F3" />
          ) : (
            <>
              {!isTracking ? (
                <Button
                  title="Start Tracking"
                  onPress={() => startTracking()}
                  color="#2196F3"
                />
              ) : (
                <Button
                  title="Stop Tracking"
                  onPress={stopTracking}
                  color="#f44336"
                />
              )}

              {isTracking && (
                <Button
                  title="Refresh Locations"
                  onPress={refreshLocations}
                  color="#FF9800"
                />
              )}

              {tripId && (
                <Button
                  title="Clear Trip Data"
                  onPress={handleClearTrip}
                  color="#9C27B0"
                />
              )}
            </>
          )}
        </View>

        <View style={styles.locationsContainer}>
          <Text style={styles.sectionTitle}>
            Locations ({locations.length}):
          </Text>

          {locations.length === 0 ? (
            <Text style={styles.emptyText}>
              {isTracking
                ? 'Collecting locations...'
                : 'No locations yet. Start tracking to collect locations.'}
            </Text>
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
    marginBottom: 10,
    textAlign: 'center',
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  description: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 24,
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#f44336',
  },
  errorText: {
    color: '#c62828',
    fontSize: 14,
    marginBottom: 10,
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
