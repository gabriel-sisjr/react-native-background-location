/**
 * Geofencing types for react-native-background-location
 */

/**
 * Type of geofence transition detected
 */
export enum GeofenceTransitionType {
  /** Device entered the geofence region */
  ENTER = 'ENTER',
  /** Device exited the geofence region */
  EXIT = 'EXIT',
  /** Device dwelled in the geofence region for the configured duration */
  DWELL = 'DWELL',
}

/**
 * Error codes specific to geofencing operations
 */
export enum GeofenceErrorCode {
  /** Invalid region parameters (coordinates or radius) */
  INVALID_REGION = 'INVALID_REGION',
  /** Geofence identifier already registered */
  DUPLICATE_IDENTIFIER = 'DUPLICATE_IDENTIFIER',
  /** Platform geofence limit exceeded */
  LIMIT_EXCEEDED = 'LIMIT_EXCEEDED',
  /** Native monitoring failed to start */
  MONITORING_FAILED = 'MONITORING_FAILED',
  /** Native module not available */
  NOT_AVAILABLE = 'NOT_AVAILABLE',
  /** Insufficient location permissions */
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  /** Google Play Services unavailable (Android only) */
  PLAY_SERVICES_UNAVAILABLE = 'PLAY_SERVICES_UNAVAILABLE',
}

/**
 * Defines a circular geofence region
 */
export interface GeofenceRegion {
  /** Unique identifier for this geofence (consumer-provided, required) */
  identifier: string;
  /** Center latitude (-90 to 90) */
  latitude: number;
  /** Center longitude (-180 to 180) */
  longitude: number;
  /** Radius in meters (minimum 100) */
  radius: number;
  /** Transition types to monitor (default: [ENTER, EXIT]) */
  transitionTypes?: GeofenceTransitionType[];
  /** Loitering delay in milliseconds for DWELL detection (default: 30000) */
  loiteringDelay?: number;
  /** Optional expiration duration in milliseconds. If set, geofence expires automatically. If omitted, remains active indefinitely. */
  expirationDuration?: number;
  /** Optional metadata (JSON-serializable) */
  metadata?: Record<string, unknown>;
}

/**
 * Event emitted when a geofence transition is detected
 */
export interface GeofenceTransitionEvent {
  /** Identifier of the geofence that triggered the event */
  geofenceId: string;
  /** Type of transition detected */
  transitionType: GeofenceTransitionType;
  /** Latitude of the device at the moment of transition */
  latitude: number;
  /** Longitude of the device at the moment of transition */
  longitude: number;
  /** Timestamp of the transition (ISO 8601 string) */
  timestamp: string;
  /** Distance from the center of the geofence in meters */
  distanceFromCenter: number;
  /** Metadata associated with the geofence (if any) */
  metadata?: Record<string, unknown>;
}
