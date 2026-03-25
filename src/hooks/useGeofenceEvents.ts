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
  // Keep a stable ref for the callback to avoid re-subscribing on every render
  const onTransitionRef = useRef(options?.onTransition);
  onTransitionRef.current = options?.onTransition;

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

        // Apply transition type filter
        if (
          options?.filter &&
          options.filter.length > 0 &&
          !options.filter.includes(transitionEvent.transitionType)
        ) {
          return;
        }

        // Apply geofence identifier filter
        if (
          options?.geofenceId &&
          transitionEvent.geofenceId !== options.geofenceId
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
  }, [options?.filter, options?.geofenceId]);
}
