/**
 * Types and interfaces for location permissions
 */

import type { LocationPermissionStatus } from './enums';

/**
 * Permission state
 */
export interface PermissionState {
  hasPermission: boolean;
  status: LocationPermissionStatus;
  canRequestAgain: boolean;
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
