/**
 * Notification configuration types for react-native-background-location
 */

import type { NotificationPriority } from './enums';
import type { NotificationAction } from './tracking';

/**
 * Unified notification configuration interface.
 *
 * Used across the entire library for any feature that involves notifications:
 * - Background location tracking (foreground service notification)
 * - Geofencing (transition notifications)
 * - Future notification-producing features
 *
 * For geofencing, the `title` and `text` fields support template variables.
 * See {@link GEOFENCE_TEMPLATE_VARS} for available variables.
 */
export interface NotificationOptions {
  /** Whether notifications are shown (default: true) */
  enabled?: boolean;
  /** Notification title. Supports template variables for geofencing. */
  title?: string;
  /** Notification text. Supports template variables for geofencing. */
  text?: string;
  /** Android notification channel name */
  channelName?: string;
  /** Android notification channel ID */
  channelId?: string;
  /** Notification priority @platform Android */
  priority?: NotificationPriority;
  /** Android drawable resource name for the small icon @platform Android */
  smallIcon?: string;
  /** Android drawable resource name for the large icon @platform Android */
  largeIcon?: string;
  /** Hex color string for notification accent color @platform Android */
  color?: string;
  /** Whether to show timestamp on the notification @platform Android */
  showTimestamp?: boolean;
  /** Subtext displayed below the notification content @platform Android */
  subtext?: string;
  /**
   * Action buttons to display on the notification.
   * Maximum of 3 actions. Additional actions will be ignored.
   *
   * NOTE: Geofence notification action buttons are not yet supported
   * and will be ignored. This field is available for foreground service
   * notifications only. Geofence action support is planned for a future release.
   *
   * @platform Android
   */
  actions?: NotificationAction[];
  /**
   * Per-transition notification overrides.
   *
   * Allows customizing notification content for specific transition types
   * (ENTER, EXIT, DWELL). Fields specified here override the parent
   * `NotificationOptions` for that transition type only. Unspecified fields
   * fall through to the parent config.
   *
   * The `enabled` and `transitionOverrides` fields are excluded from
   * per-transition overrides to prevent recursion and ensure enable/disable
   * is controlled at the geofence or global level only.
   *
   * @example
   * ```typescript
   * const options: NotificationOptions = {
   *   title: 'Geofence Alert',
   *   text: 'Transition detected at {{identifier}}',
   *   transitionOverrides: {
   *     ENTER: {
   *       title: 'Welcome!',
   *       text: 'You entered {{identifier}}',
   *     },
   *     EXIT: {
   *       title: 'Goodbye!',
   *       text: 'You left {{identifier}}',
   *     },
   *     DWELL: {
   *       title: 'Still here',
   *       text: 'Dwelling at {{identifier}} for a while',
   *     },
   *   },
   * };
   * ```
   */
  transitionOverrides?: Partial<
    Record<
      'ENTER' | 'EXIT' | 'DWELL',
      Omit<NotificationOptions, 'transitionOverrides' | 'enabled'>
    >
  >;
}

/**
 * Available template variables for geofence notification title and text fields.
 *
 * Usage: include `{{variableName}}` in your title or text strings.
 * Variables are resolved at notification time on the native side.
 *
 * @example
 * ```typescript
 * import { GEOFENCE_TEMPLATE_VARS } from '@gabriel-sisjr/react-native-background-location';
 * // Use for reference -- autocomplete will show all available variables
 * console.log(GEOFENCE_TEMPLATE_VARS.IDENTIFIER); // '{{identifier}}'
 * ```
 */
export const GEOFENCE_TEMPLATE_VARS = {
  IDENTIFIER: '{{identifier}}',
  TRANSITION_TYPE: '{{transitionType}}',
  LATITUDE: '{{latitude}}',
  LONGITUDE: '{{longitude}}',
  RADIUS: '{{radius}}',
  TIMESTAMP: '{{timestamp}}',
} as const;
