/**
 * Centralized type exports for react-native-background-location
 */

// Enums
export {
  LocationPermissionStatus,
  LocationAccuracy,
  LocationActivityType,
  NotificationPriority,
  NotificationPermissionStatus,
  MotionActivityType,
  MotionConfidence,
  MotionPermissionStatus,
  MotionDetectionStatus,
  MotionReductionStatus,
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
  LocationPermissionState,
  NotificationPermissionState,
  PermissionState,
  UseLocationPermissionsResult,
  PermissionRationale,
  RequestPermissionsOptions,
} from './permissions';

// Hook types
export type {
  UseBackgroundLocationResult,
  UseLocationTrackingOptions,
  UseLocationUpdatesOptions,
  UseLocationUpdatesResult,
} from './hooks';

// Motion activity types
export type {
  MotionActivityOptions,
  MotionReductionOptions,
  MotionActivityEvent,
  MotionActivityState,
  MotionActivityListener,
  MotionActivitySubscription,
  UseMotionActivityOptions,
  UseMotionActivityResult,
} from './motion';

// Notification types
export type { NotificationOptions } from './notifications';
export { GEOFENCE_TEMPLATE_VARS } from './notifications';

// Geofencing types
export { GeofenceTransitionType, GeofenceErrorCode } from './geofencing';

export type { GeofenceRegion, GeofenceTransitionEvent } from './geofencing';
