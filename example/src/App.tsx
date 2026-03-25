import React from 'react';
import {
  Text,
  View,
  Button,
  ScrollView,
  Alert,
  SafeAreaView,
  ActivityIndicator,
  Linking,
  Switch,
  TouchableOpacity,
} from 'react-native';
import BackgroundLocation, {
  useLocationPermissions,
  useBackgroundLocation,
  useLocationUpdates,
  LocationPermissionStatus,
  LocationAccuracy,
  NotificationPriority,
  type TrackingOptions,
  type NotificationActionEvent,
} from '@gabriel-sisjr/react-native-background-location';

import styles from './styles';
import { RouteMap } from './components';
import { GeofencingScreen } from './screens/GeofencingScreen';
import type { Coords } from '@gabriel-sisjr/react-native-background-location';

/**
 * Formats location properties for display
 * Returns an object with formatted strings for all available properties
 */
function formatLocationProperties(location: Coords) {
  const properties: Record<string, string> = {};

  if (location.accuracy !== undefined) {
    properties.Accuracy = `${location.accuracy.toFixed(2)} m`;
  }
  if (location.altitude !== undefined) {
    properties.Altitude = `${location.altitude.toFixed(2)} m`;
  }
  if (location.speed !== undefined) {
    // Convert m/s to km/h for better readability
    const speedKmh = (location.speed * 3.6).toFixed(2);
    properties.Speed = `${speedKmh} km/h (${location.speed.toFixed(2)} m/s)`;
  }
  if (location.bearing !== undefined) {
    properties.Bearing = `${location.bearing.toFixed(2)}°`;
  }
  if (location.verticalAccuracyMeters !== undefined) {
    properties['Vertical Accuracy'] =
      `${location.verticalAccuracyMeters.toFixed(2)} m`;
  }
  if (location.speedAccuracyMetersPerSecond !== undefined) {
    properties['Speed Accuracy'] =
      `${location.speedAccuracyMetersPerSecond.toFixed(2)} m/s`;
  }
  if (location.bearingAccuracyDegrees !== undefined) {
    properties['Bearing Accuracy'] =
      `${location.bearingAccuracyDegrees.toFixed(2)}°`;
  }
  if (location.provider !== undefined) {
    properties.Provider = location.provider;
  }
  if (location.isFromMockProvider !== undefined) {
    properties['Mock Provider'] = location.isFromMockProvider ? 'Yes' : 'No';
  }
  if (location.elapsedRealtimeNanos !== undefined) {
    // Convert nanoseconds to milliseconds for display
    const elapsedMs = (location.elapsedRealtimeNanos / 1000000).toFixed(2);
    properties['Elapsed Realtime'] = `${elapsedMs} ms`;
  }

  return properties;
}

export default function App() {
  const [currentScreen, setCurrentScreen] = React.useState<
    'tracking' | 'geofencing'
  >('tracking');
  const [useAutoUpdates, setUseAutoUpdates] = React.useState(true);
  const [showConfig, setShowConfig] = React.useState(false);
  const [showMap, setShowMap] = React.useState(false);
  const [lastActionEvent, setLastActionEvent] =
    React.useState<NotificationActionEvent | null>(null);
  const [configPreset, setConfigPreset] = React.useState<
    'default' | 'high-accuracy' | 'balanced' | 'low-power' | 'custom'
  >('default');

  // Tracking configuration options
  const [trackingOptions, setTrackingOptions] = React.useState<TrackingOptions>(
    {
      updateInterval: 5000,
      fastestInterval: 3000,
      maxWaitTime: 10000,
      accuracy: LocationAccuracy.HIGH_ACCURACY,
      waitForAccurateLocation: false,
      notificationTitle: 'Location Tracking',
      notificationText: 'Tracking your location in background',
      notificationChannelName: 'Background Location',
      notificationPriority: NotificationPriority.LOW,
      notificationSmallIcon: 'ic_notification',
      notificationColor: '#4CAF50',
      notificationShowTimestamp: true,
      notificationLargeIcon: 'ic_notification_large',
      notificationSubtext: 'Background Location Example',
      notificationActions: [
        { id: 'pause', label: 'Pause' },
        { id: 'stop', label: 'Stop' },
      ],
    }
  );

  // Predefined configuration presets
  const configPresets = {
    'default': {
      updateInterval: 5000,
      fastestInterval: 3000,
      maxWaitTime: 10000,
      accuracy: LocationAccuracy.HIGH_ACCURACY,
      waitForAccurateLocation: false,
      notificationTitle: 'Location Tracking',
      notificationText: 'Tracking your location in background',
      notificationChannelName: 'Background Location',
      notificationPriority: NotificationPriority.LOW,
      notificationSmallIcon: 'ic_notification',
      notificationColor: '#4CAF50',
      notificationShowTimestamp: true,
      notificationLargeIcon: 'ic_notification_large',
      notificationSubtext: 'Background Location Example',
      notificationActions: [
        { id: 'pause', label: 'Pause' },
        { id: 'stop', label: 'Stop' },
      ],
    } as TrackingOptions,
    'high-accuracy': {
      updateInterval: 2000,
      fastestInterval: 1000,
      maxWaitTime: 5000,
      accuracy: LocationAccuracy.HIGH_ACCURACY,
      waitForAccurateLocation: true,
      notificationTitle: 'High Accuracy Tracking',
      notificationText: 'Using GPS for precise location tracking',
      notificationChannelName: 'High Accuracy Tracking',
      notificationPriority: NotificationPriority.DEFAULT,
      notificationSmallIcon: 'ic_notification',
      notificationColor: '#2196F3',
      notificationShowTimestamp: true,
      notificationActions: [{ id: 'stop', label: 'Stop Tracking' }],
    } as TrackingOptions,
    'balanced': {
      updateInterval: 10000,
      fastestInterval: 5000,
      maxWaitTime: 15000,
      accuracy: LocationAccuracy.BALANCED_POWER_ACCURACY,
      waitForAccurateLocation: false,
      notificationTitle: 'Balanced Tracking',
      notificationText: 'Balanced location tracking',
      notificationChannelName: 'Balanced Location',
      notificationPriority: NotificationPriority.LOW,
      notificationSmallIcon: 'ic_notification',
      notificationColor: '#FF9800',
      notificationShowTimestamp: false,
    } as TrackingOptions,
    'low-power': {
      updateInterval: 30000,
      fastestInterval: 15000,
      maxWaitTime: 60000,
      accuracy: LocationAccuracy.LOW_POWER,
      waitForAccurateLocation: false,
      notificationTitle: 'Low Power Tracking',
      notificationText: 'Power-efficient location tracking',
      notificationChannelName: 'Low Power Tracking',
      notificationPriority: NotificationPriority.LOW,
      notificationSmallIcon: 'ic_notification',
      notificationColor: '#9C27B0',
    } as TrackingOptions,
  };

  // Apply preset configuration
  const applyPreset = (preset: keyof typeof configPresets) => {
    setConfigPreset(preset);
    setTrackingOptions(configPresets[preset]);
  };

  // Manage permissions with hook
  const { permissionStatus, requestPermissions, isRequesting } =
    useLocationPermissions();

  // Manage tracking with hook (manual refresh mode) with custom options
  const {
    isTracking,
    tripId,
    locations: manualLocations,
    isLoading,
    error,
    startTracking,
    stopTracking,
    refreshLocations,
    clearCurrentTrip,
    clearError,
  } = useBackgroundLocation({
    options: trackingOptions,
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

  // Watch location updates in real-time (automatic mode)
  const {
    locations: autoLocations,
    lastLocation,
    isTracking: isAutoTracking,
    clearLocations: clearAutoLocations,
  } = useLocationUpdates({
    onLocationUpdate: (location) => {
      console.log('New location received:', location);
    },
    onNotificationAction: (event: NotificationActionEvent) => {
      console.log('Notification action pressed:', event);
      setLastActionEvent(event);

      if (event.actionId === 'stop') {
        stopTracking();
      } else if (event.actionId === 'pause') {
        Alert.alert(
          'Pause Action',
          `Action "${event.actionId}" pressed for trip ${event.tripId}`
        );
      }
    },
  });

  // Use the appropriate locations based on the selected mode
  const locations = useAutoUpdates ? autoLocations : manualLocations;
  const trackingActive = useAutoUpdates ? isAutoTracking : isTracking;

  // Handle permission-blocked state
  if (permissionStatus.status === LocationPermissionStatus.BLOCKED) {
    return (
      <SafeAreaView style={styles.centeredContainer}>
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
      <SafeAreaView style={styles.centeredContainer}>
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
  const handleClearTrip = async () => {
    Alert.alert(
      'Clear Trip Data',
      `Are you sure you want to clear all data for trip ${tripId}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            // Clear from both hooks depending on the mode
            await clearCurrentTrip();
            if (useAutoUpdates) {
              await clearAutoLocations();
            }
          },
        },
      ]
    );
  };

  // Tab buttons (shared across screens)
  const tabBar = (
    <View style={styles.tabContainer}>
      <TouchableOpacity
        style={[styles.tab, currentScreen === 'tracking' && styles.activeTab]}
        onPress={() => setCurrentScreen('tracking')}
      >
        <Text
          style={[
            styles.tabText,
            currentScreen === 'tracking' && styles.activeTabText,
          ]}
        >
          Location Tracking
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tab, currentScreen === 'geofencing' && styles.activeTab]}
        onPress={() => setCurrentScreen('geofencing')}
      >
        <Text
          style={[
            styles.tabText,
            currentScreen === 'geofencing' && styles.activeTabText,
          ]}
        >
          Geofencing
        </Text>
      </TouchableOpacity>
    </View>
  );

  // Geofencing screen
  if (currentScreen === 'geofencing') {
    return (
      <View style={styles.container}>
        {tabBar}
        <GeofencingScreen />
      </View>
    );
  }

  // Main tracking UI
  return (
    <View style={styles.container}>
      {tabBar}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
      >
        <Text style={styles.title}>Background Location Example</Text>
        <Text style={styles.subtitle}>Using React Hooks</Text>

        <View style={styles.modeContainer}>
          <Text style={styles.modeLabel}>Auto-Update Mode:</Text>
          <Switch
            value={useAutoUpdates}
            onValueChange={setUseAutoUpdates}
            trackColor={{ false: '#767577', true: '#81b0ff' }}
            thumbColor={useAutoUpdates ? '#2196F3' : '#f4f3f4'}
          />
        </View>

        <View style={styles.configContainer}>
          <View style={styles.configHeader}>
            <Text style={styles.configTitle}>Tracking Configuration</Text>
            <Button
              title={showConfig ? 'Hide' : 'Show'}
              onPress={() => setShowConfig(!showConfig)}
              color="#2196F3"
            />
          </View>

          {showConfig && (
            <View style={styles.configContent}>
              <Text style={styles.configSectionTitle}>Presets:</Text>
              <View style={styles.presetContainer}>
                <TouchableOpacity
                  style={[
                    styles.presetButton,
                    configPreset === 'default' && styles.presetButtonSelected,
                  ]}
                  onPress={() => applyPreset('default')}
                >
                  <Text
                    style={[
                      styles.presetButtonText,
                      configPreset === 'default' &&
                        styles.presetButtonTextSelected,
                    ]}
                  >
                    Default
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.presetButton,
                    configPreset === 'high-accuracy' &&
                      styles.presetButtonSelected,
                  ]}
                  onPress={() => applyPreset('high-accuracy')}
                >
                  <Text
                    style={[
                      styles.presetButtonText,
                      configPreset === 'high-accuracy' &&
                        styles.presetButtonTextSelected,
                    ]}
                  >
                    High Accuracy
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.presetButton,
                    configPreset === 'balanced' && styles.presetButtonSelected,
                  ]}
                  onPress={() => applyPreset('balanced')}
                >
                  <Text
                    style={[
                      styles.presetButtonText,
                      configPreset === 'balanced' &&
                        styles.presetButtonTextSelected,
                    ]}
                  >
                    Balanced
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.presetButton,
                    configPreset === 'low-power' && styles.presetButtonSelected,
                  ]}
                  onPress={() => applyPreset('low-power')}
                >
                  <Text
                    style={[
                      styles.presetButtonText,
                      configPreset === 'low-power' &&
                        styles.presetButtonTextSelected,
                    ]}
                  >
                    Low Power
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.configDetails}>
                <Text style={styles.configDetailTitle}>
                  Current Configuration:
                </Text>
                <Text style={styles.configDetailText}>
                  Update Interval: {trackingOptions.updateInterval}ms
                </Text>
                <Text style={styles.configDetailText}>
                  Fastest Interval: {trackingOptions.fastestInterval}ms
                </Text>
                <Text style={styles.configDetailText}>
                  Max Wait Time: {trackingOptions.maxWaitTime}ms
                </Text>
                <Text style={styles.configDetailText}>
                  Accuracy: {trackingOptions.accuracy}
                </Text>
                <Text style={styles.configDetailText}>
                  Wait for Accurate:{' '}
                  {trackingOptions.waitForAccurateLocation ? 'Yes' : 'No'}
                </Text>
                <Text style={styles.configDetailText}>
                  Notification Priority: {trackingOptions.notificationPriority}
                </Text>
                <Text style={styles.configDetailText}>
                  Notification Title: {trackingOptions.notificationTitle}
                </Text>
                <Text style={styles.configDetailText}>
                  Small Icon:{' '}
                  {trackingOptions.notificationSmallIcon || 'default'}
                </Text>
                <Text style={styles.configDetailText}>
                  Color: {trackingOptions.notificationColor || 'none'}
                </Text>
                <Text style={styles.configDetailText}>
                  Timestamp:{' '}
                  {trackingOptions.notificationShowTimestamp ? 'Yes' : 'No'}
                </Text>
                <Text style={styles.configDetailText}>
                  Large Icon: {trackingOptions.notificationLargeIcon || 'none'}
                </Text>
                <Text style={styles.configDetailText}>
                  Subtext: {trackingOptions.notificationSubtext || 'none'}
                </Text>
                <Text style={styles.configDetailText}>
                  Actions:{' '}
                  {trackingOptions.notificationActions
                    ?.map((a) => a.label)
                    .join(', ') || 'none'}
                </Text>
              </View>

              <View style={styles.configInfo}>
                <Text style={styles.configInfoText}>
                  💡 These options will be applied when you start tracking. The
                  configuration affects battery consumption and location
                  accuracy.
                </Text>
              </View>
            </View>
          )}
        </View>

        <View style={styles.infoContainer}>
          <Text style={styles.infoText}>
            {useAutoUpdates
              ? '✨ Auto: Locations update automatically in real-time'
              : '🔄 Manual: Tap "Refresh" to get latest locations'}
          </Text>
        </View>

        <View style={styles.statusContainer}>
          <Text style={styles.statusLabel}>Status:</Text>
          <Text
            style={[
              styles.statusText,
              trackingActive ? styles.tracking : styles.stopped,
            ]}
          >
            {trackingActive ? 'TRACKING' : 'STOPPED'}
          </Text>
        </View>

        {tripId && (
          <View style={styles.tripIdContainer}>
            <Text style={styles.label}>Current Trip ID:</Text>
            <Text style={styles.tripId}>{tripId}</Text>
          </View>
        )}

        {useAutoUpdates && lastLocation && (
          <View style={styles.lastLocationContainer}>
            <Text style={styles.label}>Last Location (Live):</Text>
            <Text style={styles.locationDetail}>
              Lat: {lastLocation.latitude}
            </Text>
            <Text style={styles.locationDetail}>
              Lng: {lastLocation.longitude}
            </Text>
            <Text style={styles.timestampText}>
              {new Date(lastLocation.timestamp).toLocaleString()}
            </Text>
            {Object.entries(formatLocationProperties(lastLocation)).map(
              ([key, value]) => (
                <Text key={key} style={styles.locationDetail}>
                  {key}: {value}
                </Text>
              )
            )}
          </View>
        )}

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Error: {error.message}</Text>
            <Button title="Dismiss" onPress={clearError} color="#f44336" />
          </View>
        )}

        {lastActionEvent && (
          <View style={styles.actionEventContainer}>
            <Text style={styles.actionEventTitle}>
              Last Notification Action
            </Text>
            <Text style={styles.actionEventText}>
              Action: {lastActionEvent.actionId}
            </Text>
            <Text style={styles.actionEventText}>
              Trip: {lastActionEvent.tripId}
            </Text>
            <Button
              title="Dismiss"
              onPress={() => setLastActionEvent(null)}
              color="#795548"
            />
          </View>
        )}

        {/* Route Map */}
        {locations.length > 0 && (
          <View style={styles.mapContainer}>
            <View style={styles.mapHeader}>
              <Text style={styles.mapTitle}>
                Route Map ({locations.length} points)
              </Text>
              <Button
                title={showMap ? 'Hide' : 'Show'}
                onPress={() => setShowMap(!showMap)}
                color="#2196F3"
              />
            </View>

            {showMap && (
              <>
                <Text style={styles.mapSubtitle}>
                  {useAutoUpdates
                    ? 'Live route tracking (auto-updating)'
                    : 'Route from stored locations'}
                </Text>
                <RouteMap
                  locations={locations}
                  currentLocation={useAutoUpdates ? lastLocation : null}
                  showRoute={true}
                  showAllMarkers={false}
                  autoFitBounds={true}
                />
              </>
            )}
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
                  onPress={() => startTracking(undefined, trackingOptions)}
                  color="#2196F3"
                />
              ) : (
                <Button
                  title="Stop Tracking"
                  onPress={stopTracking}
                  color="#f44336"
                />
              )}

              {isTracking && !useAutoUpdates && (
                <Button
                  title="Refresh Locations"
                  onPress={refreshLocations}
                  color="#FF9800"
                />
              )}

              {isTracking && (
                <Button
                  title="Update Notification Text"
                  onPress={() => {
                    const now = new Date().toLocaleTimeString();
                    BackgroundLocation.updateNotification(
                      'Updated at ' + now,
                      `${locations.length} locations collected`
                    );
                  }}
                  color="#009688"
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
              {trackingActive
                ? useAutoUpdates
                  ? 'Waiting for location updates... (Auto-updating)'
                  : 'Collecting locations... (Tap Refresh to update)'
                : 'No locations yet. Start tracking to collect locations.'}
            </Text>
          ) : (
            locations.map((location, index) => {
              const additionalProps = formatLocationProperties(location);
              const hasAdditionalProps =
                Object.keys(additionalProps).length > 0;

              return (
                <View key={index} style={styles.locationItem}>
                  <Text style={styles.locationText}>
                    #{index + 1} - Lat: {location.latitude}, Lng:{' '}
                    {location.longitude}
                  </Text>
                  <Text style={styles.timestampText}>
                    {new Date(location.timestamp).toLocaleString()}
                  </Text>
                  {hasAdditionalProps && (
                    <View style={styles.additionalPropsContainer}>
                      {Object.entries(additionalProps).map(([key, value]) => (
                        <Text key={key} style={styles.additionalPropText}>
                          {key}: {value}
                        </Text>
                      ))}
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}
