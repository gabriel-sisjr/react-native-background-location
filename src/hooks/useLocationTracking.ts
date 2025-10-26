import { useState, useEffect, useCallback } from 'react';
import BackgroundLocationModule from '../NativeBackgroundLocation';
import type { TrackingStatus } from '../types';
import { Platform, NativeModules } from 'react-native';

// Check if native module is available
const isNativeModuleAvailable = () => {
  const nativeModule =
    Platform.OS === 'android' ? NativeModules.BackgroundLocation : null;
  return !!nativeModule;
};

export interface UseLocationTrackingResult {
  /**
   * Whether location tracking is currently active
   */
  isTracking: boolean;

  /**
   * Current trip ID if tracking is active
   */
  tripId: string | null;

  /**
   * Refresh tracking status
   */
  refresh: () => Promise<void>;

  /**
   * Whether status is being checked
   */
  isLoading: boolean;
}

/**
 * Hook to observe location tracking status
 *
 * Lightweight hook that only monitors if tracking is active.
 * Use this when you don't need full tracking management.
 *
 * @param autoRefresh - Whether to automatically check status on mount
 *
 * @example
 * ```tsx
 * function StatusBadge() {
 *   const { isTracking, tripId } = useLocationTracking();
 *
 *   return (
 *     <View>
 *       <Text>Status: {isTracking ? 'Tracking' : 'Stopped'}</Text>
 *       {tripId && <Text>Trip: {tripId}</Text>}
 *     </View>
 *   );
 * }
 * ```
 */
export function useLocationTracking(
  autoRefresh = true
): UseLocationTrackingResult {
  const [status, setStatus] = useState<TrackingStatus>({
    active: false,
    tripId: undefined,
  });
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Check current tracking status
   */
  const refresh = useCallback(async (): Promise<void> => {
    if (!isNativeModuleAvailable()) {
      console.warn(
        'BackgroundLocation not available - running in simulator or module not linked?'
      );
      return;
    }

    setIsLoading(true);

    try {
      const trackingStatus = await BackgroundLocationModule.isTracking();
      setStatus(trackingStatus);
    } catch (error) {
      console.error('Error checking tracking status:', error);
      setStatus({ active: false, tripId: undefined });
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Check status on mount if autoRefresh is enabled
   */
  useEffect(() => {
    if (autoRefresh) {
      refresh();
    }
  }, [autoRefresh, refresh]);

  return {
    isTracking: status.active,
    tripId: status.tripId || null,
    refresh,
    isLoading,
  };
}
