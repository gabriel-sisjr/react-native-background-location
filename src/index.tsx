import { Platform, NativeModules } from 'react-native';
import BackgroundLocationModule from './NativeBackgroundLocation';

export type { Coords, TrackingStatus } from './NativeBackgroundLocation';

// Check if native module is available (won't be in simulator without proper setup)
const isNativeModuleAvailable = () => {
  const nativeModule =
    Platform.OS === 'android' ? NativeModules.BackgroundLocation : null;
  return !!nativeModule;
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
   * @returns Promise resolving to the effective tripId (received or generated)
   */
  startTracking(tripId?: string): Promise<string> {
    if (!isNativeModuleAvailable()) {
      console.warn(
        'BackgroundLocation not available - running in simulator or module not linked?'
      );
      return Promise.resolve(tripId || `simulator-trip-${Date.now()}`);
    }
    return BackgroundLocationModule.startTracking(tripId);
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
