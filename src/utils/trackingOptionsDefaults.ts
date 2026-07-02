/**
 * Single source of truth for all tracking option defaults.
 *
 * EVERY new tracking option MUST be added here.
 * Native platforms (Android / iOS) keep backup defaults for recovery paths
 * but should reference this file as the authoritative source.
 *
 * Values here are in the final `TrackingOptionsSpec` format
 * (strings for enums, primitives for everything else) so the
 * mapping function can apply them directly.
 *
 * @internal
 */
export const TRACKING_OPTIONS_DEFAULTS = {
  updateInterval: 5000,
  fastestInterval: 3000,
  maxWaitTime: 10000,
  accuracy: 'HIGH_ACCURACY',
  activityType: 'OTHER',
  waitForAccurateLocation: false,
  foregroundOnly: false,
  distanceFilter: 0,
  activityTrackingEnabled: false,
  pauseLocationWhenStill: false,
  activityUpdateInterval: 60000,
} as const;
