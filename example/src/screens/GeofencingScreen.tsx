import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Platform,
  Linking,
} from 'react-native';
import {
  MapView,
  Camera,
  RasterSource,
  RasterLayer,
  ShapeSource,
  FillLayer,
  LineLayer,
} from '@maplibre/maplibre-react-native';
import {
  useGeofencing,
  useGeofenceEvents,
  useLocationPermissions,
  GeofenceTransitionType,
  NotificationPriority,
  LocationPermissionStatus,
  NotificationPermissionStatus,
} from '@gabriel-sisjr/react-native-background-location';
import type {
  GeofenceTransitionEvent,
  NotificationOptions,
} from '@gabriel-sisjr/react-native-background-location';

/**
 * Generates a GeoJSON polygon that approximates a circle
 * on the map given a center point and radius in meters.
 */
function createCircleGeoJSON(
  lat: number,
  lng: number,
  radiusMeters: number,
  points: number = 64
) {
  const coords: [number, number][] = [];
  const distanceX = radiusMeters / (111320 * Math.cos((lat * Math.PI) / 180));
  const distanceY = radiusMeters / 110540;

  for (let i = 0; i < points; i++) {
    const theta = (i / points) * (2 * Math.PI);
    const x = distanceX * Math.cos(theta);
    const y = distanceY * Math.sin(theta);
    coords.push([lng + x, lat + y]);
  }
  coords.push(coords[0]!); // Close the polygon

  return {
    type: 'FeatureCollection' as const,
    features: [
      {
        type: 'Feature' as const,
        properties: {},
        geometry: {
          type: 'Polygon' as const,
          coordinates: [coords],
        },
      },
    ],
  };
}

/**
 * Creates a combined GeoJSON FeatureCollection from all geofences
 * so they can be rendered as a single ShapeSource on the map.
 */
function createAllGeofencesGeoJSON(
  geofences: Array<{ latitude: number; longitude: number; radius: number }>
) {
  const features = geofences.map((g) => {
    const circle = createCircleGeoJSON(g.latitude, g.longitude, g.radius);
    return circle.features[0]!;
  });
  return { type: 'FeatureCollection' as const, features };
}

const PRESETS = [
  {
    label: 'Apple Park',
    latitude: 37.3349,
    longitude: -122.009,
    radius: 250,
  },
  {
    label: 'Googleplex',
    latitude: 37.422,
    longitude: -122.0841,
    radius: 300,
  },
  {
    label: 'Moscone Center',
    latitude: 37.7844,
    longitude: -122.401,
    radius: 200,
  },
];

const TRANSITION_COLORS: Record<string, string> = {
  ENTER: '#4CAF50',
  EXIT: '#f44336',
  DWELL: '#FF9800',
};

interface NotificationPreset {
  label: string;
  description: string;
  options: NotificationOptions | false | undefined;
}

const NOTIFICATION_PRESETS: NotificationPreset[] = [
  {
    label: 'Default',
    description: 'Platform defaults (no config)',
    options: undefined,
  },
  {
    label: 'Custom Templates',
    description: 'Template variable resolution',
    options: {
      title: '{{transitionType}} at {{identifier}}',
      text: 'Location: {{latitude}}, {{longitude}} (radius: {{radius}}m)',
    },
  },
  {
    label: 'Per-Transition',
    description: 'Different config per transition type',
    options: {
      title: 'Geofence Alert',
      text: 'Transition at {{identifier}}',
      transitionOverrides: {
        ENTER: {
          title: 'Entered {{identifier}}',
          text: 'Welcome! You arrived at {{latitude}}, {{longitude}}',
          color: '#4CAF50',
        },
        EXIT: {
          title: 'Exited {{identifier}}',
          text: 'Goodbye! You left the area.',
          color: '#f44336',
        },
        DWELL: {
          title: 'Dwelling at {{identifier}}',
          text: 'You have been here for a while.',
          color: '#FF9800',
        },
      },
    },
  },
  {
    label: 'Silent',
    description: 'Notification suppression',
    options: false,
  },
  {
    label: 'High Priority',
    description: 'Android-specific styling',
    options: {
      priority: NotificationPriority.HIGH,
      channelName: 'Geofence Alerts',
      color: '#FF0000',
      showTimestamp: true,
      subtext: 'Geofence Monitoring Active',
    },
  },
];

type EventWithId = GeofenceTransitionEvent & { id: string };

/**
 * Self-contained geofencing demo screen.
 *
 * Sections:
 * 1. Counter header (active / max)
 * 2. Map with geofence circle overlays
 * 3. Add geofence form with preset buttons
 * 4. Active geofences list with remove actions
 * 5. Simulation buttons for testing without real native events
 * 6. Event log showing transition history
 */
const GLOBAL_NOTIFICATION_OPTIONS: NotificationOptions = {
  title: 'Geofence: {{identifier}}',
  text: '{{transitionType}} detected at {{latitude}}, {{longitude}}',
  channelName: 'Geofence Notifications',
  showTimestamp: true,
};

/**
 * Returns a human-readable label for the current permission status.
 */
function permissionLabel(status: string): string {
  switch (status) {
    case LocationPermissionStatus.GRANTED:
      return 'Always';
    case LocationPermissionStatus.WHEN_IN_USE:
      return 'When In Use';
    case LocationPermissionStatus.DENIED:
      return 'Denied';
    case LocationPermissionStatus.BLOCKED:
      return 'Blocked (Restricted)';
    default:
      return 'Not Determined';
  }
}

/**
 * Returns a color for the permission status badge.
 */
function permissionColor(status: string): string {
  switch (status) {
    case LocationPermissionStatus.GRANTED:
      return '#4CAF50';
    case LocationPermissionStatus.WHEN_IN_USE:
      return '#FF9800';
    case LocationPermissionStatus.DENIED:
      return '#f44336';
    case LocationPermissionStatus.BLOCKED:
      return '#9E9E9E';
    default:
      return '#2196F3';
  }
}

/**
 * Returns a human-readable label for the notification permission status.
 */
function notificationPermissionLabel(status: string): string {
  switch (status) {
    case NotificationPermissionStatus.GRANTED:
      return 'Granted';
    case NotificationPermissionStatus.DENIED:
      return 'Denied';
    case NotificationPermissionStatus.UNDETERMINED:
      return 'Not Determined';
    default:
      return 'Not Determined';
  }
}

/**
 * Returns a color for the notification permission status badge.
 */
function notificationPermissionColor(status: string): string {
  switch (status) {
    case NotificationPermissionStatus.GRANTED:
      return '#4CAF50';
    case NotificationPermissionStatus.DENIED:
      return '#f44336';
    case NotificationPermissionStatus.UNDETERMINED:
      return '#FF9800';
    default:
      return '#FF9800';
  }
}

export function GeofencingScreen() {
  const {
    geofences,
    isLoading,
    error,
    addGeofence,
    removeGeofence,
    removeAllGeofences,
    maxGeofences,
    clearError,
  } = useGeofencing({
    notificationOptions: GLOBAL_NOTIFICATION_OPTIONS,
  });

  // Permission state
  const {
    permissionStatus,
    checkPermissions,
    requestPermissions,
    isRequesting,
  } = useLocationPermissions();

  // Check permissions on mount
  useEffect(() => {
    checkPermissions();
  }, [checkPermissions]);

  const handleRequestPermission = useCallback(async () => {
    const granted = await requestPermissions();
    if (!granted) {
      // Re-check to get current state
      await checkPermissions();
      Alert.alert(
        'Permission Required',
        'Geofencing requires "Always" location permission. ' +
          'Please enable it in Settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open Settings',
            onPress: () => Linking.openSettings(),
          },
        ]
      );
    }
  }, [requestPermissions, checkPermissions]);

  // Form state
  const [identifier, setIdentifier] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [radius, setRadius] = useState('200');
  const [selectedPresetIndex, setSelectedPresetIndex] = useState(0);

  // Event log
  const [events, setEvents] = useState<EventWithId[]>([]);

  // Listen for real geofence events from native
  useGeofenceEvents({
    onTransition: (event: GeofenceTransitionEvent) => {
      setEvents((prev) =>
        [{ ...event, id: `${Date.now()}-${Math.random()}` }, ...prev].slice(
          0,
          50
        )
      );
    },
  });

  const handleAddGeofence = async () => {
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    const rad = parseFloat(radius);

    if (!identifier.trim()) {
      Alert.alert('Error', 'Identifier is required');
      return;
    }
    if (isNaN(lat) || isNaN(lng) || isNaN(rad)) {
      Alert.alert('Error', 'Invalid coordinates or radius');
      return;
    }

    const selectedPreset = NOTIFICATION_PRESETS[selectedPresetIndex]!;

    try {
      await addGeofence({
        identifier: identifier.trim(),
        latitude: lat,
        longitude: lng,
        radius: rad,
        notificationOptions: selectedPreset.options,
        metadata: { notificationPreset: selectedPreset.label },
      });
      // Clear form on success
      setIdentifier('');
      setLatitude('');
      setLongitude('');
      setRadius('200');
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    }
  };

  const handlePreset = useCallback((preset: (typeof PRESETS)[number]) => {
    setIdentifier(preset.label.toLowerCase().replace(/\s/g, '-'));
    setLatitude(preset.latitude.toString());
    setLongitude(preset.longitude.toString());
    setRadius(preset.radius.toString());
  }, []);

  const simulateEvent = (type: GeofenceTransitionType) => {
    const target = geofences[0];
    const event: EventWithId = {
      id: `sim-${Date.now()}-${Math.random()}`,
      geofenceId: target?.identifier ?? 'simulated',
      transitionType: type,
      latitude: target?.latitude ?? 37.3349,
      longitude: target?.longitude ?? -122.009,
      timestamp: new Date().toISOString(),
      distanceFromCenter: Math.random() * 100,
    };
    setEvents((prev) => [event, ...prev].slice(0, 50));
  };

  const geojson = createAllGeofencesGeoJSON(geofences);
  const centerCoord: [number, number] =
    geofences.length > 0
      ? [geofences[0]!.longitude, geofences[0]!.latitude]
      : [-122.009, 37.3349]; // Default to Apple Park, Cupertino

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Counter */}
      <View style={styles.counterCard}>
        <Text style={styles.counterText}>
          {geofences.length} / {maxGeofences ?? '--'} active geofences
        </Text>
      </View>

      {/* Permission Status */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Location Permission</Text>
        <View style={styles.permissionRow}>
          <Text style={styles.permissionLabel}>Current Level:</Text>
          <View
            style={[
              styles.permissionBadge,
              {
                backgroundColor:
                  permissionColor(permissionStatus.location.status) + '20',
                borderColor: permissionColor(permissionStatus.location.status),
              },
            ]}
          >
            <Text
              style={[
                styles.permissionBadgeText,
                { color: permissionColor(permissionStatus.location.status) },
              ]}
            >
              {permissionLabel(permissionStatus.location.status)}
            </Text>
          </View>
        </View>
        <View style={styles.permissionRow}>
          <Text style={styles.permissionLabel}>Notification:</Text>
          <View
            style={[
              styles.permissionBadge,
              {
                backgroundColor:
                  notificationPermissionColor(
                    permissionStatus.notification.status
                  ) + '20',
                borderColor: notificationPermissionColor(
                  permissionStatus.notification.status
                ),
              },
            ]}
          >
            <Text
              style={[
                styles.permissionBadgeText,
                {
                  color: notificationPermissionColor(
                    permissionStatus.notification.status
                  ),
                },
              ]}
            >
              {notificationPermissionLabel(
                permissionStatus.notification.status
              )}
            </Text>
          </View>
        </View>
        {permissionStatus.location.status !==
          LocationPermissionStatus.GRANTED && (
          <View style={styles.permissionWarning}>
            <Text style={styles.permissionWarningText}>
              Geofencing requires "Always" location permission for reliable
              background monitoring.
            </Text>
            <TouchableOpacity
              style={[styles.button, styles.permissionButton]}
              onPress={handleRequestPermission}
              disabled={isRequesting}
            >
              <Text style={styles.buttonText}>
                {isRequesting
                  ? 'Requesting...'
                  : permissionStatus.location.status ===
                        LocationPermissionStatus.BLOCKED ||
                      (permissionStatus.location.status ===
                        LocationPermissionStatus.DENIED &&
                        !permissionStatus.location.canRequestAgain)
                    ? 'Open Settings'
                    : 'Request Always Permission'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Error */}
      {error && (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error.message}</Text>
          <TouchableOpacity onPress={clearError}>
            <Text style={styles.errorDismiss}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Map */}
      <View style={styles.mapContainer}>
        <MapView style={styles.map}>
          <Camera zoomLevel={12} centerCoordinate={centerCoord} />
          <RasterSource
            id="osm"
            tileUrlTemplates={[
              'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
            ]}
            tileSize={256}
          >
            <RasterLayer id="osmLayer" sourceID="osm" />
          </RasterSource>
          {geofences.length > 0 && (
            <ShapeSource id="geofences" shape={geojson}>
              <FillLayer
                id="geofenceFill"
                style={{
                  fillColor: '#2196F3',
                  fillOpacity: 0.2,
                }}
              />
              <LineLayer
                id="geofenceBorder"
                style={{
                  lineColor: '#2196F3',
                  lineWidth: 2,
                }}
              />
            </ShapeSource>
          )}
        </MapView>
      </View>

      {/* Add Geofence Form */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Add Geofence</Text>

        <View style={styles.presetsRow}>
          {PRESETS.map((p) => (
            <TouchableOpacity
              key={p.label}
              style={styles.presetButton}
              onPress={() => handlePreset(p)}
            >
              <Text style={styles.presetButtonText}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TextInput
          style={styles.input}
          placeholder="Identifier"
          value={identifier}
          onChangeText={setIdentifier}
        />
        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.halfInput]}
            placeholder="Latitude"
            value={latitude}
            onChangeText={setLatitude}
            keyboardType="numbers-and-punctuation"
          />
          <TextInput
            style={[styles.input, styles.halfInput]}
            placeholder="Longitude"
            value={longitude}
            onChangeText={setLongitude}
            keyboardType="numbers-and-punctuation"
          />
        </View>
        <TextInput
          style={styles.input}
          placeholder="Radius (meters)"
          value={radius}
          onChangeText={setRadius}
          keyboardType="decimal-pad"
        />

        {/* Notification Preset Selector */}
        <Text style={styles.notificationLabel}>Notification Preset</Text>
        <View style={styles.notificationPresetsRow}>
          {NOTIFICATION_PRESETS.map((preset, index) => (
            <TouchableOpacity
              key={preset.label}
              style={[
                styles.notificationPresetChip,
                selectedPresetIndex === index &&
                  styles.notificationPresetChipActive,
              ]}
              onPress={() => setSelectedPresetIndex(index)}
            >
              <Text
                style={[
                  styles.notificationPresetChipText,
                  selectedPresetIndex === index &&
                    styles.notificationPresetChipTextActive,
                ]}
              >
                {preset.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.notificationPresetDescription}>
          {NOTIFICATION_PRESETS[selectedPresetIndex]!.description}
        </Text>
        <View style={styles.jsonPreviewContainer}>
          <Text style={styles.jsonPreviewLabel}>Config Preview</Text>
          <Text style={styles.jsonPreviewText}>
            {NOTIFICATION_PRESETS[selectedPresetIndex]!.options === undefined
              ? 'undefined (platform defaults)'
              : NOTIFICATION_PRESETS[selectedPresetIndex]!.options === false
                ? 'false (notifications suppressed)'
                : JSON.stringify(
                    NOTIFICATION_PRESETS[selectedPresetIndex]!.options,
                    null,
                    2
                  )}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={handleAddGeofence}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>
            {isLoading ? 'Adding...' : 'Add Geofence'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Active Geofences List */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Active Geofences</Text>
        {geofences.length === 0 && (
          <Text style={styles.emptyText}>No active geofences</Text>
        )}
        {geofences.map((g) => {
          const presetName = (g.metadata as Record<string, unknown> | undefined)
            ?.notificationPreset as string | undefined;
          return (
            <View key={g.identifier} style={styles.geofenceItem}>
              <View style={styles.geofenceInfo}>
                <Text style={styles.geofenceId}>{g.identifier}</Text>
                <Text style={styles.geofenceCoords}>
                  {g.latitude.toFixed(4)}, {g.longitude.toFixed(4)} | {g.radius}
                  m
                </Text>
                {presetName && (
                  <View style={styles.presetBadge}>
                    <Text style={styles.presetBadgeText}>{presetName}</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => removeGeofence(g.identifier)}
              >
                <Text style={styles.removeButtonText}>Remove</Text>
              </TouchableOpacity>
            </View>
          );
        })}
        {geofences.length > 0 && (
          <TouchableOpacity
            style={[styles.button, styles.dangerButton]}
            onPress={() => removeAllGeofences()}
          >
            <Text style={styles.buttonText}>Remove All</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Simulation Buttons */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Simulate Transitions</Text>
        <View style={styles.simulationRow}>
          <TouchableOpacity
            style={[styles.simButton, { backgroundColor: '#4CAF50' }]}
            onPress={() => simulateEvent(GeofenceTransitionType.ENTER)}
          >
            <Text style={styles.simButtonText}>ENTER</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.simButton, { backgroundColor: '#f44336' }]}
            onPress={() => simulateEvent(GeofenceTransitionType.EXIT)}
          >
            <Text style={styles.simButtonText}>EXIT</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.simButton, { backgroundColor: '#FF9800' }]}
            onPress={() => simulateEvent(GeofenceTransitionType.DWELL)}
          >
            <Text style={styles.simButtonText}>DWELL</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Event Log */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Event Log</Text>
        {events.length === 0 && (
          <Text style={styles.emptyText}>No events yet</Text>
        )}
        {events.map((e) => (
          <View key={e.id} style={styles.eventItem}>
            <View
              style={[
                styles.eventDot,
                {
                  backgroundColor:
                    TRANSITION_COLORS[e.transitionType] ?? '#999',
                },
              ]}
            />
            <View style={styles.eventInfo}>
              <Text style={styles.eventType}>
                {e.transitionType} -- {e.geofenceId}
              </Text>
              <Text style={styles.eventTime}>
                {new Date(e.timestamp).toLocaleTimeString()}
              </Text>
            </View>
          </View>
        ))}
        {events.length > 0 && (
          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={() => setEvents([])}
          >
            <Text style={[styles.buttonText, { color: '#666' }]}>
              Clear Log
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 16, paddingBottom: 40 },
  counterCard: {
    backgroundColor: '#2196F3',
    padding: 16,
    borderRadius: 10,
    marginBottom: 16,
    alignItems: 'center',
  },
  counterText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  errorCard: {
    backgroundColor: '#ffebee',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#f44336',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorText: { color: '#c62828', fontSize: 14, flex: 1 },
  errorDismiss: { color: '#f44336', fontWeight: 'bold', marginLeft: 8 },
  mapContainer: {
    height: 250,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 16,
  },
  map: { flex: 1 },
  card: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 10,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  presetsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  presetButton: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  presetButtonText: { color: '#2196F3', fontSize: 13, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    marginBottom: 8,
    backgroundColor: '#fafafa',
  },
  row: { flexDirection: 'row', gap: 8 },
  halfInput: { flex: 1 },
  button: {
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButton: { backgroundColor: '#2196F3' },
  dangerButton: { backgroundColor: '#f44336' },
  secondaryButton: { backgroundColor: '#f0f0f0' },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  emptyText: {
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 16,
  },
  geofenceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  geofenceInfo: { flex: 1 },
  geofenceId: { fontSize: 14, fontWeight: '600', color: '#333' },
  geofenceCoords: {
    fontSize: 12,
    color: '#888',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginTop: 2,
  },
  presetBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  presetBadgeText: { color: '#2E7D32', fontSize: 11, fontWeight: '600' },
  removeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#ffebee',
    borderRadius: 6,
  },
  removeButtonText: { color: '#f44336', fontSize: 13, fontWeight: '600' },
  simulationRow: { flexDirection: 'row', gap: 8 },
  simButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  simButtonText: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  eventItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  eventDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  eventInfo: { flex: 1 },
  eventType: { fontSize: 13, fontWeight: '600', color: '#333' },
  eventTime: { fontSize: 11, color: '#888', marginTop: 2 },
  notificationLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
    marginBottom: 8,
    marginTop: 4,
  },
  notificationPresetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  notificationPresetChip: {
    backgroundColor: '#F3E5F5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  notificationPresetChipActive: {
    borderColor: '#7B1FA2',
    backgroundColor: '#E1BEE7',
  },
  notificationPresetChipText: {
    color: '#7B1FA2',
    fontSize: 12,
    fontWeight: '600',
  },
  notificationPresetChipTextActive: {
    color: '#4A148C',
    fontWeight: 'bold',
  },
  notificationPresetDescription: {
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  jsonPreviewContainer: {
    backgroundColor: '#263238',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  jsonPreviewLabel: {
    fontSize: 11,
    color: '#78909C',
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  jsonPreviewText: {
    fontSize: 12,
    color: '#B0BEC5',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    lineHeight: 18,
  },
  permissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  permissionLabel: {
    fontSize: 14,
    color: '#555',
    marginRight: 8,
  },
  permissionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  permissionBadgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  permissionWarning: {
    backgroundColor: '#FFF3E0',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#FF9800',
  },
  permissionWarningText: {
    fontSize: 13,
    color: '#E65100',
    lineHeight: 18,
    marginBottom: 8,
  },
  permissionButton: {
    backgroundColor: '#FF9800',
  },
});
