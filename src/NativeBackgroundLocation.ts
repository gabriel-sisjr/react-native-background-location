import { TurboModuleRegistry, type TurboModule } from 'react-native';
import type {
  Coords,
  TrackingStatus,
  LocationUpdateEvent,
  TrackingOptions,
} from './types';

export type { Coords, TrackingStatus, LocationUpdateEvent, TrackingOptions };

/**
 * Permission status result from native permission check/request
 * Must be defined inline for Codegen compatibility
 */
export interface PermissionStatusResult {
  status: string;
  canRequestAgain: boolean;
}

/**
 * Tracking options interface for TurboModule spec
 * Must be defined inline for Codegen compatibility
 */
export interface TrackingOptionsSpec {
  updateInterval?: number;
  fastestInterval?: number;
  maxWaitTime?: number;
  accuracy?: string;
  waitForAccurateLocation?: boolean;
  notificationTitle?: string;
  notificationText?: string;
  notificationChannelName?: string;
  notificationPriority?: string;
  foregroundOnly?: boolean;
  distanceFilter?: number;
  notificationSmallIcon?: string;
  notificationColor?: string;
  notificationShowTimestamp?: boolean;
  notificationActions?: string; // JSON serialized - Codegen does not support typed object arrays
  notificationLargeIcon?: string;
  notificationSubtext?: string;
  notificationChannelId?: string;
}

export interface Spec extends TurboModule {
  /**
   * Starts location tracking in background for a specific trip
   * @param tripId Optional trip identifier. If omitted, a new one will be generated
   * @param options Optional tracking configuration options
   * @returns The effective tripId (received or generated)
   */
  startTracking(
    tripId?: string,
    options?: TrackingOptionsSpec
  ): Promise<string>;

  /**
   * Stops all location tracking and terminates the background service
   */
  stopTracking(): Promise<void>;

  /**
   * Checks if location tracking is currently active
   * @returns Object with active status and current tripId if tracking
   */
  isTracking(): Promise<TrackingStatus>;

  /**
   * Retrieves all stored location points for a specific trip
   * @param tripId The trip identifier
   * @returns Array of location coordinates
   */
  getLocations(tripId: string): Promise<Coords[]>;

  /**
   * Clears all stored location data for a specific trip
   * @param tripId The trip identifier to clear
   */
  clearTrip(tripId: string): Promise<void>;

  /**
   * Updates the notification content while tracking is active
   * @param title New notification title
   * @param text New notification text
   */
  updateNotification(title: string, text: string): Promise<void>;

  /**
   * Checks current location permission status without prompting
   * @returns Permission status and whether the user can be asked again
   */
  checkLocationPermission(): Promise<PermissionStatusResult>;

  /**
   * Requests location permissions from the user
   * @param foregroundOnly If true, only requests foreground (When In Use) permission
   * @returns Permission status after the request completes
   */
  requestLocationPermission(
    foregroundOnly: boolean
  ): Promise<PermissionStatusResult>;

  /**
   * Required by NativeEventEmitter on iOS
   * Called when a JS listener is added
   */
  addListener(eventName: string): void;

  /**
   * Required by NativeEventEmitter on iOS
   * Called when JS listeners are removed
   */
  removeListeners(count: number): void;

  // --- Geofencing Methods ---

  /**
   * Registers a single geofence region for monitoring
   * @param regionJson JSON-serialized GeofenceRegion object
   */
  addGeofence(regionJson: string): Promise<void>;

  /**
   * Registers multiple geofence regions atomically (all-or-nothing)
   * @param regionsJson JSON-serialized GeofenceRegion[] array
   */
  addGeofences(regionsJson: string): Promise<void>;

  /**
   * Removes a single geofence by identifier
   * @param identifier The geofence identifier to remove
   */
  removeGeofence(identifier: string): Promise<void>;

  /**
   * Removes multiple geofences by identifiers
   * @param identifiersJson JSON-serialized string[] array of identifiers
   */
  removeGeofences(identifiersJson: string): Promise<void>;

  /**
   * Removes all registered geofences
   */
  removeAllGeofences(): Promise<void>;

  /**
   * Returns all currently active geofences
   * @returns JSON-serialized GeofenceRegion[] array
   */
  getActiveGeofences(): Promise<string>;

  /**
   * Returns the maximum number of geofences supported by the platform
   * @returns Platform limit (Android: 100, iOS: 20)
   */
  getMaxGeofences(): Promise<number>;

  /**
   * Retrieves stored geofence transition events
   * @param identifier Optional geofence identifier to filter by. If omitted, returns all transitions.
   * @returns JSON-serialized GeofenceTransitionEvent[] array
   */
  getGeofenceTransitions(identifier?: string): Promise<string>;

  /**
   * Clears stored geofence transition events
   * @param identifier Optional geofence identifier to clear. If omitted, clears all transitions.
   */
  clearGeofenceTransitions(identifier?: string): Promise<void>;

  /**
   * Configures global notification options for geofence transitions
   * @param configJson JSON-serialized NotificationOptions object
   */
  configureGeofenceNotifications(configJson: string): Promise<void>;

  /**
   * Retrieves the current geofence notification configuration
   * @returns JSON-serialized NotificationOptions object, or '{}' if not configured
   */
  getGeofenceNotificationConfig(): Promise<string>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('BackgroundLocation');
