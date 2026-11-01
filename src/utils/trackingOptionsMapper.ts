import type { TrackingOptions } from '../types';
import type { TrackingOptionsSpec } from '../NativeBackgroundLocation';
import { toMotionSpecFields } from './motionOptionsMapper';

/**
 * Converts the public {@link TrackingOptions} (with TypeScript enums and
 * structured `notificationOptions`) to the {@link TrackingOptionsSpec} shape
 * expected by the TurboModule Codegen contract (strings + JSON-stringified
 * notification options).
 *
 * `motionActivity` is flattened into optional `motion*` primitives by
 * {@link toMotionSpecFields}; none of them is present when it is off.
 *
 * @internal
 */
export function toTrackingOptionsSpec(
  options?: TrackingOptions | null
): TrackingOptionsSpec {
  if (!options) {
    return {};
  }

  return {
    updateInterval: options.updateInterval,
    fastestInterval: options.fastestInterval,
    maxWaitTime: options.maxWaitTime,
    accuracy: options.accuracy ? String(options.accuracy) : undefined,
    activityType: options.activityType
      ? String(options.activityType)
      : undefined,
    waitForAccurateLocation: options.waitForAccurateLocation,
    foregroundOnly: options.foregroundOnly,
    distanceFilter: options.distanceFilter,
    notificationOptions: options.notificationOptions
      ? JSON.stringify(options.notificationOptions)
      : undefined,
    ...toMotionSpecFields(options.motionActivity),
  };
}
