import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { AppState, NativeEventEmitter } from 'react-native';
import BackgroundLocationModule from '../NativeBackgroundLocation';
import {
  addMotionActivityListener,
  getMotionActivityState,
  isMotionMethodAvailable,
} from '../motion';
import { MotionDetectionStatus, MotionReductionStatus } from '../types';
import type {
  LocationWarningEvent,
  LocationWarningType,
  MotionActivityEvent,
  MotionActivityState,
  UseMotionActivityOptions,
  UseMotionActivityResult,
} from '../types';
import { isNativeModuleAvailable } from '../utils';

/**
 * Warnings that change the motion activity state, so each one triggers a
 * refresh.
 */
const MOTION_WARNING_TYPES: ReadonlySet<LocationWarningType> =
  new Set<LocationWarningType>([
    'MOTION_LOCATION_REDUCED',
    'MOTION_LOCATION_RESTORED',
    'MOTION_ACTIVITY_UNAVAILABLE',
    'MOTION_PERMISSION_NOT_GRANTED',
  ]);

/**
 * Logged when the native build does not include motion activity.
 */
const NATIVE_BUILD_MESSAGE =
  '[BackgroundLocation] motion activity is not available in this native build; rebuild the app to use it.';

/**
 * Whether {@link NATIVE_BUILD_MESSAGE} was logged. Intentionally
 * module-scoped for once-per-JS-session behavior.
 */
let hasLoggedNativeBuildMessage = false;

/**
 * Whether the hook may refresh by itself (on mount, on foreground, on events
 * and on warnings). Without the native module it stays silent. A native build
 * older than the JS bundle (for example after an over-the-air JS update) has
 * the module but not `getMotionActivityState`: the message is logged once
 * per JS session and the refresh is skipped.
 */
function canRefreshAutomatically(): boolean {
  if (!isNativeModuleAvailable()) {
    return false;
  }
  if (isMotionMethodAvailable('getMotionActivityState')) {
    return true;
  }
  if (!hasLoggedNativeBuildMessage) {
    hasLoggedNativeBuildMessage = true;
    console.warn(NATIVE_BUILD_MESSAGE);
  }
  return false;
}

/**
 * Hook to observe motion activity events and the motion activity state of
 * the current tracking session (enabled with `TrackingOptions.motionActivity`).
 *
 * - Hydrates through `getMotionActivityState()` on mount, when `tripId`
 *   changes, every time the app becomes active, on every `MOTION_*` warning,
 *   and once per trip when an event arrives while the last state read does
 *   not show that trip running (for example right after a start).
 * - Starting and stopping tracking emit no motion warning: call `refresh()`
 *   after `stopTracking()`, and after `startTracking()` for an immediate read.
 * - Keeps `onMotionActivity` events of the watched trip (all trips when
 *   `tripId` is omitted) in `lastActivity` and forwards them to the callback.
 * - When `tripId` is given and the active session belongs to another trip,
 *   reports `detection: OFF` and `reduction: DISABLED`.
 *
 * Read-only: it never starts motion detection or prompts for a permission,
 * so it has no effect when the feature is off. When the native module is not
 * available it returns the defaults and subscribes to nothing. When the
 * native build predates motion activity, it logs one message per JS session
 * and skips its automatic refreshes (a manual `refresh()` still runs).
 *
 * @param options - Optional trip filter and event callback
 *
 * @example
 * ```tsx
 * function MotionStatus({ tripId }: { tripId: string }) {
 *   const { lastActivity, detection, reduction } = useMotionActivity({
 *     tripId,
 *     onMotionActivity: (event) => console.log(event.activity),
 *   });
 *
 *   return (
 *     <Text>
 *       {detection} / {reduction} / {lastActivity?.activity ?? 'none'}
 *     </Text>
 *   );
 * }
 * ```
 */
export function useMotionActivity(
  options: UseMotionActivityOptions = {}
): UseMotionActivityResult {
  const { tripId, onMotionActivity } = options;

  const [lastActivity, setLastActivity] = useState<MotionActivityEvent | null>(
    null
  );
  const [detection, setDetection] = useState<MotionDetectionStatus>(
    MotionDetectionStatus.OFF
  );
  const [reduction, setReduction] = useState<MotionReductionStatus>(
    MotionReductionStatus.DISABLED
  );

  // Latest values read by stable callbacks, so subscriptions are created once.
  const tripIdRef = useRef(tripId);
  tripIdRef.current = tripId;

  const onMotionActivityRef = useRef(onMotionActivity);
  onMotionActivityRef.current = onMotionActivity;

  // Only the most recent refresh may update the state.
  const refreshIdRef = useRef(0);
  const hydratedTripIdRef = useRef(tripId);

  // Native session seen by the last applied refresh, before the trip filter.
  const appliedSessionRef = useRef<
    Pick<MotionActivityState, 'tripId' | 'detection'>
  >({ tripId: null, detection: MotionDetectionStatus.OFF });

  /**
   * Re-read the native motion activity state
   */
  const refresh = useCallback(async (): Promise<void> => {
    refreshIdRef.current += 1;
    const refreshId = refreshIdRef.current;
    try {
      const state = await getMotionActivityState();
      if (refreshId !== refreshIdRef.current) {
        return;
      }
      appliedSessionRef.current = {
        tripId: state.tripId,
        detection: state.detection,
      };

      const watchedTripId = tripIdRef.current;
      const isWatchedSession = !watchedTripId || state.tripId === watchedTripId;
      setDetection(
        isWatchedSession ? state.detection : MotionDetectionStatus.OFF
      );
      setReduction(
        isWatchedSession ? state.reduction : MotionReductionStatus.DISABLED
      );

      const hydratedActivity = state.lastActivity;
      if (
        hydratedActivity &&
        (!watchedTripId || hydratedActivity.tripId === watchedTripId)
      ) {
        // Never replace a newer event received while the request was in flight.
        setLastActivity((previous) =>
          previous && previous.timestamp > hydratedActivity.timestamp
            ? previous
            : hydratedActivity
        );
      }
    } catch (err) {
      console.error('Error refreshing motion activity state:', err);
    }
  }, []);

  /**
   * Refresh started by the hook itself, skipped when the native build
   * cannot read the motion state
   */
  const refreshAutomatically = useCallback((): void => {
    if (canRefreshAutomatically()) {
      refresh();
    }
  }, [refresh]);

  /**
   * Hydrate on mount and whenever the watched trip changes
   */
  useEffect(() => {
    if (hydratedTripIdRef.current !== tripId) {
      hydratedTripIdRef.current = tripId;
      setLastActivity(null);
    }
    refreshAutomatically();
  }, [tripId, refreshAutomatically]);

  /**
   * Listen for motion activity events, motion warnings and foreground resumes
   */
  useEffect(() => {
    if (!isNativeModuleAvailable()) {
      return;
    }

    // Trip whose event last triggered a refresh: at most one per trip.
    let eventRefreshTripId: string | null = null;

    const motionSubscription = addMotionActivityListener((event) => {
      const watchedTripId = tripIdRef.current;
      if (watchedTripId && event.tripId !== watchedTripId) {
        return;
      }
      setLastActivity(event);

      // Events flow only while detection runs. When the last applied state
      // does not show this trip running (for example right after a start),
      // re-read it once for the trip.
      const appliedSession = appliedSessionRef.current;
      if (
        eventRefreshTripId !== event.tripId &&
        (appliedSession.detection !== MotionDetectionStatus.RUNNING ||
          appliedSession.tripId !== event.tripId)
      ) {
        eventRefreshTripId = event.tripId;
        refreshAutomatically();
      }

      onMotionActivityRef.current?.(event);
    });

    // Pass native module to NativeEventEmitter (required on iOS, optional on Android)
    const eventEmitter = new NativeEventEmitter(
      BackgroundLocationModule as any
    );
    const warningSubscription = eventEmitter.addListener(
      'onLocationWarning',
      (event: any) => {
        const warningEvent = event as LocationWarningEvent;
        if (MOTION_WARNING_TYPES.has(warningEvent.type)) {
          refreshAutomatically();
        }
      }
    );

    const appStateSubscription = AppState.addEventListener(
      'change',
      (nextAppState) => {
        if (nextAppState === 'active') {
          refreshAutomatically();
        }
      }
    );

    return () => {
      motionSubscription.remove();
      warningSubscription.remove();
      appStateSubscription.remove();
    };
  }, [refreshAutomatically]);

  return useMemo(
    () => ({
      lastActivity,
      detection,
      reduction,
      refresh,
    }),
    [lastActivity, detection, reduction, refresh]
  );
}
