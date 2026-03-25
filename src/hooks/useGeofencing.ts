import { useState, useCallback, useEffect } from 'react';
import type { GeofenceRegion } from '../types';
import {
  addGeofence as addGeofenceApi,
  addGeofences as addGeofencesApi,
  removeGeofence as removeGeofenceApi,
  removeGeofences as removeGeofencesApi,
  removeAllGeofences as removeAllGeofencesApi,
  getActiveGeofences,
  getMaxGeofences,
} from '../index';

/**
 * Configuration options for the useGeofencing hook
 */
export interface UseGeofencingOptions {
  /** Whether to automatically load geofences on mount (default: true) */
  autoLoad?: boolean;
}

/**
 * Return type for the useGeofencing hook
 */
export interface UseGeofencingReturn {
  /** Currently active geofence regions */
  geofences: GeofenceRegion[];
  /** Whether an async operation is in progress */
  isLoading: boolean;
  /** Last error that occurred, or null */
  error: Error | null;
  /** Register a single geofence region */
  addGeofence: (region: GeofenceRegion) => Promise<void>;
  /** Register multiple geofence regions atomically */
  addGeofences: (regions: GeofenceRegion[]) => Promise<void>;
  /** Remove a single geofence by identifier */
  removeGeofence: (identifier: string) => Promise<void>;
  /** Remove multiple geofences by identifiers */
  removeGeofences: (identifiers: string[]) => Promise<void>;
  /** Remove all registered geofences */
  removeAllGeofences: () => Promise<void>;
  /** Maximum number of geofences supported by the platform, or null if not yet loaded */
  maxGeofences: number | null;
  /** Reload active geofences and platform limit from native */
  refresh: () => Promise<void>;
  /** Clear the current error state */
  clearError: () => void;
}

/**
 * Hook to manage geofence regions (CRUD operations)
 *
 * Provides a complete interface for adding, removing, and querying geofences
 * with automatic state management, error handling, and loading indicators.
 *
 * @param options - Configuration options
 *
 * @example
 * ```tsx
 * function GeofenceScreen() {
 *   const {
 *     geofences,
 *     isLoading,
 *     error,
 *     addGeofence,
 *     removeGeofence,
 *     maxGeofences,
 *   } = useGeofencing();
 *
 *   const handleAdd = async () => {
 *     await addGeofence({
 *       identifier: 'office',
 *       latitude: -23.5505,
 *       longitude: -46.6333,
 *       radius: 200,
 *     });
 *   };
 *
 *   return (
 *     <View>
 *       <Text>Active: {geofences.length} / {maxGeofences}</Text>
 *       <Button onPress={handleAdd}>Add Office Geofence</Button>
 *       {error && <Text>Error: {error.message}</Text>}
 *     </View>
 *   );
 * }
 * ```
 */
export function useGeofencing(
  options: UseGeofencingOptions = {}
): UseGeofencingReturn {
  const { autoLoad = true } = options;

  const [geofences, setGeofences] = useState<GeofenceRegion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [maxGeofences, setMaxGeofences] = useState<number | null>(null);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Load active geofences and platform limit from native
   */
  const refresh = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const [activeGeofences, limit] = await Promise.all([
        getActiveGeofences(),
        getMaxGeofences(),
      ]);
      setGeofences(activeGeofences);
      setMaxGeofences(limit);
    } catch (err) {
      const loadError =
        err instanceof Error ? err : new Error('Failed to load geofences');
      setError(loadError);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Auto-load geofences on mount if enabled
   */
  useEffect(() => {
    if (autoLoad) {
      refresh();
    }
  }, [autoLoad, refresh]);

  /**
   * Register a single geofence region
   */
  const addGeofence = useCallback(
    async (region: GeofenceRegion): Promise<void> => {
      setError(null);

      try {
        await addGeofenceApi(region);
        await refresh();
      } catch (err) {
        const addError =
          err instanceof Error ? err : new Error('Failed to add geofence');
        setError(addError);
        throw addError;
      }
    },
    [refresh]
  );

  /**
   * Register multiple geofence regions atomically
   */
  const addGeofences = useCallback(
    async (regions: GeofenceRegion[]): Promise<void> => {
      setError(null);

      try {
        await addGeofencesApi(regions);
        await refresh();
      } catch (err) {
        const addError =
          err instanceof Error ? err : new Error('Failed to add geofences');
        setError(addError);
        throw addError;
      }
    },
    [refresh]
  );

  /**
   * Remove a single geofence by identifier
   */
  const removeGeofence = useCallback(
    async (identifier: string): Promise<void> => {
      setError(null);

      try {
        await removeGeofenceApi(identifier);
        await refresh();
      } catch (err) {
        const removeError =
          err instanceof Error ? err : new Error('Failed to remove geofence');
        setError(removeError);
        throw removeError;
      }
    },
    [refresh]
  );

  /**
   * Remove multiple geofences by identifiers
   */
  const removeGeofences = useCallback(
    async (identifiers: string[]): Promise<void> => {
      setError(null);

      try {
        await removeGeofencesApi(identifiers);
        await refresh();
      } catch (err) {
        const removeError =
          err instanceof Error ? err : new Error('Failed to remove geofences');
        setError(removeError);
        throw removeError;
      }
    },
    [refresh]
  );

  /**
   * Remove all registered geofences
   */
  const removeAllGeofences = useCallback(async (): Promise<void> => {
    setError(null);

    try {
      await removeAllGeofencesApi();
      await refresh();
    } catch (err) {
      const removeError =
        err instanceof Error
          ? err
          : new Error('Failed to remove all geofences');
      setError(removeError);
      throw removeError;
    }
  }, [refresh]);

  return {
    geofences,
    isLoading,
    error,
    addGeofence,
    addGeofences,
    removeGeofence,
    removeGeofences,
    removeAllGeofences,
    maxGeofences,
    refresh,
    clearError,
  };
}
