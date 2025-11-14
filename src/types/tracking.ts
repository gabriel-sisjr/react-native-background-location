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
}
