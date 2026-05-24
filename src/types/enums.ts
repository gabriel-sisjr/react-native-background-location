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
