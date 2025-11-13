/**
 * Types and interfaces for location tracking
 */

import type { LocationAccuracy, NotificationPriority } from './enums';

/**
 * Location coordinates
 */
export interface Coords {
  latitude: string;
  longitude: string;
  timestamp: number;
}

/**
 * Tracking status
 */
export interface TrackingStatus {
  active: boolean;
  tripId?: string;
}

/**
 * Location update event
 */
export interface LocationUpdateEvent {
  tripId: string;
  latitude: string;
  longitude: string;
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
