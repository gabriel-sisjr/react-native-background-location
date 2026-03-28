/**
 * Types and interfaces for location and notification permissions
 */

import type {
  LocationPermissionStatus,
  NotificationPermissionStatus,
} from './enums';

/**
 * Location permission state with granular status information
 */
export interface LocationPermissionState {
  hasPermission: boolean;
  status: LocationPermissionStatus;
  canRequestAgain: boolean;
}

/**
 * Notification permission state with granular status information
 */
export interface NotificationPermissionState {
  hasPermission: boolean;
  status: NotificationPermissionStatus;
  canRequestAgain: boolean;
}

/**
 * Combined permission state for location and notification permissions
 */
export interface PermissionState {
  hasAllPermissions: boolean;
  location: LocationPermissionState;
  notification: NotificationPermissionState;
}

/**
 * Result type for useLocationPermissions hook
 */
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
