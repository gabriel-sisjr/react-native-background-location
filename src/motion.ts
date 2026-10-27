import { NativeEventEmitter, PermissionsAndroid, Platform } from 'react-native';
import BackgroundLocationModule from './NativeBackgroundLocation';
import {
  MotionActivityType,
  MotionConfidence,
  MotionDetectionStatus,
  MotionPermissionStatus,
  MotionReductionStatus,
} from './types/enums';
import type {
  MotionActivityEvent,
  MotionActivityListener,
  MotionActivityState,
  MotionActivitySubscription,
} from './types/motion';
import { isNativeModuleAvailable } from './utils';

const NOT_AVAILABLE_MESSAGE =
  'BackgroundLocation not available - running in simulator or module not linked?';

type MotionNativeMethod =
  | 'checkMotionPermission'
  | 'requestMotionPermission'
  | 'getMotionActivityState';

const ACTIVITY_VALUES = Object.values(MotionActivityType);
const CONFIDENCE_VALUES = Object.values(MotionConfidence);
const DETECTION_VALUES = Object.values(MotionDetectionStatus);
const REDUCTION_VALUES = Object.values(MotionReductionStatus);

/**
 * Whether the native module is linked and exposes `method`. A native build
 * older than the JS bundle (for example after an over-the-air JS update) has
 * the module but not the motion methods.
 *
 * @internal Not part of the public API (used by `useMotionActivity`).
 */
export function isMotionMethodAvailable(method: MotionNativeMethod): boolean {
  return (
    isNativeModuleAvailable() &&
    typeof BackgroundLocationModule[method] === 'function'
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === '[object Object]';
}

function isOneOf<T extends string>(
  values: readonly T[],
  value: unknown
): value is T {
  return (
    typeof value === 'string' && (values as readonly string[]).includes(value)
  );
}

/**
 * The state reported when there is no session with motion activity, the
 * native module is missing, or the native state cannot be parsed.
 */
function createOffState(): MotionActivityState {
  return {
    tripId: null,
    detection: MotionDetectionStatus.OFF,
    reduction: MotionReductionStatus.DISABLED,
    lastActivity: null,
  };
}

/**
 * Maps a native permission string to {@link MotionPermissionStatus}.
 * Unknown strings map to `UNAVAILABLE`.
 */
function toMotionPermissionStatus(status: unknown): MotionPermissionStatus {
  switch (status) {
    case 'granted':
      return MotionPermissionStatus.GRANTED;
    case 'denied':
      return MotionPermissionStatus.DENIED;
    case 'undetermined':
      return MotionPermissionStatus.UNDETERMINED;
    default:
      return MotionPermissionStatus.UNAVAILABLE;
  }
}

function toMotionActivityEvent(value: unknown): MotionActivityEvent | null {
  if (!isPlainObject(value)) {
    return null;
  }
  const { tripId, activity, confidence, timestamp } = value;
  if (
    typeof tripId !== 'string' ||
    !isOneOf(ACTIVITY_VALUES, activity) ||
    !isOneOf(CONFIDENCE_VALUES, confidence) ||
    typeof timestamp !== 'number' ||
    !Number.isFinite(timestamp)
  ) {
    return null;
  }
  return { tripId, activity, confidence, timestamp };
}

/**
 * Parses the JSON snapshot returned by the native `getMotionActivityState`.
 * Invalid JSON, a non-object, or an unknown `detection`/`reduction` value
 * gives the OFF state. A malformed `lastActivity` is reported as `null`.
 */
function parseMotionActivityState(json: string): MotionActivityState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return createOffState();
  }
  if (!isPlainObject(parsed)) {
    return createOffState();
  }
  const { tripId, detection, reduction, lastActivity } = parsed;
  if (
    !isOneOf(DETECTION_VALUES, detection) ||
    !isOneOf(REDUCTION_VALUES, reduction)
  ) {
    return createOffState();
  }
  return {
    tripId: typeof tripId === 'string' ? tripId : null,
    detection,
    reduction,
    lastActivity: toMotionActivityEvent(lastActivity),
  };
}

/**
 * Subscribes to `onMotionActivity` events. Events are delivered only while a
 * tracking session with `motionActivity` enabled is active.
 *
 * When the native module is not available, logs a warning and returns a
 * subscription that does nothing.
 *
 * @param listener Called with every motion activity event
 * @returns Subscription whose `remove()` stops the delivery
 *
 * @example
 * ```ts
 * const subscription = addMotionActivityListener((event) => {
 *   console.log(event.activity, event.confidence);
 * });
 * // later
 * subscription.remove();
 * ```
 */
export function addMotionActivityListener(
  listener: MotionActivityListener
): MotionActivitySubscription {
  if (!isNativeModuleAvailable()) {
    console.warn(NOT_AVAILABLE_MESSAGE);
    return {
      remove() {
        // Nothing was subscribed.
      },
    };
  }

  // Pass native module to NativeEventEmitter (required on iOS, optional on Android)
  const eventEmitter = new NativeEventEmitter(BackgroundLocationModule as any);
  const subscription = eventEmitter.addListener(
    'onMotionActivity',
    (event: any) => {
      listener(event as MotionActivityEvent);
    }
  );

  let removed = false;
  return {
    remove() {
      if (removed) {
        return;
      }
      removed = true;
      subscription.remove();
    },
  };
}

/**
 * Checks the motion activity permission without prompting.
 *
 * - Android: `ACTIVITY_RECOGNITION` on API 29+, the install-time Google Play
 *   services permission on API 28 and lower; `UNAVAILABLE` without Google
 *   Play services.
 * - iOS: Motion & Fitness authorization; `UNAVAILABLE` when CoreMotion is not
 *   compiled in, `NSMotionUsageDescription` is missing, or the device does
 *   not support motion activity.
 *
 * Resolves `UNAVAILABLE` (with a warning) when the native module is not
 * available.
 */
export async function checkMotionPermission(): Promise<MotionPermissionStatus> {
  if (!isMotionMethodAvailable('checkMotionPermission')) {
    console.warn(NOT_AVAILABLE_MESSAGE);
    return MotionPermissionStatus.UNAVAILABLE;
  }
  return toMotionPermissionStatus(
    await BackgroundLocationModule.checkMotionPermission()
  );
}

/**
 * Requests the motion activity permission. Call it before `startTracking()`
 * with `motionActivity` enabled: tracking never prompts by itself, and a
 * permission granted mid-trip takes effect at the next tracking start.
 *
 * - Android: returns the current status when it is `GRANTED` or
 *   `UNAVAILABLE`. Otherwise, on API 29+ it shows the system dialog for
 *   `ACTIVITY_RECOGNITION` (`GRANTED` or `DENIED`); on API 28 and lower the
 *   permission is granted at install time, so the current status is returned.
 * - iOS: shows the Motion & Fitness prompt while it is undetermined (the app
 *   must be in the foreground); otherwise returns the current status.
 *
 * Resolves `UNAVAILABLE` (with a warning) when the native module is not
 * available.
 */
export async function requestMotionPermission(): Promise<MotionPermissionStatus> {
  const isAndroid = Platform.OS === 'android';
  if (
    !isMotionMethodAvailable(
      isAndroid ? 'checkMotionPermission' : 'requestMotionPermission'
    )
  ) {
    console.warn(NOT_AVAILABLE_MESSAGE);
    return MotionPermissionStatus.UNAVAILABLE;
  }

  if (!isAndroid) {
    return toMotionPermissionStatus(
      await BackgroundLocationModule.requestMotionPermission()
    );
  }

  // Android: the native module never prompts; the runtime request goes
  // through PermissionsAndroid.
  const current = toMotionPermissionStatus(
    await BackgroundLocationModule.checkMotionPermission()
  );
  if (
    current === MotionPermissionStatus.GRANTED ||
    current === MotionPermissionStatus.UNAVAILABLE ||
    Number(Platform.Version) < 29
  ) {
    return current;
  }
  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION
  );
  return result === PermissionsAndroid.RESULTS.GRANTED
    ? MotionPermissionStatus.GRANTED
    : MotionPermissionStatus.DENIED;
}

/**
 * Returns the motion activity state of the current tracking session.
 *
 * Resolves the OFF state
 * (`{ tripId: null, detection: OFF, reduction: DISABLED, lastActivity: null }`)
 * when there is no session, when the native state cannot be parsed, or (with
 * a warning) when the native module is not available.
 */
export async function getMotionActivityState(): Promise<MotionActivityState> {
  if (!isMotionMethodAvailable('getMotionActivityState')) {
    console.warn(NOT_AVAILABLE_MESSAGE);
    return createOffState();
  }
  return parseMotionActivityState(
    await BackgroundLocationModule.getMotionActivityState()
  );
}
