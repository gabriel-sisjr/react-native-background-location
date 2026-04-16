import type { GeofenceRegion } from '../types/geofencing';

/**
 * Validates a geofence region's parameters before sending it to the native
 * layer. Throws a descriptive `Error` if any constraint is violated.
 *
 * Constraints enforced:
 *  - `identifier` must be a non-empty string (after trimming)
 *  - `latitude` in [-90, 90]
 *  - `longitude` in [-180, 180]
 *  - `radius` >= 100 meters
 *  - `loiteringDelay`, when provided, must be non-negative
 *
 * @internal
 */
export function validateGeofenceRegion(region: GeofenceRegion): void {
  if (!region.identifier || region.identifier.trim().length === 0) {
    throw new Error('[BackgroundLocation] Geofence identifier is required');
  }
  if (region.latitude < -90 || region.latitude > 90) {
    throw new Error(
      `[BackgroundLocation] Invalid latitude: ${region.latitude}. Must be between -90 and 90.`
    );
  }
  if (region.longitude < -180 || region.longitude > 180) {
    throw new Error(
      `[BackgroundLocation] Invalid longitude: ${region.longitude}. Must be between -180 and 180.`
    );
  }
  if (region.radius < 100) {
    throw new Error(
      `[BackgroundLocation] Invalid radius: ${region.radius}. Minimum is 100 meters.`
    );
  }
  if (region.loiteringDelay != null && region.loiteringDelay < 0) {
    throw new Error(
      `[BackgroundLocation] Invalid loiteringDelay: ${region.loiteringDelay}. Must be non-negative.`
    );
  }
}
