import BackgroundLocationModule from './NativeBackgroundLocation';
import type { TrackingOptions, Coords } from './types';
import {
  LocationPermissionStatus as LocationPermissionStatusEnum,
  LocationAccuracy as LocationAccuracyEnum,
  NotificationPriority as NotificationPriorityEnum,
  NotificationPermissionStatus as NotificationPermissionStatusEnum,
} from './types/enums';
import { GeofenceErrorCode } from './types/geofencing';
import type {
  GeofenceRegion,
  GeofenceTransitionEvent,
} from './types/geofencing';
import type { NotificationOptions } from './types/notifications';
import {
  assertNativeModuleAvailable,
  isNativeModuleAvailable,
  toTrackingOptionsSpec,
  validateGeofenceRegion,
  prepareGeofenceRegion,
  serializeGeofenceRegion,
} from './utils';
import { GeofenceError } from './errors';

// Export types
export type {
  Coords,
  TrackingStatus,
  LocationUpdateEvent,
  TrackingOptions,
  PermissionStatusResult,
} from './NativeBackgroundLocation';
export type {
  LocationPermissionState,
  NotificationPermissionState,
  PermissionState,
  UseLocationPermissionsResult,
  UseBackgroundLocationResult,
  UseLocationTrackingOptions,
  UseLocationUpdatesOptions,
  UseLocationUpdatesResult,
  LocationWarningEvent,
  LocationWarningType,
  NotificationAction,
  NotificationActionEvent,
} from './types';
export type { UseLocationTrackingResult } from './hooks/useLocationTracking';
export type { UseGeofencingOptions, UseGeofencingReturn } from './hooks';
export type { UseGeofenceEventsOptions } from './hooks';

// Geofencing type exports
export type { GeofenceRegion, GeofenceTransitionEvent } from './types';
export { GeofenceTransitionType, GeofenceErrorCode } from './types';

// Notification type exports
export type { NotificationOptions } from './types';
export { GEOFENCE_TEMPLATE_VARS } from './types';

// Export enums (as values + companion types for type annotations)
// Import and re-export as named exports to ensure they're available at runtime
export const LocationPermissionStatus = LocationPermissionStatusEnum;
export type LocationPermissionStatus = LocationPermissionStatusEnum;
export const LocationAccuracy = LocationAccuracyEnum;
export type LocationAccuracy = LocationAccuracyEnum;
export const NotificationPriority = NotificationPriorityEnum;
export type NotificationPriority = NotificationPriorityEnum;
export const NotificationPermissionStatus = NotificationPermissionStatusEnum;
export type NotificationPermissionStatus = NotificationPermissionStatusEnum;

// Export errors
export { GeofenceError } from './errors';

// Export hooks
export {
  useLocationPermissions,
  useBackgroundLocation,
  useLocationTracking,
  useLocationUpdates,
  useGeofencing,
  useGeofenceEvents,
  useGeofencePermissions,
} from './hooks';

/**
 * Starts location tracking in background for a specific trip.
 *
 * When the native module is not available (e.g. running in a simulator
 * without the module linked), logs a warning and returns a fallback tripId
 * without crashing.
 *
 * @param tripIdOrOptions Optional trip identifier or tracking options. If omitted, a new tripId will be generated
 * @param options Optional tracking configuration options (only used when first param is tripId)
 * @returns Promise resolving to the effective tripId (received or generated)
 */
export function startTracking(
  tripIdOrOptions?: string | TrackingOptions,
  options?: TrackingOptions
): Promise<string> {
  if (!isNativeModuleAvailable()) {
    console.warn(
      'BackgroundLocation not available - running in simulator or module not linked?'
    );
    const fallbackTripId =
      typeof tripIdOrOptions === 'string'
        ? tripIdOrOptions
        : `simulator-trip-${Date.now()}`;
    return Promise.resolve(fallbackTripId);
  }

  // Handle overload: startTracking(options?) or startTracking(tripId?, options?)
  let tripId: string | undefined;
  let trackingOptions: TrackingOptions | undefined;

  if (typeof tripIdOrOptions === 'object') {
    // Called as startTracking(options)
    tripId = undefined;
    trackingOptions = tripIdOrOptions;
  } else {
    // Called as startTracking(tripId?, options?)
    tripId = tripIdOrOptions;
    trackingOptions = options;
  }

  return BackgroundLocationModule.startTracking(
    tripId,
    toTrackingOptionsSpec(trackingOptions)
  );
}

/**
 * Stops all location tracking and terminates the background service.
 * @returns Promise that resolves when tracking is stopped
 */
export function stopTracking(): Promise<void> {
  if (!isNativeModuleAvailable()) {
    console.warn(
      'BackgroundLocation not available - running in simulator or module not linked?'
    );
    return Promise.resolve();
  }
  return BackgroundLocationModule.stopTracking();
}

/**
 * Checks if location tracking is currently active.
 * @returns Promise resolving to object with active status and current tripId if tracking
 */
export function isTracking(): Promise<{ active: boolean; tripId?: string }> {
  if (!isNativeModuleAvailable()) {
    console.warn(
      'BackgroundLocation not available - running in simulator or module not linked?'
    );
    return Promise.resolve({ active: false });
  }
  return BackgroundLocationModule.isTracking();
}

/**
 * Retrieves all stored location points for a specific trip.
 * @param tripId The trip identifier
 * @returns Promise resolving to array of location coordinates with extended location data
 */
export function getLocations(tripId: string): Promise<Coords[]> {
  if (!isNativeModuleAvailable()) {
    console.warn(
      'BackgroundLocation not available - running in simulator or module not linked?'
    );
    return Promise.resolve([]);
  }
  return BackgroundLocationModule.getLocations(tripId);
}

/**
 * Clears all stored location data for a specific trip.
 * @param tripId The trip identifier to clear
 * @returns Promise that resolves when data is cleared
 */
export function clearTrip(tripId: string): Promise<void> {
  if (!isNativeModuleAvailable()) {
    console.warn(
      'BackgroundLocation not available - running in simulator or module not linked?'
    );
    return Promise.resolve();
  }
  return BackgroundLocationModule.clearTrip(tripId);
}

/**
 * Updates the notification content while tracking is active.
 * Dynamic updates are transient and do not persist across service restarts.
 * @param title New notification title
 * @param text New notification text
 * @returns Promise that resolves when notification is updated
 */
export function updateNotification(title: string, text: string): Promise<void> {
  if (!isNativeModuleAvailable()) {
    console.warn(
      'BackgroundLocation not available - running in simulator or module not linked?'
    );
    return Promise.resolve();
  }
  return BackgroundLocationModule.updateNotification(title, text);
}

// --- Geofence Notification Configuration ---

/**
 * Configures global notification options for geofence transitions.
 * Configuration persists across app restarts (SharedPreferences/UserDefaults).
 * Applies to all future transitions. Already-fired transitions are unaffected.
 */
export async function configureGeofenceNotifications(
  options: NotificationOptions
): Promise<void> {
  assertNativeModuleAvailable();
  const json = JSON.stringify(options);
  return BackgroundLocationModule.configureGeofenceNotifications(json);
}

/**
 * Retrieves the current geofence notification configuration.
 * Returns an empty object if no configuration has been set.
 */
export async function getGeofenceNotificationConfig(): Promise<NotificationOptions> {
  assertNativeModuleAvailable();
  const json = await BackgroundLocationModule.getGeofenceNotificationConfig();
  return JSON.parse(json) as NotificationOptions;
}

// --- Geofencing ---

/**
 * Registers a single geofence region for monitoring
 * @param region The geofence region to register
 * @throws {GeofenceError} If a geofence with the same identifier already exists
 */
export async function addGeofence(region: GeofenceRegion): Promise<void> {
  assertNativeModuleAvailable();
  validateGeofenceRegion(region);
  const active = await getActiveGeofences();
  if (active.some((g) => g.identifier === region.identifier)) {
    throw new GeofenceError(
      GeofenceErrorCode.DUPLICATE_IDENTIFIER,
      `Geofence with identifier "${region.identifier}" already exists`
    );
  }
  const json = serializeGeofenceRegion(region);
  return BackgroundLocationModule.addGeofence(json);
}

/**
 * Registers multiple geofence regions atomically (all-or-nothing)
 * @param regions Array of geofence regions to register
 * @throws {GeofenceError} If duplicate identifiers are found within the batch
 */
export async function addGeofences(regions: GeofenceRegion[]): Promise<void> {
  assertNativeModuleAvailable();
  regions.forEach(validateGeofenceRegion);
  // Check for duplicate identifiers within the batch
  const identifiers = regions.map((r) => r.identifier);
  const duplicates = identifiers.filter(
    (id, idx) => identifiers.indexOf(id) !== idx
  );
  if (duplicates.length > 0) {
    throw new GeofenceError(
      GeofenceErrorCode.DUPLICATE_IDENTIFIER,
      `Duplicate identifiers in batch: ${[...new Set(duplicates)].join(', ')}`
    );
  }
  const json = JSON.stringify(regions.map(prepareGeofenceRegion));
  return BackgroundLocationModule.addGeofences(json);
}

/**
 * Removes a single geofence by identifier
 * @param identifier The geofence identifier to remove
 */
export async function removeGeofence(identifier: string): Promise<void> {
  assertNativeModuleAvailable();
  return BackgroundLocationModule.removeGeofence(identifier);
}

/**
 * Removes multiple geofences by identifiers
 * @param identifiers Array of geofence identifiers to remove
 */
export async function removeGeofences(identifiers: string[]): Promise<void> {
  assertNativeModuleAvailable();
  return BackgroundLocationModule.removeGeofences(JSON.stringify(identifiers));
}

/**
 * Removes all registered geofences
 */
export async function removeAllGeofences(): Promise<void> {
  assertNativeModuleAvailable();
  return BackgroundLocationModule.removeAllGeofences();
}

/**
 * Returns all currently active geofences
 * @returns Array of active geofence regions
 */
export async function getActiveGeofences(): Promise<GeofenceRegion[]> {
  assertNativeModuleAvailable();
  const json = await BackgroundLocationModule.getActiveGeofences();
  return JSON.parse(json) as GeofenceRegion[];
}

/**
 * Returns the maximum number of geofences supported by the platform
 * @returns Platform limit (Android: 100, iOS: 20)
 */
export async function getMaxGeofences(): Promise<number> {
  assertNativeModuleAvailable();
  return BackgroundLocationModule.getMaxGeofences();
}

/**
 * Retrieves stored geofence transition events
 * @param identifier Optional geofence identifier to filter by. If omitted, returns all transitions.
 * @returns Array of geofence transition events
 */
export async function getGeofenceTransitions(
  identifier?: string
): Promise<GeofenceTransitionEvent[]> {
  assertNativeModuleAvailable();
  const json =
    await BackgroundLocationModule.getGeofenceTransitions(identifier);
  return JSON.parse(json) as GeofenceTransitionEvent[];
}

/**
 * Clears stored geofence transition events
 * @param identifier Optional geofence identifier to clear. If omitted, clears all transitions.
 */
export async function clearGeofenceTransitions(
  identifier?: string
): Promise<void> {
  assertNativeModuleAvailable();
  return BackgroundLocationModule.clearGeofenceTransitions(identifier);
}
