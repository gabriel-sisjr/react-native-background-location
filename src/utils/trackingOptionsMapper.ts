import type { TrackingOptions } from '../types';
import type { TrackingOptionsSpec } from '../NativeBackgroundLocation';

/**
 * Converts the public {@link TrackingOptions} (with TypeScript enums and
 * structured `notificationOptions`) to the {@link TrackingOptionsSpec} shape
 * expected by the TurboModule Codegen contract (strings + JSON-stringified
 * notification options).
 *
 * Returns `undefined` if no options were provided, so callers can forward the
 * `undefined` value directly to the native module.
 *
 * @internal
 */
export function toTrackingOptionsSpec(
  options: TrackingOptions | undefined
): TrackingOptionsSpec | undefined {
  if (!options) {
    return undefined;
  }

  return {
    updateInterval: options.updateInterval,
    fastestInterval: options.fastestInterval,
    maxWaitTime: options.maxWaitTime,
    accuracy: options.accuracy ? String(options.accuracy) : undefined,
    waitForAccurateLocation: options.waitForAccurateLocation,
    foregroundOnly: options.foregroundOnly,
    distanceFilter: options.distanceFilter,
    notificationOptions: options.notificationOptions
      ? JSON.stringify(options.notificationOptions)
      : undefined,
  };
}
