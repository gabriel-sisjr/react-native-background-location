/**
 * Types and interfaces for react-native-background-location
 */

export interface Coords {
  latitude: string;
  longitude: string;
  timestamp: number;
}

export interface TrackingStatus {
  active: boolean;
  tripId?: string;
}

export enum LocationPermissionStatus {
  GRANTED = 'granted',
  DENIED = 'denied',
  BLOCKED = 'blocked',
  UNDETERMINED = 'undetermined',
}

export interface PermissionState {
  hasPermission: boolean;
  status: LocationPermissionStatus;
  canRequestAgain: boolean;
}

export interface UseLocationPermissionsResult {
  /**
   * Current permission state
   */
  permissionStatus: PermissionState;

  /**
   * Request location permissions
   * Returns true if all permissions are granted
   */
  requestPermissions: () => Promise<boolean>;

  /**
   * Check current permission status without requesting
   */
  checkPermissions: () => Promise<boolean>;

  /**
   * Whether permissions are currently being requested
   */
  isRequesting: boolean;
}

export interface UseBackgroundLocationResult {
  /**
   * Current trip ID if tracking is active
   */
  tripId: string | null;

  /**
   * Whether location tracking is currently active
   */
  isTracking: boolean;

  /**
   * All locations collected for the current trip
   */
  locations: Coords[];

  /**
   * Whether an operation is in progress
   */
  isLoading: boolean;

  /**
   * Last error that occurred
   */
  error: Error | null;

  /**
   * Start tracking with optional custom trip ID
   */
  startTracking: (customTripId?: string) => Promise<string | null>;

  /**
   * Stop tracking
   */
  stopTracking: () => Promise<void>;

  /**
   * Refresh locations for current trip
   */
  refreshLocations: () => Promise<void>;

  /**
   * Clear all data for current trip
   */
  clearCurrentTrip: () => Promise<void>;

  /**
   * Clear error state
   */
  clearError: () => void;
}

export interface UseLocationTrackingOptions {
  /**
   * Automatically start tracking when component mounts
   * @default false
   */
  autoStart?: boolean;

  /**
   * Custom trip ID to use
   */
  tripId?: string;

  /**
   * Callback when tracking starts
   */
  onTrackingStart?: (tripId: string) => void;

  /**
   * Callback when tracking stops
   */
  onTrackingStop?: () => void;

  /**
   * Callback when error occurs
   */
  onError?: (error: Error) => void;
}
