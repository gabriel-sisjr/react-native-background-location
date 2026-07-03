import type { TrackingOptions } from '../types';
import type { TrackingOptionsSpec } from '../NativeBackgroundLocation';
import { TRACKING_OPTIONS_DEFAULTS } from './trackingOptionsDefaults';

/**
 * Converts the public {@link TrackingOptions} (with TypeScript enums and
 * structured `notificationOptions`) to the {@link TrackingOptionsSpec} shape
 * expected by the TurboModule Codegen contract (strings + JSON-stringified
 * notification options).
 *
 * Every undefined/null field is filled with its default from
 * {@link TRACKING_OPTIONS_DEFAULTS} so native platforms always receive
 * every option with an explicit value.
 *
 * @internal
 */
export function toTrackingOptionsSpec(
  options?: TrackingOptions | null
): TrackingOptionsSpec {
  if (!options) {
    return {
      updateInterval: TRACKING_OPTIONS_DEFAULTS.updateInterval,
      fastestInterval: TRACKING_OPTIONS_DEFAULTS.fastestInterval,
      maxWaitTime: TRACKING_OPTIONS_DEFAULTS.maxWaitTime,
      accuracy: TRACKING_OPTIONS_DEFAULTS.accuracy,
      activityType: TRACKING_OPTIONS_DEFAULTS.activityType,
      waitForAccurateLocation: TRACKING_OPTIONS_DEFAULTS.waitForAccurateLocation,
      foregroundOnly: TRACKING_OPTIONS_DEFAULTS.foregroundOnly,
      distanceFilter: TRACKING_OPTIONS_DEFAULTS.distanceFilter,
      activityTrackingEnabled: TRACKING_OPTIONS_DEFAULTS.activityTrackingEnabled,
      pauseLocationWhenStill: TRACKING_OPTIONS_DEFAULTS.pauseLocationWhenStill,
      activityUpdateInterval: TRACKING_OPTIONS_DEFAULTS.activityUpdateInterval,
    };
  }

  if (options.pauseLocationWhenStill && !options.activityTrackingEnabled) {
    console.warn(
      '[react-native-background-location] pauseLocationWhenStill requires activityTrackingEnabled to be true. ' +
      'Without activityTrackingEnabled, pauseLocationWhenStill has no effect.'
    );
  }

  return {
    updateInterval:
      options.updateInterval ?? TRACKING_OPTIONS_DEFAULTS.updateInterval,
    fastestInterval:
      options.fastestInterval ?? TRACKING_OPTIONS_DEFAULTS.fastestInterval,
    maxWaitTime: options.maxWaitTime ?? TRACKING_OPTIONS_DEFAULTS.maxWaitTime,
    accuracy: options.accuracy
      ? String(options.accuracy)
      : TRACKING_OPTIONS_DEFAULTS.accuracy,
    activityType: options.activityType
      ? String(options.activityType)
      : TRACKING_OPTIONS_DEFAULTS.activityType,
    waitForAccurateLocation:
      options.waitForAccurateLocation ??
      TRACKING_OPTIONS_DEFAULTS.waitForAccurateLocation,
    foregroundOnly:
      options.foregroundOnly ?? TRACKING_OPTIONS_DEFAULTS.foregroundOnly,
    distanceFilter:
      options.distanceFilter ?? TRACKING_OPTIONS_DEFAULTS.distanceFilter,
    activityTrackingEnabled:
      options.activityTrackingEnabled ??
      TRACKING_OPTIONS_DEFAULTS.activityTrackingEnabled,
    pauseLocationWhenStill:
      options.pauseLocationWhenStill ??
      TRACKING_OPTIONS_DEFAULTS.pauseLocationWhenStill,
    activityUpdateInterval:
      options.activityUpdateInterval ??
      TRACKING_OPTIONS_DEFAULTS.activityUpdateInterval,
    notificationOptions: options.notificationOptions
      ? JSON.stringify(options.notificationOptions)
      : undefined,
  };
}
