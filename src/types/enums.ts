/**
 * Enums for react-native-background-location
 */

/**
 * Location permission status
 */
export enum LocationPermissionStatus {
  GRANTED = 'granted',
  WHEN_IN_USE = 'whenInUse',
  DENIED = 'denied',
  BLOCKED = 'blocked',
  UNDETERMINED = 'undetermined',
}

/**
 * Location accuracy priority levels
 */
export enum LocationAccuracy {
  /**
   * Highest accuracy - uses GPS and other sensors
   * Best for navigation and precise tracking
   * Higher battery consumption
   */
  HIGH_ACCURACY = 'HIGH_ACCURACY',

  /**
   * Balanced accuracy and power consumption
   * Good for most tracking use cases
   */
  BALANCED_POWER_ACCURACY = 'BALANCED_POWER_ACCURACY',

  /**
   * Low power consumption
   * Uses network-based location
   * Lower accuracy
   */
  LOW_POWER = 'LOW_POWER',

  /**
   * No power consumption
   * Only receives location updates when other apps request them
   * Very low accuracy
   */
  NO_POWER = 'NO_POWER',

  /**
   * Passive location updates
   * Receives location updates from other apps
   * No additional power consumption
   */
  PASSIVE = 'PASSIVE',
}

/**
 * Notification priority levels for Android
 */
export enum NotificationPriority {
  /**
   * Low priority - minimal notification
   */
  LOW = 'LOW',

  /**
   * Default priority
   */
  DEFAULT = 'DEFAULT',

  /**
   * High priority - more prominent notification
   */
  HIGH = 'HIGH',

  /**
   * Maximum priority - urgent notification
   */
  MAX = 'MAX',
}

/**
 * Notification permission status
 */
export enum NotificationPermissionStatus {
  GRANTED = 'granted',
  DENIED = 'denied',
  UNDETERMINED = 'undetermined',
}

/**
 * iOS activity type hint passed to `CLLocationManager.activityType`.
 * Influences iOS's motion-classification subsystem and decisions about
 * when to auto-pause location updates to save battery.
 *
 * @default LocationActivityType.OTHER
 * @platform iOS
 */
export enum LocationActivityType {
  /** Default. General-purpose tracking, no motion-classification bias. Maps to `CLActivityType.other`. */
  OTHER = 'OTHER',
  /** Vehicle navigation (turn-by-turn). Maps to `CLActivityType.automotiveNavigation`. */
  AUTOMOTIVE_NAVIGATION = 'AUTOMOTIVE_NAVIGATION',
  /** Foot-based activity (walking, running, cycling). Maps to `CLActivityType.fitness`. */
  FITNESS = 'FITNESS',
  /** Non-vehicle navigation (trains, boats). Maps to `CLActivityType.otherNavigation`. */
  OTHER_NAVIGATION = 'OTHER_NAVIGATION',
  /** Aerial activity. Maps to `CLActivityType.airborne` (iOS 12+). */
  AIRBORNE = 'AIRBORNE',
}

/**
 * Motion activity detected by the opt-in motion activity feature
 * (`TrackingOptions.motionActivity`), normalized across platforms.
 *
 * Android uses the Activity Recognition API (Google Play services); iOS uses
 * CoreMotion (`CMMotionActivityManager`). Unrelated to
 * {@link LocationActivityType}, which is only a hint for `CLLocationManager`.
 */
export enum MotionActivityType {
  /** The device is not moving (Android `STILL`, iOS `stationary`). */
  STATIONARY = 'STATIONARY',
  /** Walking (Android `WALKING` or `ON_FOOT`, iOS `walking`). */
  WALKING = 'WALKING',
  /** Running (Android `RUNNING`, or `ON_FOOT` when running is more probable, iOS `running`). */
  RUNNING = 'RUNNING',
  /** Cycling (Android `ON_BICYCLE`, iOS `cycling`). */
  CYCLING = 'CYCLING',
  /** In a vehicle (Android `IN_VEHICLE`, iOS `automotive`). */
  AUTOMOTIVE = 'AUTOMOTIVE',
  /** The activity cannot be determined (Android `UNKNOWN`/`TILTING`, iOS `unknown`). */
  UNKNOWN = 'UNKNOWN',
}

/**
 * Confidence of a {@link MotionActivityType} classification.
 *
 * Android buckets the 0-100 confidence of the most probable activity
 * (>= 75 HIGH, 50-74 MEDIUM, < 50 LOW) and reports activity transitions as
 * HIGH. iOS maps `CMMotionActivityConfidence` directly.
 */
export enum MotionConfidence {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

/**
 * Motion activity permission status (Android `ACTIVITY_RECOGNITION`, iOS
 * Motion & Fitness).
 */
export enum MotionPermissionStatus {
  /** The permission is granted. */
  GRANTED = 'granted',
  /** The permission is denied (or restricted on iOS). */
  DENIED = 'denied',
  /** iOS only: the user has not been asked yet. */
  UNDETERMINED = 'undetermined',
  /**
   * Motion activity cannot run on this device or build: Google Play services
   * is missing (Android); CoreMotion is not compiled in, the
   * `NSMotionUsageDescription` key is missing or the hardware does not
   * support it (iOS); or the native module is not available.
   */
  UNAVAILABLE = 'unavailable',
}

/**
 * State of motion activity detection for the current tracking session.
 */
export enum MotionDetectionStatus {
  /** No session, or the session did not enable `motionActivity`. */
  OFF = 'OFF',
  /** Motion activity events are being delivered. */
  RUNNING = 'RUNNING',
  /** Motion activity could not start or was lost (see the `MOTION_ACTIVITY_UNAVAILABLE` warning). */
  UNAVAILABLE = 'UNAVAILABLE',
  /** The motion permission is missing or was revoked (see the `MOTION_PERMISSION_NOT_GRANTED` warning). */
  PERMISSION_NOT_GRANTED = 'PERMISSION_NOT_GRANTED',
}

/**
 * State of the opt-in reduction of location updates while stationary
 * (`MotionActivityOptions.reduceWhenStationary`).
 */
export enum MotionReductionStatus {
  /** Reduction was not requested, or there is no session. */
  DISABLED = 'DISABLED',
  /** Reduction was requested but does not apply: the trip is `foregroundOnly` or uses `PASSIVE`/`NO_POWER` accuracy. */
  NOT_APPLICABLE = 'NOT_APPLICABLE',
  /** Reduction was requested but motion detection did not start or was lost. */
  UNAVAILABLE = 'UNAVAILABLE',
  /** Full-accuracy updates; waiting for a sustained stationary period. */
  MONITORING = 'MONITORING',
  /** Location updates are reduced while the device is stationary. */
  REDUCED = 'REDUCED',
}
