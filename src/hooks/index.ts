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
