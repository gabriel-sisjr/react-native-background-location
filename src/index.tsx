import BackgroundLocationModule from './NativeBackgroundLocation';
import type { TrackingOptions, Coords } from './types';
import type { TrackingOptionsSpec } from './NativeBackgroundLocation';
import {
  LocationPermissionStatus as LocationPermissionStatusEnum,
  LocationAccuracy as LocationAccuracyEnum,
  NotificationPriority as NotificationPriorityEnum,
} from './types/enums';

// Export types
export type {
  Coords,
  TrackingStatus,
  LocationUpdateEvent,
  TrackingOptions,
} from './NativeBackgroundLocation';
export type {
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

// Export enums (as values) - import and re-export as named exports to ensure they're available at runtime
export const LocationPermissionStatus = LocationPermissionStatusEnum;
export const LocationAccuracy = LocationAccuracyEnum;
export const NotificationPriority = NotificationPriorityEnum;

// Export hooks
export {
  useLocationPermissions,
  useBackgroundLocation,
  useLocationTracking,
  useLocationUpdates,
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
          notificationTitle: trackingOptions.notificationTitle,
          notificationText: trackingOptions.notificationText,
          notificationChannelName: trackingOptions.notificationChannelName,
          notificationPriority: trackingOptions.notificationPriority
            ? String(trackingOptions.notificationPriority)
            : undefined,
          foregroundOnly: trackingOptions.foregroundOnly,
          distanceFilter: trackingOptions.distanceFilter,
          notificationSmallIcon: trackingOptions.notificationSmallIcon,
          notificationColor: trackingOptions.notificationColor,
          notificationShowTimestamp: trackingOptions.notificationShowTimestamp,
          notificationActions: trackingOptions.notificationActions
            ? JSON.stringify(trackingOptions.notificationActions.slice(0, 3))
            : undefined,
          notificationLargeIcon: trackingOptions.notificationLargeIcon,
          notificationSubtext: trackingOptions.notificationSubtext,
          notificationChannelId: trackingOptions.notificationChannelId,
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
