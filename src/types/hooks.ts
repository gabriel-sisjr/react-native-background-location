/**
 * Types and interfaces for React hooks
 */

import type {
  Coords,
  TrackingOptions,
  LocationWarningEvent,
  NotificationActionEvent,
} from './tracking';

/**
 * Result type for useBackgroundLocation hook
 */
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
   * Start tracking with optional custom trip ID and options
   */
  startTracking: (
    customTripId?: string,
    options?: TrackingOptions
  ) => Promise<string | null>;

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

/**
 * Options for useLocationTracking hook
 */
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
   * Tracking configuration options
   */
  options?: TrackingOptions;

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

/**
 * Options for useLocationUpdates hook
 */
export interface UseLocationUpdatesOptions {
  /**
   * Specific trip ID to watch
   * If not provided, watches updates for any active trip
   */
  tripId?: string;

  /**
   * Callback when a new location is received
   */
  onLocationUpdate?: (location: Coords) => void;

  /**
   * Interval in milliseconds to throttle the onLocationUpdate callback execution
   * Locations are still collected and stored, but the callback is only executed at this interval.
   * Useful for syncing to servers without overwhelming the network.
   * @default undefined (callback called on every location update)
   */
  onUpdateInterval?: number;

  /**
   * Callback when a warning is received from the location service
   * Warnings include: SERVICE_TIMEOUT, TASK_REMOVED, LOCATION_UNAVAILABLE
   */
  onLocationWarning?: (warning: LocationWarningEvent) => void;

  /**
   * Callback when a notification action button is pressed
   */
  onNotificationAction?: (event: NotificationActionEvent) => void;

  /**
   * Whether to automatically load existing locations on mount
   * @default true
   */
  autoLoad?: boolean;
}

/**
 * Result type for useLocationUpdates hook
 */
export interface UseLocationUpdatesResult {
  /**
   * Current trip ID being watched
   */
  tripId: string | null;

  /**
   * Whether location tracking is currently active
   */
  isTracking: boolean;

  /**
   * All locations received for the current trip
   * Updates automatically as new locations arrive
   */
  locations: Coords[];

  /**
   * The most recent location received
   */
  lastLocation: Coords | null;

  /**
   * The most recent warning from the location service
   * Includes warnings like SERVICE_TIMEOUT, TASK_REMOVED, LOCATION_UNAVAILABLE
   */
  lastWarning: LocationWarningEvent | null;

  /**
   * Whether data is being loaded
   */
  isLoading: boolean;

  /**
   * Last error that occurred
   */
  error: Error | null;

  /**
   * Clear error state
   */
  clearError: () => void;

  /**
   * Clear all locations for current trip
   */
  clearLocations: () => Promise<void>;
}
