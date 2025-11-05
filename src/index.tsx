import BackgroundLocationModule from './NativeBackgroundLocation';
import type { TrackingOptions } from './types';
import type { TrackingOptionsSpec } from './NativeBackgroundLocation';

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
} from './types';
export type { UseLocationTrackingResult } from './hooks/useLocationTracking';

// Export enums (as values)
export {
  LocationPermissionStatus,
  LocationAccuracy,
  NotificationPriority,
} from './types';

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
   * @param tripId Optional trip identifier. If omitted, a new one will be generated
   * @param options Optional tracking configuration options
   * @returns Promise resolving to the effective tripId (received or generated)
   */
  startTracking(tripId?: string, options?: TrackingOptions): Promise<string> {
    if (!isNativeModuleAvailable()) {
      console.warn(
        'BackgroundLocation not available - running in simulator or module not linked?'
      );
      return Promise.resolve(tripId || `simulator-trip-${Date.now()}`);
    }
    // Convert TrackingOptions (with enums) to TrackingOptionsSpec (with strings) for Codegen
    const specOptions: TrackingOptionsSpec | undefined = options
      ? {
          updateInterval: options.updateInterval,
          fastestInterval: options.fastestInterval,
          maxWaitTime: options.maxWaitTime,
          accuracy: options.accuracy ? String(options.accuracy) : undefined,
          waitForAccurateLocation: options.waitForAccurateLocation,
          notificationTitle: options.notificationTitle,
          notificationText: options.notificationText,
          notificationChannelName: options.notificationChannelName,
          notificationPriority: options.notificationPriority
            ? String(options.notificationPriority)
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
   * @returns Promise resolving to array of location coordinates
   */
  getLocations(
    tripId: string
  ): Promise<
    Array<{ latitude: string; longitude: string; timestamp: number }>
  > {
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
};
