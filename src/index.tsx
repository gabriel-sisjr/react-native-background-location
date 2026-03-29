import BackgroundLocationModule from './NativeBackgroundLocation';
import type { TrackingOptions, Coords } from './types';
import type { TrackingOptionsSpec } from './NativeBackgroundLocation';
import {
  LocationPermissionStatus as LocationPermissionStatusEnum,
  LocationAccuracy as LocationAccuracyEnum,
  NotificationPriority as NotificationPriorityEnum,
  NotificationPermissionStatus as NotificationPermissionStatusEnum,
} from './types/enums';
import { assertNativeModuleAvailable } from './utils/moduleCheck';
import { GeofenceTransitionType, GeofenceErrorCode } from './types/geofencing';
import type {
  GeofenceRegion,
  GeofenceTransitionEvent,
} from './types/geofencing';
import type { NotificationOptions } from './types/notifications';

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

// Export enums (as values) - import and re-export as named exports to ensure they're available at runtime
export const LocationPermissionStatus = LocationPermissionStatusEnum;
export const LocationAccuracy = LocationAccuracyEnum;
export const NotificationPriority = NotificationPriorityEnum;
export const NotificationPermissionStatus = NotificationPermissionStatusEnum;

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

// Check if native module is available (won't be in simulator without proper setup)
const isNativeModuleAvailable = () => {
  try {
    // Check if methods are available (works with Proxy mocks)
    // This must be checked first before checking if module exists
    if (typeof BackgroundLocationModule?.isTracking !== 'function') {
      return false;
    }
    // Check if module exists and is not null
    if (!BackgroundLocationModule || BackgroundLocationModule === null) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
};

/**
 * Background Location Tracking Module
 *
 * Provides location tracking capabilities that continue when the app is in background.
 * All methods return promises and will warn gracefully if native module is unavailable.
 */
export default {
  /**
   * Starts location tracking in background for a specific trip
   * @param tripIdOrOptions Optional trip identifier or tracking options. If omitted, a new tripId will be generated
   * @param options Optional tracking configuration options (only used when first param is tripId)
   * @returns Promise resolving to the effective tripId (received or generated)
   */
  startTracking(
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

    // Convert TrackingOptions (with enums) to TrackingOptionsSpec (with strings) for Codegen
    const specOptions: TrackingOptionsSpec | undefined = trackingOptions
      ? {
          updateInterval: trackingOptions.updateInterval,
          fastestInterval: trackingOptions.fastestInterval,
          maxWaitTime: trackingOptions.maxWaitTime,
          accuracy: trackingOptions.accuracy
            ? String(trackingOptions.accuracy)
            : undefined,
          waitForAccurateLocation: trackingOptions.waitForAccurateLocation,
          foregroundOnly: trackingOptions.foregroundOnly,
          distanceFilter: trackingOptions.distanceFilter,
          notificationOptions: trackingOptions.notificationOptions
            ? JSON.stringify(trackingOptions.notificationOptions)
            : undefined,
        }
      : undefined;
    return BackgroundLocationModule.startTracking(tripId, specOptions);
  },

  /**
   * Stops all location tracking and terminates the background service
   * @returns Promise that resolves when tracking is stopped
   */
  stopTracking(): Promise<void> {
    if (!isNativeModuleAvailable()) {
      console.warn(
        'BackgroundLocation not available - running in simulator or module not linked?'
      );
      return Promise.resolve();
    }
    return BackgroundLocationModule.stopTracking();
  },

  /**
   * Checks if location tracking is currently active
   * @returns Promise resolving to object with active status and current tripId if tracking
   */
  isTracking(): Promise<{ active: boolean; tripId?: string }> {
    if (!isNativeModuleAvailable()) {
      console.warn(
        'BackgroundLocation not available - running in simulator or module not linked?'
      );
      return Promise.resolve({ active: false });
    }
    return BackgroundLocationModule.isTracking();
  },

  /**
   * Retrieves all stored location points for a specific trip
   * @param tripId The trip identifier
   * @returns Promise resolving to array of location coordinates with extended location data
   */
  getLocations(tripId: string): Promise<Coords[]> {
    if (!isNativeModuleAvailable()) {
      console.warn(
        'BackgroundLocation not available - running in simulator or module not linked?'
      );
      return Promise.resolve([]);
    }
    return BackgroundLocationModule.getLocations(tripId);
  },

  /**
   * Clears all stored location data for a specific trip
   * @param tripId The trip identifier to clear
   * @returns Promise that resolves when data is cleared
   */
  clearTrip(tripId: string): Promise<void> {
    if (!isNativeModuleAvailable()) {
      console.warn(
        'BackgroundLocation not available - running in simulator or module not linked?'
      );
      return Promise.resolve();
    }
    return BackgroundLocationModule.clearTrip(tripId);
  },

  /**
   * Updates the notification content while tracking is active
   * Dynamic updates are transient and do not persist across service restarts
   * @param title New notification title
   * @param text New notification text
   * @returns Promise that resolves when notification is updated
   */
  updateNotification(title: string, text: string): Promise<void> {
    if (!isNativeModuleAvailable()) {
      console.warn(
        'BackgroundLocation not available - running in simulator or module not linked?'
      );
      return Promise.resolve();
    }
    return BackgroundLocationModule.updateNotification(title, text);
  },
};

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
 * Error class for geofencing-specific errors
 */
export class GeofenceError extends Error {
  code: GeofenceErrorCode;

  constructor(code: GeofenceErrorCode, message: string) {
    super(message);
    this.name = 'GeofenceError';
    this.code = code;
    Object.setPrototypeOf(this, GeofenceError.prototype);
  }
}

/**
 * Validates a geofence region's parameters before sending to native
 * @internal
 */
function validateGeofenceRegion(region: GeofenceRegion): void {
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

/**
 * Prepares a geofence region as a plain object ready for JSON.stringify
 * @internal
 */
function prepareGeofenceRegion(
  region: GeofenceRegion
): Record<string, unknown> {
  // Resolve notificationOptions: false → { enabled: false }, undefined → omit
  let notificationOptions: NotificationOptions | undefined;
  if (region.notificationOptions === false) {
    notificationOptions = { enabled: false };
  } else if (region.notificationOptions != null) {
    notificationOptions = region.notificationOptions;
  }

  const prepared: Record<string, unknown> = {
    ...region,
    transitionTypes: (
      region.transitionTypes ?? [
        GeofenceTransitionType.ENTER,
        GeofenceTransitionType.EXIT,
      ]
    ).map((t) => t.toString()),
    loiteringDelay: region.loiteringDelay ?? 30000,
    expirationDuration: region.expirationDuration ?? undefined,
    metadata: region.metadata ?? undefined,
  };

  if (notificationOptions !== undefined) {
    prepared.notificationOptions = notificationOptions;
  } else {
    delete prepared.notificationOptions;
  }

  return prepared;
}

/**
 * Serializes a geofence region to a JSON string for single region calls
 * @internal
 */
function serializeGeofenceRegion(region: GeofenceRegion): string {
  return JSON.stringify(prepareGeofenceRegion(region));
}

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
