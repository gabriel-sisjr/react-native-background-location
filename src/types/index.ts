/**
 * Centralized type exports for react-native-background-location
 */

// Enums
export {
  LocationPermissionStatus,
  LocationAccuracy,
  NotificationPriority,
} from './enums';

// Tracking types
export type {
  Coords,
  TrackingStatus,
  LocationUpdateEvent,
  LocationWarningEvent,
  LocationWarningType,
  TrackingOptions,
  NotificationAction,
  NotificationActionEvent,
} from './tracking';

// Permission types
export type {
  PermissionState,
  UseLocationPermissionsResult,
} from './permissions';

// Hook types
export type {
  UseBackgroundLocationResult,
  UseLocationTrackingOptions,
  UseLocationUpdatesOptions,
  UseLocationUpdatesResult,
} from './hooks';

// Geofencing types
export { GeofenceTransitionType, GeofenceErrorCode } from './geofencing';

export type { GeofenceRegion, GeofenceTransitionEvent } from './geofencing';
