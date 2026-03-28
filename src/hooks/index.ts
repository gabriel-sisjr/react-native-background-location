/**
 * React Hooks for background location tracking
 *
 * @module hooks
 */

export { useLocationPermissions } from './useLocationPermissions';
export type { UseLocationPermissionsResult } from '../types';

export { useBackgroundLocation } from './useBackgroundLocation';
export type {
  UseBackgroundLocationResult,
  UseLocationTrackingOptions,
} from '../types';

export { useLocationTracking } from './useLocationTracking';
export type { UseLocationTrackingResult } from './useLocationTracking';

export { useLocationUpdates } from './useLocationUpdates';
export type {
  UseLocationUpdatesOptions,
  UseLocationUpdatesResult,
} from '../types';

export { useGeofencing } from './useGeofencing';
export type {
  UseGeofencingOptions,
  UseGeofencingReturn,
} from './useGeofencing';

export { useGeofenceEvents } from './useGeofenceEvents';
export type { UseGeofenceEventsOptions } from './useGeofenceEvents';

// Alias: geofencing uses the same location permissions
export { useLocationPermissions as useGeofencePermissions } from './useLocationPermissions';
