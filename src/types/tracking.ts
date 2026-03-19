/**
 * Types and interfaces for location tracking
 */

import type { LocationAccuracy, NotificationPriority } from './enums';

/**
 * Location coordinates with extended location data
 */
export interface Coords {
  /**
   * Latitude in decimal degrees
   */
  latitude: string;
  /**
   * Longitude in decimal degrees
   */
  longitude: string;
  /**
   * Timestamp in milliseconds since Unix epoch
   */
  timestamp: number;
  /**
   * Horizontal accuracy in meters
   * @optional
   */
  accuracy?: number;
  /**
   * Altitude in meters above sea level
   * @optional
   */
  altitude?: number;
  /**
   * Speed in meters per second
   * @optional
   */
  speed?: number;
  /**
   * Bearing in degrees (0-360)
   * @optional
   */
  bearing?: number;
  /**
   * Vertical accuracy in meters (Android API 26+)
   * @optional
   */
  verticalAccuracyMeters?: number;
  /**
   * Speed accuracy in meters per second (Android API 26+)
   * @optional
   */
  speedAccuracyMetersPerSecond?: number;
  /**
   * Bearing accuracy in degrees (Android API 26+)
   * @optional
   */
  bearingAccuracyDegrees?: number;
  /**
   * Elapsed realtime in nanoseconds since system boot
   * @optional
   */
  elapsedRealtimeNanos?: number;
  /**
   * Location provider (gps, network, passive, etc.)
   * @optional
   */
  provider?: string;
  /**
   * Whether the location is from a mock provider (Android API 18+)
   * @optional
   */
  isFromMockProvider?: boolean;
}

/**
 * Tracking status
 */
export interface TrackingStatus {
  active: boolean;
  tripId?: string;
}

/**
 * Location update event with extended location data
 */
export interface LocationUpdateEvent {
  /**
   * Trip identifier for this location update
   */
  tripId: string;
  /**
   * Latitude in decimal degrees
   */
  latitude: string;
  /**
   * Longitude in decimal degrees
   */
  longitude: string;
  /**
   * Timestamp in milliseconds since Unix epoch
   */
  timestamp: number;
  /**
   * Horizontal accuracy in meters
   * @optional
   */
  accuracy?: number;
  /**
   * Altitude in meters above sea level
   * @optional
   */
  altitude?: number;
  /**
   * Speed in meters per second
   * @optional
   */
  speed?: number;
  /**
   * Bearing in degrees (0-360)
   * @optional
   */
  bearing?: number;
  /**
   * Vertical accuracy in meters (Android API 26+)
   * @optional
   */
  verticalAccuracyMeters?: number;
  /**
   * Speed accuracy in meters per second (Android API 26+)
   * @optional
   */
  speedAccuracyMetersPerSecond?: number;
  /**
   * Bearing accuracy in degrees (Android API 26+)
   * @optional
   */
  bearingAccuracyDegrees?: number;
  /**
   * Elapsed realtime in nanoseconds since system boot
   * @optional
   */
  elapsedRealtimeNanos?: number;
  /**
   * Location provider (gps, network, passive, etc.)
   * @optional
   */
  provider?: string;
  /**
   * Whether the location is from a mock provider (Android API 18+)
   * @optional
   */
  isFromMockProvider?: boolean;
}

/**
 * Warning types emitted by the location service
 */
export type LocationWarningType =
  | 'SERVICE_TIMEOUT'
  | 'TASK_REMOVED'
  | 'LOCATION_UNAVAILABLE';

/**
 * Warning event emitted by the location service
 * Used for non-critical issues that don't stop tracking
 */
export interface LocationWarningEvent {
  /**
   * Trip identifier for this warning
   */
  tripId: string;
  /**
   * Type of warning
   * - SERVICE_TIMEOUT: Android 15+ foreground service timeout reached, service is restarting
   * - TASK_REMOVED: App was swiped from recents, tracking continues in background
   * - LOCATION_UNAVAILABLE: GPS signal lost or location services disabled
   */
  type: LocationWarningType;
  /**
   * Human-readable description of the warning
   */
  message: string;
  /**
   * Timestamp when the warning was emitted
   */
  timestamp: number;
}

/**
 * Configuration options for location tracking
 */
export interface TrackingOptions {
  /**
   * Interval between location updates in milliseconds
   * @default 5000 (5 seconds)
   */
  updateInterval?: number;

  /**
   * Fastest interval between location updates in milliseconds
   * The system will never update location faster than this interval
   * @default 3000 (3 seconds)
   */
  fastestInterval?: number;

  /**
   * Maximum wait time in milliseconds before delivering location updates
   * Allows batching of location updates for better battery efficiency
   * @default 10000 (10 seconds)
   */
  maxWaitTime?: number;

  /**
   * Location accuracy priority
   * @default LocationAccuracy.HIGH_ACCURACY
   */
  accuracy?: LocationAccuracy;

  /**
   * Whether to wait for accurate location before delivering updates
   * If true, the system may delay location updates until accurate location is available
   * @default false
   */
  waitForAccurateLocation?: boolean;

  /**
   * Minimum distance in meters between location updates
   * The system will not deliver location updates until the device has moved at least this distance
   * @default 0 (no distance filter - all updates delivered)
   * @platform Android
   */
  distanceFilter?: number;

  /**
   * Notification title for foreground service
   * @default "Location Tracking"
   */
  notificationTitle?: string;

  /**
   * Notification text for foreground service
   * @default "Tracking your location in background"
   */
  notificationText?: string;

  /**
   * Notification channel name (Android)
   * @default "Background Location"
   */
  notificationChannelName?: string;

  /**
   * Notification priority (Android)
   * @default NotificationPriority.LOW
   */
  notificationPriority?: NotificationPriority;

  /**
   * Foreground-only mode (does not require background location permission)
   * When enabled, tracking only works while the app is in foreground or visible.
   * Useful for privacy-conscious users who don't want to grant background location permission.
   * @default false
   * @platform Android
   */
  foregroundOnly?: boolean;

  /**
   * Interval in milliseconds to throttle the onLocationUpdate callback execution
   * Locations are still collected at the updateInterval rate, but the callback
   * is only executed at this interval. Useful for syncing to servers without
   * overwhelming the network while still collecting frequent location data.
   * @default undefined (callback called on every location update)
   */
  onUpdateInterval?: number;

  /**
   * Name of the drawable resource to use as the notification small icon
   * Must be a valid drawable resource name in the app's res/drawable directory
   * @example "ic_notification"
   * @default Android's built-in ic_menu_mylocation
   * @platform Android
   */
  notificationSmallIcon?: string;

  /**
   * Hex color string for the notification accent color
   * @example "#FF5722"
   * @default undefined (system default)
   * @platform Android
   */
  notificationColor?: string;

  /**
   * Whether to show the timestamp on the notification
   * @default false
   * @platform Android
   */
  notificationShowTimestamp?: boolean;
}
