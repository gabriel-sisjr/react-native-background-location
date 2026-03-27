import { useEffect, useRef } from 'react';
import { NativeEventEmitter } from 'react-native';
import BackgroundLocationModule from '../NativeBackgroundLocation';
import type { GeofenceTransitionEvent, GeofenceTransitionType } from '../types';

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
 * Configuration options for the useGeofenceEvents hook
 */
export interface UseGeofenceEventsOptions {
  /** Callback invoked when a geofence transition is detected (after filters are applied) */
  onTransition?: (event: GeofenceTransitionEvent) => void;
  /** Only emit events matching these transition types. If omitted, all transitions are emitted. */
  filter?: GeofenceTransitionType[];
  /** Only emit events for this specific geofence identifier. If omitted, all geofences are emitted. */
  geofenceId?: string;
}

/**
 * Hook to listen for geofence transition events in real-time
 *
 * Subscribes to native geofence transition events via NativeEventEmitter
 * and applies optional filters before invoking the callback.
 *
 * @param options - Configuration options with callback and optional filters
 *
 * @example
 * ```tsx
 * function GeofenceMonitor() {
 *   useGeofenceEvents({
 *     onTransition: (event) => {
 *       console.log(`${event.transitionType} geofence ${event.geofenceId}`);
 *     },
 *     filter: [GeofenceTransitionType.ENTER, GeofenceTransitionType.EXIT],
 *   });
 *
 *   return <Text>Monitoring geofence transitions...</Text>;
 * }
 *
 * @example
 * // Filter by specific geofence
 * useGeofenceEvents({
 *   onTransition: (event) => {
 *     console.log('Office transition:', event.transitionType);
 *   },
 *   geofenceId: 'office-hq',
 * });
 * ```
 */
export function useGeofenceEvents(options?: UseGeofenceEventsOptions): void {
  // Keep stable refs to avoid re-subscribing on every render.
  // The effect subscribes once on mount; the handler always reads current
  // values from refs so inline arrays / new callback instances are safe.
  const onTransitionRef = useRef(options?.onTransition);
  onTransitionRef.current = options?.onTransition;

  const filterRef = useRef(options?.filter);
  filterRef.current = options?.filter;

  const geofenceIdRef = useRef(options?.geofenceId);
  geofenceIdRef.current = options?.geofenceId;

  useEffect(() => {
    if (!isNativeModuleAvailable()) {
      return;
    }

    // Pass native module to NativeEventEmitter (required on iOS, optional on Android)
    const eventEmitter = new NativeEventEmitter(
      BackgroundLocationModule as any
    );

    const subscription = eventEmitter.addListener(
      'onGeofenceTransition',
      (event: any) => {
        const transitionEvent = event as GeofenceTransitionEvent;

        // Read current values from refs to avoid stale closures
        const currentFilter = filterRef.current;
        const currentGeofenceId = geofenceIdRef.current;

        // Apply transition type filter
        if (
          currentFilter &&
          currentFilter.length > 0 &&
          !currentFilter.includes(transitionEvent.transitionType)
        ) {
          return;
        }

        // Apply geofence identifier filter
        if (
          currentGeofenceId &&
          transitionEvent.geofenceId !== currentGeofenceId
        ) {
          return;
        }

        // Invoke callback via ref to avoid stale closures
        onTransitionRef.current?.(transitionEvent);
      }
    );

    return () => {
      subscription.remove();
    };
    // Subscribe once on mount. Filter, geofenceId, and onTransition are
    // accessed via refs so the handler always sees the latest values
    // without needing to re-subscribe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
