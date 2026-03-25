import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Platform,
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
  GeofenceTransitionType,
} from '@gabriel-sisjr/react-native-background-location';
import type { GeofenceTransitionEvent } from '@gabriel-sisjr/react-native-background-location';

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
  } = useGeofencing();

  // Form state
  const [identifier, setIdentifier] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [radius, setRadius] = useState('200');

  // Event log
  const [events, setEvents] = useState<EventWithId[]>([]);

  // Listen for real geofence events from native
  useGeofenceEvents({
    onTransition: useCallback((event: GeofenceTransitionEvent) => {
      setEvents((prev) =>
        [{ ...event, id: `${Date.now()}-${Math.random()}` }, ...prev].slice(
          0,
          50
        )
      );
    }, []),
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

    try {
      await addGeofence({
        identifier: identifier.trim(),
        latitude: lat,
        longitude: lng,
        radius: rad,
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

  const handlePreset = (preset: (typeof PRESETS)[number]) => {
    setIdentifier(preset.label.toLowerCase().replace(/\s/g, '-'));
    setLatitude(preset.latitude.toString());
    setLongitude(preset.longitude.toString());
    setRadius(preset.radius.toString());
  };

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
            keyboardType="numeric"
          />
          <TextInput
            style={[styles.input, styles.halfInput]}
            placeholder="Longitude"
            value={longitude}
            onChangeText={setLongitude}
            keyboardType="numeric"
          />
        </View>
        <TextInput
          style={styles.input}
          placeholder="Radius (meters)"
          value={radius}
          onChangeText={setRadius}
          keyboardType="numeric"
        />

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
        {geofences.map((g) => (
          <View key={g.identifier} style={styles.geofenceItem}>
            <View style={styles.geofenceInfo}>
              <Text style={styles.geofenceId}>{g.identifier}</Text>
              <Text style={styles.geofenceCoords}>
                {g.latitude.toFixed(4)}, {g.longitude.toFixed(4)} | {g.radius}m
              </Text>
            </View>
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => removeGeofence(g.identifier)}
            >
              <Text style={styles.removeButtonText}>Remove</Text>
            </TouchableOpacity>
          </View>
        ))}
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
});
