/**
 * Types for the opt-in motion activity feature
 * (`TrackingOptions.motionActivity`).
 */

import type {
  MotionActivityType,
  MotionConfidence,
  MotionDetectionStatus,
  MotionReductionStatus,
} from './enums';

/**
 * Options of the opt-in reduction of location updates while the device is
 * stationary. Durations are in milliseconds. Out-of-range values are clamped
 * to the documented range; malformed values turn the reduction off.
 *
 * The reduction never stops tracking: location updates continue at low
 * accuracy and low frequency, and full accuracy is restored on the first
 * sign of movement, on displacement, or when tracking restarts.
 */
export interface MotionReductionOptions {
  /**
   * Continuous high-confidence STATIONARY time required before location
   * updates are reduced.
   * Clamped to [60000, 3600000].
   * @default 300000 (5 minutes)
   */
  stationaryDelay?: number;

  /**
   * Minimum time since the last vehicle evidence (and since the session
   * started) before location updates are reduced. Prevents reductions at red
   * lights and in stop-and-go traffic.
   * Clamped to [120000, 3600000].
   * @default 600000 (10 minutes)
   */
  automotiveCooldown?: number;

  /**
   * Longest reduced period before one full-accuracy fix is forced and
   * recorded. The reduction then continues if the device has not moved.
   * Clamped to [300000, 3600000].
   * @default 1800000 (30 minutes)
   */
  maxReducedDuration?: number;

  /**
   * Foreground-service notification text shown while updates are reduced.
   * The base text is restored when full accuracy returns. A blank string is
   * ignored.
   * @default 'Location updates reduced while stationary'
   * @platform Android
   */
  notificationText?: string;
}

/**
 * Options of the opt-in motion activity detection.
 *
 * Requires the motion permission (see `requestMotionPermission()`), Google
 * Play services on Android, and on iOS a CoreMotion-enabled build
 * (`$BackgroundLocationMotionActivity = true` in the Podfile, or the
 * `motionActivity` Expo plugin prop) plus `NSMotionUsageDescription` in
 * Info.plist. When a requirement is missing, tracking continues at full
 * accuracy and one `MOTION_*` warning is emitted on `onLocationWarning`.
 */
export interface MotionActivityOptions {
  /**
   * Activity Recognition sampling interval in milliseconds.
   * Ignored on iOS: CoreMotion reports changes as they happen.
   * Clamped to [10000, 300000].
   * @default 30000 (30 seconds)
   * @platform Android
   */
  sampleInterval?: number;

  /**
   * Opt-in reduction (never a stop) of location updates while the device is
   * stationary. `true` uses the defaults of {@link MotionReductionOptions}.
   *
   * It does not apply to `foregroundOnly` trips or to `PASSIVE`/`NO_POWER`
   * accuracy, and it is off when motion detection cannot run.
   * @default undefined (off)
   */
  reduceWhenStationary?: boolean | MotionReductionOptions;
}

/**
 * Motion activity event delivered on `onMotionActivity` while a tracking
 * session with `motionActivity` enabled is active. Consecutive events of a
 * session never repeat the same `activity` and `confidence` pair.
 */
export interface MotionActivityEvent {
  /**
   * Trip identifier of the tracking session
   */
  tripId: string;
  /**
   * Detected activity
   */
  activity: MotionActivityType;
  /**
   * Confidence of the detection
   */
  confidence: MotionConfidence;
  /**
   * Time of the detection in milliseconds since Unix epoch
   */
  timestamp: number;
}

/**
 * Snapshot of the motion activity state, returned by
 * `getMotionActivityState()`.
 *
 * Without an active session the state is
 * `{ tripId: null, detection: OFF, reduction: DISABLED, lastActivity: null }`.
 */
export interface MotionActivityState {
  /**
   * Trip identifier of the active session, or null when there is none
   */
  tripId: string | null;
  /**
   * Motion activity detection status
   */
  detection: MotionDetectionStatus;
  /**
   * Status of the reduction of location updates while stationary
   */
  reduction: MotionReductionStatus;
  /**
   * Most recent motion activity event of the session, if any
   */
  lastActivity: MotionActivityEvent | null;
}

/**
 * Listener passed to `addMotionActivityListener()`.
 */
export type MotionActivityListener = (event: MotionActivityEvent) => void;

/**
 * Subscription returned by `addMotionActivityListener()`.
 */
export interface MotionActivitySubscription {
  /**
   * Stops delivering events to the listener. Safe to call more than once.
   */
  remove(): void;
}

/**
 * Options for the useMotionActivity hook
 */
export interface UseMotionActivityOptions {
  /**
   * Only keep events (and the hydrated state) of this trip.
   * If not provided, every trip is watched.
   */
  tripId?: string;

  /**
   * Callback invoked for every motion activity event kept by the hook
   */
  onMotionActivity?: (event: MotionActivityEvent) => void;
}

/**
 * Result type for the useMotionActivity hook
 */
export interface UseMotionActivityResult {
  /**
   * Most recent motion activity event seen by the hook (from an event or from
   * the hydrated state). It is not cleared when tracking stops; it is reset
   * to `null` when the `tripId` option changes.
   */
  lastActivity: MotionActivityEvent | null;

  /**
   * Motion activity detection status
   */
  detection: MotionDetectionStatus;

  /**
   * Status of the reduction of location updates while stationary
   */
  reduction: MotionReductionStatus;

  /**
   * Re-reads the native state through `getMotionActivityState()`.
   * The hook already does this on mount, when the app returns to the
   * foreground, on every `MOTION_*` warning, and once per trip when an event
   * arrives while the last state read does not show that trip running.
   * Starting and stopping tracking emit no motion warning: call it after
   * `stopTracking()`, and after `startTracking()` for an immediate read.
   */
  refresh: () => Promise<void>;
}
