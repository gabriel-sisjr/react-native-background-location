import { useState, useCallback, useEffect } from 'react';
import BackgroundLocationModule from '../NativeBackgroundLocation';
import type {
  UseBackgroundLocationResult,
  Coords,
  UseLocationTrackingOptions,
} from '../types';
import { Platform, NativeModules } from 'react-native';

// Check if native module is available
const isNativeModuleAvailable = () => {
  const nativeModule =
    Platform.OS === 'android' ? NativeModules.BackgroundLocation : null;
  return !!nativeModule;
};

/**
 * Hook to manage background location tracking
 *
 * Provides a complete interface for starting/stopping tracking,
 * managing trip data, and handling locations.
 *
 * @param options - Configuration options
 *
 * @example
 * ```tsx
 * function TrackingScreen() {
 *   const {
 *     isTracking,
 *     tripId,
 *     locations,
 *     startTracking,
 *     stopTracking,
 *     error
 *   } = useBackgroundLocation({
 *     autoStart: false,
 *     onTrackingStart: (id) => console.log('Started:', id),
 *     onError: (err) => console.error(err),
 *   });
 *
 *   return (
 *     <View>
 *       <Button onPress={startTracking}>
 *         {isTracking ? 'Stop' : 'Start'} Tracking
 *       </Button>
 *       <Text>Locations: {locations.length}</Text>
 *     </View>
 *   );
 * }
 * ```
 */
export function useBackgroundLocation(
  options: UseLocationTrackingOptions = {}
): UseBackgroundLocationResult {
  const {
    autoStart = false,
    tripId: initialTripId,
    onTrackingStart,
    onTrackingStop,
    onError,
  } = options;

  const [tripId, setTripId] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [locations, setLocations] = useState<Coords[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Check tracking status on mount
   */
  useEffect(() => {
    const checkStatus = async () => {
      if (!isNativeModuleAvailable()) {
        console.warn(
          'BackgroundLocation not available - running in simulator or module not linked?'
        );
        return;
      }

      try {
        const status = await BackgroundLocationModule.isTracking();
        setIsTracking(status.active);
        if (status.tripId) {
          setTripId(status.tripId);
          // Load existing locations
          const locs = await BackgroundLocationModule.getLocations(
            status.tripId
          );
          setLocations(locs);
        }
      } catch (err) {
        console.error('Error checking tracking status:', err);
      }
    };

    checkStatus();
  }, []);

  /**
   * Auto-start tracking if enabled
   */
  useEffect(() => {
    if (autoStart && !isTracking) {
      startTracking(initialTripId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Start tracking
   */
  const startTracking = useCallback(
    async (customTripId?: string): Promise<string | null> => {
      if (!isNativeModuleAvailable()) {
        const simulatedId = customTripId || `simulator-trip-${Date.now()}`;
        setTripId(simulatedId);
        setIsTracking(true);
        console.warn(
          'BackgroundLocation not available - using simulated trip ID'
        );
        return simulatedId;
      }

      setIsLoading(true);
      clearError();

      try {
        const effectiveTripId =
          await BackgroundLocationModule.startTracking(customTripId);
        setTripId(effectiveTripId);
        setIsTracking(true);
        setLocations([]); // Clear previous locations

        onTrackingStart?.(effectiveTripId);

        return effectiveTripId;
      } catch (err) {
        const trackingError =
          err instanceof Error ? err : new Error('Failed to start tracking');
        setError(trackingError);
        onError?.(trackingError);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [clearError, onTrackingStart, onError]
  );

  /**
   * Stop tracking
   */
  const stopTracking = useCallback(async (): Promise<void> => {
    if (!isNativeModuleAvailable()) {
      setIsTracking(false);
      console.warn('BackgroundLocation not available - simulated stop');
      onTrackingStop?.();
      return;
    }

    setIsLoading(true);
    clearError();

    try {
      await BackgroundLocationModule.stopTracking();
      setIsTracking(false);
      onTrackingStop?.();
    } catch (err) {
      const stopError =
        err instanceof Error ? err : new Error('Failed to stop tracking');
      setError(stopError);
      onError?.(stopError);
      throw stopError;
    } finally {
      setIsLoading(false);
    }
  }, [clearError, onTrackingStop, onError]);

  /**
   * Refresh locations for current trip
   */
  const refreshLocations = useCallback(async (): Promise<void> => {
    if (!tripId) {
      return;
    }

    if (!isNativeModuleAvailable()) {
      console.warn('BackgroundLocation not available');
      return;
    }

    setIsLoading(true);
    clearError();

    try {
      const locs = await BackgroundLocationModule.getLocations(tripId);
      setLocations(locs);
    } catch (err) {
      const locError =
        err instanceof Error ? err : new Error('Failed to get locations');
      setError(locError);
      onError?.(locError);
    } finally {
      setIsLoading(false);
    }
  }, [tripId, clearError, onError]);

  /**
   * Clear all data for current trip
   */
  const clearCurrentTrip = useCallback(async (): Promise<void> => {
    if (!tripId) {
      return;
    }

    if (!isNativeModuleAvailable()) {
      setLocations([]);
      console.warn('BackgroundLocation not available');
      return;
    }

    setIsLoading(true);
    clearError();

    try {
      await BackgroundLocationModule.clearTrip(tripId);
      setLocations([]);
    } catch (err) {
      const tripError =
        err instanceof Error ? err : new Error('Failed to clear trip');
      setError(tripError);
      onError?.(tripError);
    } finally {
      setIsLoading(false);
    }
  }, [tripId, clearError, onError]);

  return {
    tripId,
    isTracking,
    locations,
    isLoading,
    error,
    startTracking,
    stopTracking,
    refreshLocations,
    clearCurrentTrip,
    clearError,
  };
}
