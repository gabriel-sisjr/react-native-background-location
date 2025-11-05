import { View, StyleSheet } from 'react-native';
import {
  MapView,
  ShapeSource,
  LineLayer,
  CircleLayer,
  Camera,
  RasterSource,
  RasterLayer,
} from '@maplibre/maplibre-react-native';
import type { Coords } from '@gabriel-sisjr/react-native-background-location';

interface GeoJSONFeature {
  type: 'Feature';
  properties: Record<string, unknown>;
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
}

interface RouteMapProps {
  /**
   * Array of location coordinates to display as route
   */
  locations: Coords[];

  /**
   * Current/last location to show with a marker
   */
  currentLocation?: Coords | null;

  /**
   * Whether to show the route line
   * @default true
   */
  showRoute?: boolean;

  /**
   * Whether to show markers for all points
   * @default false
   */
  showAllMarkers?: boolean;

  /**
   * Whether to auto-fit the map to show all locations
   * @default true
   */
  autoFitBounds?: boolean;
}

/**
 * Map component that displays a route from location coordinates
 * Supports both live updates and manual refresh modes
 */
export function RouteMap({
  locations,
  currentLocation,
  showRoute = true,
  showAllMarkers = false,
  autoFitBounds = true,
}: RouteMapProps) {
  // Convert Coords to GeoJSON coordinates [longitude, latitude]
  const routeCoordinates = locations.map((loc) => [
    parseFloat(loc.longitude),
    parseFloat(loc.latitude),
  ]);

  // Create GeoJSON FeatureCollection for route line
  const routeGeoJSON = {
    type: 'FeatureCollection' as const,
    features: [
      {
        type: 'Feature' as const,
        properties: {},
        geometry: {
          type: 'LineString' as const,
          coordinates: routeCoordinates,
        },
      },
    ],
  };

  // Create markers for start, end, and current location
  const startMarkers: GeoJSONFeature[] = [];
  const currentMarkers: GeoJSONFeature[] = [];
  const endMarkers: GeoJSONFeature[] = [];
  const pointMarkers: GeoJSONFeature[] = [];

  // Start marker
  if (locations.length > 0 && locations[0]) {
    const firstLoc = locations[0];
    startMarkers.push({
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'Point' as const,
        coordinates: [
          parseFloat(firstLoc.longitude),
          parseFloat(firstLoc.latitude),
        ],
      },
    });
  }

  // Current location marker
  if (currentLocation) {
    currentMarkers.push({
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'Point' as const,
        coordinates: [
          parseFloat(currentLocation.longitude),
          parseFloat(currentLocation.latitude),
        ],
      },
    });
  }

  // End marker (if different from current)
  const lastLocation =
    locations.length > 0 ? locations[locations.length - 1] : null;
  if (
    lastLocation &&
    (!currentLocation || lastLocation.latitude !== currentLocation.latitude)
  ) {
    endMarkers.push({
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'Point' as const,
        coordinates: [
          parseFloat(lastLocation.longitude),
          parseFloat(lastLocation.latitude),
        ],
      },
    });
  }

  // All location markers (if enabled)
  if (showAllMarkers) {
    locations.forEach((loc, index) => {
      if (index === 0) return; // Start marker already added
      if (index === locations.length - 1 && currentLocation) return; // End marker will be shown as current
      pointMarkers.push({
        type: 'Feature' as const,
        properties: {},
        geometry: {
          type: 'Point' as const,
          coordinates: [parseFloat(loc.longitude), parseFloat(loc.latitude)],
        },
      });
    });
  }

  const startMarkersGeoJSON = {
    type: 'FeatureCollection' as const,
    features: startMarkers,
  };

  const currentMarkersGeoJSON = {
    type: 'FeatureCollection' as const,
    features: currentMarkers,
  };

  const endMarkersGeoJSON = {
    type: 'FeatureCollection' as const,
    features: endMarkers,
  };

  const pointMarkersGeoJSON = {
    type: 'FeatureCollection' as const,
    features: pointMarkers,
  };

  // Get initial camera position
  const getInitialCamera = () => {
    if (currentLocation) {
      return {
        centerCoordinate: [
          parseFloat(currentLocation.longitude),
          parseFloat(currentLocation.latitude),
        ],
        zoomLevel: 14,
      };
    }

    if (locations.length > 0 && locations[0]) {
      const firstLoc = locations[0];
      return {
        centerCoordinate: [
          parseFloat(firstLoc.longitude),
          parseFloat(firstLoc.latitude),
        ],
        zoomLevel: 14,
      };
    }

    // Default location (São Paulo)
    return {
      centerCoordinate: [-46.6333, -23.5505],
      zoomLevel: 12,
    };
  };

  const initialCamera = getInitialCamera();

  // Calculate zoom level from bounds
  // Formula: zoom = log2(360 / (bounds_width_in_degrees))
  // Adjusted for screen width and padding
  const calculateZoomFromBounds = (
    minLng: number,
    maxLng: number,
    minLat: number,
    maxLat: number,
    padding: number = 0.15 // 15% padding on each side
  ): number => {
    // Calculate bounds
    let latSpan = maxLat - minLat;
    let lngSpan = maxLng - minLng;

    // If bounds are too small (single point or very close points)
    if (latSpan < 0.0001 && lngSpan < 0.0001) {
      return 16; // Default zoom for single point
    }

    // Ensure minimum span to avoid division issues
    if (latSpan < 0.0001) latSpan = 0.0001;
    if (lngSpan < 0.0001) lngSpan = 0.0001;

    // Add padding
    const paddedLatSpan = latSpan * (1 + padding * 2);
    const paddedLngSpan = lngSpan * (1 + padding * 2);

    // Calculate center latitude in radians for Mercator projection correction
    const centerLat = (minLat + maxLat) / 2;
    const latRad = centerLat * (Math.PI / 180);

    // Adjust longitude span for Mercator projection at this latitude
    // Longitude doesn't need adjustment, but latitude does
    const adjustedLatSpan = paddedLatSpan / Math.cos(latRad);

    // Use the larger span to ensure both dimensions fit
    const finalSpan = Math.max(adjustedLatSpan, paddedLngSpan);

    // Calculate zoom level using logarithmic formula
    // World width at zoom 0 is 360 degrees
    // zoom = log2(360 / span_in_degrees)
    const zoom = Math.log(360 / finalSpan) / Math.LN2;

    // Clamp zoom to reasonable bounds for route tracking (typically 12-18)
    // Routes are usually small areas, so we want higher zoom
    const clampedZoom = Math.max(12, Math.min(18, zoom));

    // Round to 1 decimal place for smoother transitions
    return Math.round(clampedZoom * 10) / 10;
  };

  // Calculate bounds for camera
  const getBoundsCamera = () => {
    if (routeCoordinates.length === 0) {
      return null;
    }

    const lngs = routeCoordinates
      .map((c) => c[0])
      .filter((lng): lng is number => typeof lng === 'number');
    const lats = routeCoordinates
      .map((c) => c[1])
      .filter((lat): lat is number => typeof lat === 'number');

    if (lngs.length === 0 || lats.length === 0) {
      return null;
    }

    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);

    // Calculate center
    const centerLng = (minLng + maxLng) / 2;
    const centerLat = (minLat + maxLat) / 2;

    // Calculate zoom level using proper formula
    const zoomLevel = calculateZoomFromBounds(minLng, maxLng, minLat, maxLat);

    return {
      centerCoordinate: [centerLng, centerLat],
      zoomLevel,
    };
  };

  const boundsCamera = autoFitBounds ? getBoundsCamera() : null;
  const finalCamera = boundsCamera || initialCamera;

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        logoEnabled={false}
        attributionEnabled={true}
        compassEnabled={true}
        zoomEnabled={true}
        scrollEnabled={true}
        pitchEnabled={true}
        rotateEnabled={true}
      >
        <Camera
          centerCoordinate={finalCamera.centerCoordinate}
          zoomLevel={finalCamera.zoomLevel}
        />
        {/* Tile layer */}
        <RasterSource
          id="tileSource"
          tileUrlTemplates={['https://tile.openstreetmap.org/{z}/{x}/{y}.png']}
          tileSize={256}
        >
          <RasterLayer id="tileLayer" sourceID="tileSource" />
        </RasterSource>
        {/* Route line */}
        {showRoute && routeCoordinates.length > 1 && (
          <ShapeSource id="route" shape={routeGeoJSON}>
            <LineLayer
              id="route-line"
              style={{
                lineColor: '#2196F3',
                lineWidth: 4,
                lineOpacity: 0.8,
              }}
            />
          </ShapeSource>
        )}

        {/* Start marker (green circle) */}
        {startMarkers.length > 0 && (
          <ShapeSource id="start-markers" shape={startMarkersGeoJSON}>
            <CircleLayer
              id="start-circles"
              style={{
                circleRadius: 8,
                circleColor: '#4CAF50',
                circleStrokeColor: '#fff',
                circleStrokeWidth: 2,
              }}
            />
          </ShapeSource>
        )}

        {/* Current location marker (red circle) */}
        {currentMarkers.length > 0 && (
          <ShapeSource id="current-markers" shape={currentMarkersGeoJSON}>
            <CircleLayer
              id="current-circles"
              style={{
                circleRadius: 10,
                circleColor: '#f44336',
                circleStrokeColor: '#fff',
                circleStrokeWidth: 3,
              }}
            />
          </ShapeSource>
        )}

        {/* End marker (red circle) */}
        {endMarkers.length > 0 && (
          <ShapeSource id="end-markers" shape={endMarkersGeoJSON}>
            <CircleLayer
              id="end-circles"
              style={{
                circleRadius: 8,
                circleColor: '#f44336',
                circleStrokeColor: '#fff',
                circleStrokeWidth: 2,
              }}
            />
          </ShapeSource>
        )}

        {/* Point markers (blue circles) */}
        {pointMarkers.length > 0 && (
          <ShapeSource id="point-markers" shape={pointMarkersGeoJSON}>
            <CircleLayer
              id="point-circles"
              style={{
                circleRadius: 6,
                circleColor: '#2196F3',
                circleStrokeColor: '#fff',
                circleStrokeWidth: 2,
              }}
            />
          </ShapeSource>
        )}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    height: 300,
    marginBottom: 20,
    borderRadius: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  map: {
    flex: 1,
  },
});
