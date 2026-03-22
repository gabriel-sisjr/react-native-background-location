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
