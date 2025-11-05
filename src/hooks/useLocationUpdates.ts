import { useState, useEffect, useCallback, useRef } from 'react';
import { NativeEventEmitter } from 'react-native';
import BackgroundLocationModule from '../NativeBackgroundLocation';
import type {
  UseLocationUpdatesOptions,
  UseLocationUpdatesResult,
  Coords,
  LocationUpdateEvent,
} from '../types';

// Check if native module is available
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
 * Hook to watch location updates in real-time
 *
 * This hook automatically listens for location updates from the background service
 * and provides them as they arrive, without requiring manual refresh.
 *
 * @param options - Configuration options
 *
 * @example
 * ```tsx
 * function LiveTrackingMap() {
 *   const {
 *     locations,
 *     lastLocation,
 *     isTracking
 *   } = useLocationUpdates({
 *     onLocationUpdate: (location) => {
 *       console.log('New location:', location);
 *     },
 *   });
 *
 *   return (
 *     <View>
 *       <Text>Tracking: {isTracking ? 'Active' : 'Inactive'}</Text>
 *       <Text>Locations collected: {locations.length}</Text>
 *       {lastLocation && (
 *         <Text>
 *           Last: {lastLocation.latitude}, {lastLocation.longitude}
 *         </Text>
 *       )}
 *     </View>
 *   );
 * }
 * ```
 */
export function useLocationUpdates(
  options: UseLocationUpdatesOptions = {}
): UseLocationUpdatesResult {
  const { tripId: providedTripId, onLocationUpdate, autoLoad = true } = options;

  const [tripId, setTripId] = useState<string | null>(providedTripId || null);
  const [isTracking, setIsTracking] = useState(false);
  const [locations, setLocations] = useState<Coords[]>([]);
  const [lastLocation, setLastLocation] = useState<Coords | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const wasClearedRef = useRef(false);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Clear all locations for current trip
   */
  const clearLocations = useCallback(async (): Promise<void> => {
    if (!tripId) {
      return;
    }

    if (!isNativeModuleAvailable()) {
      setLocations([]);
      setLastLocation(null);
      wasClearedRef.current = true;
      console.warn('BackgroundLocation not available');
      return;
    }

    setIsLoading(true);
    clearError();

    try {
      await BackgroundLocationModule.clearTrip(tripId);
      setLocations([]);
      setLastLocation(null);
      wasClearedRef.current = true;
    } catch (err) {
      const clearError_instance =
        err instanceof Error ? err : new Error('Failed to clear locations');
      setError(clearError_instance);
      console.error('Error clearing locations:', clearError_instance);
    } finally {
      setIsLoading(false);
    }
  }, [tripId, clearError]);

  /**
   * Load existing locations for a trip
   */
  const loadExistingLocations = useCallback(
    async (loadTripId: string) => {
      if (!isNativeModuleAvailable()) {
        return;
      }

      setIsLoading(true);
      clearError();

      try {
        const locs = await BackgroundLocationModule.getLocations(loadTripId);
        setLocations(locs);
        if (locs.length > 0) {
          const lastLoc = locs[locs.length - 1];
          if (lastLoc) {
            setLastLocation(lastLoc);
          }
        }
      } catch (err) {
        const loadError =
          err instanceof Error
            ? err
            : new Error('Failed to load existing locations');
        setError(loadError);
        console.error('Error loading locations:', loadError);
      } finally {
        setIsLoading(false);
      }
    },
    [clearError]
  );

  /**
   * Check tracking status and setup initial state
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

        // If we have a provided tripId, use it; otherwise use the active one
        const effectiveTripId = providedTripId || status.tripId;

        if (effectiveTripId) {
          setTripId(effectiveTripId);

          // Load existing locations if autoLoad is enabled and wasn't recently cleared
          if (autoLoad && !wasClearedRef.current) {
            await loadExistingLocations(effectiveTripId);
          } else if (wasClearedRef.current) {
            // Reset the cleared flag after a delay to allow reloading on next check
            setTimeout(() => {
              wasClearedRef.current = false;
            }, 2000);
          }
        }
      } catch (err) {
        console.error('Error checking tracking status:', err);
      }
    };

    checkStatus();

    // Re-check status periodically (every 5 seconds) to catch tracking changes
    const interval = setInterval(() => {
      checkStatus();
    }, 5000);

    return () => {
      clearInterval(interval);
    };
  }, [providedTripId, autoLoad, loadExistingLocations]);

  /**
   * Listen for location update events
   */
  useEffect(() => {
    if (!isNativeModuleAvailable()) {
      return;
    }

    // Create event emitter without passing the module (for TurboModule compatibility)
    // The native module emits events via DeviceEventManagerModule
    const eventEmitter = new NativeEventEmitter();

    const subscription = eventEmitter.addListener(
      'onLocationUpdate',
      (event: any) => {
        const locationEvent = event as LocationUpdateEvent;

        // Only process events for the trip we're watching (or all if no specific trip)
        if (!tripId || locationEvent.tripId === tripId) {
          const newLocation: Coords = {
            latitude: locationEvent.latitude,
            longitude: locationEvent.longitude,
            timestamp: locationEvent.timestamp,
          };

          // Update trip ID if we weren't watching a specific one
          if (!tripId && locationEvent.tripId) {
            setTripId(locationEvent.tripId);
            setIsTracking(true);
          }

          // If locations were cleared, start fresh (don't append to empty array)
          // Otherwise, add to existing locations array
          setLocations((prev) => {
            // If was cleared, start fresh with just the new location
            // Otherwise, append to existing array
            if (wasClearedRef.current && prev.length === 0) {
              wasClearedRef.current = false; // Reset cleared flag when new location arrives
              return [newLocation];
            }
            return [...prev, newLocation];
          });
          setLastLocation(newLocation);

          // Call callback if provided
          onLocationUpdate?.(newLocation);
        }
      }
    );

    return () => {
      subscription.remove();
    };
  }, [tripId, onLocationUpdate]);

  /**
   * Reset state when trip changes
   */
  useEffect(() => {
    if (providedTripId && providedTripId !== tripId) {
      setTripId(providedTripId);
      setLocations([]);
      setLastLocation(null);
      if (autoLoad) {
        loadExistingLocations(providedTripId);
      }
    }
  }, [providedTripId, tripId, autoLoad, loadExistingLocations]);

  return {
    tripId,
    isTracking,
    locations,
    lastLocation,
    isLoading,
    error,
    clearError,
    clearLocations,
  };
}
