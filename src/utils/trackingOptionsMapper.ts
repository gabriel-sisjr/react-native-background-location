import type { TrackingOptions } from '../types';
import type { TrackingOptionsSpec } from '../NativeBackgroundLocation';

/**
 * Converts the public {@link TrackingOptions} (with TypeScript enums and
 * structured `notificationOptions`) to the {@link TrackingOptionsSpec} shape
 * expected by the TurboModule Codegen contract (strings + JSON-stringified
 * notification options).
 *
 * Fields not provided by the caller are left as `undefined` so native
 * platforms can apply their own fallback defaults.
 *
 * @internal
 */
export function toTrackingOptionsSpec(
  options?: TrackingOptions | null
): TrackingOptionsSpec {
  if (!options) {
    return {} as TrackingOptionsSpec;
  }

  if (options.pauseLocationWhenStill && !options.activityTrackingEnabled) {
    console.warn(
      '[react-native-background-location] pauseLocationWhenStill requires activityTrackingEnabled to be true. ' +
        'Without activityTrackingEnabled, pauseLocationWhenStill has no effect.'
    );
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
    activityTrackingEnabled: options.activityTrackingEnabled,
    pauseLocationWhenStill: options.pauseLocationWhenStill,
    activityUpdateInterval: options.activityUpdateInterval,
    notificationOptions: options.notificationOptions
      ? JSON.stringify(options.notificationOptions)
      : undefined,
  };
}
