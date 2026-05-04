/**
 * Types and interfaces for location and notification permissions
 */

import type {
  LocationPermissionStatus,
  NotificationPermissionStatus,
} from './enums';

/**
 * Location permission state with granular status information
 */
export interface LocationPermissionState {
  hasPermission: boolean;
  status: LocationPermissionStatus;
  canRequestAgain: boolean;
}

/**
 * Notification permission state with granular status information
 */
export interface NotificationPermissionState {
  hasPermission: boolean;
  status: NotificationPermissionStatus;
  canRequestAgain: boolean;
}

/**
 * Combined permission state for location and notification permissions
 */
export interface PermissionState {
  hasAllPermissions: boolean;
  location: LocationPermissionState;
  notification: NotificationPermissionState;
}

/**
 * Localized strings shown in an Android system permission dialog
 * (`PermissionsAndroid.request`). Reusable for any of the dialogs the
 * library may surface (background-location today; foreground-location
 * and notification reserved for future releases).
 *
 * Currently only consumed by `RequestPermissionsOptions.backgroundRationale`
 * (Android API 29+). The shape intentionally carries no platform prefix
 * in its name so future sibling fields can share it.
 *
 * All fields are optional. Any field that is omitted, `undefined`, an
 * empty string, or whitespace-only falls back to the library's built-in
 * English default for that field. Each field is resolved independently —
 * passing `{ title: 'Permissão' }` only overrides the title and leaves
 * the message and three button labels at their defaults.
 *
 * @example
 * ```ts
 * const { requestPermissions } = useLocationPermissions();
 *
 * await requestPermissions({
 *   backgroundRationale: {
 *     title: 'Permissão de localização',
 *     message: 'Precisamos da sua localização em segundo plano para registrar suas viagens.',
 *     buttonPositive: 'Permitir',
 *     buttonNegative: 'Cancelar',
 *     buttonNeutral: 'Mais tarde',
 *   },
 * });
 * ```
 */
export interface PermissionRationale {
  /** Dialog title. Defaults to `"Background Location Permission"`. */
  title?: string;

  /**
   * Dialog body explaining why background location is required.
   * Defaults to
   * `"This app needs access to your location in the background to track your trips."`.
   */
  message?: string;

  /** Positive (accept) button label. Defaults to `"OK"`. */
  buttonPositive?: string;

  /** Negative (deny) button label. Defaults to `"Cancel"`. */
  buttonNegative?: string;

  /** Neutral ("ask later") button label. Defaults to `"Ask Me Later"`. */
  buttonNeutral?: string;
}

/**
 * Options accepted by `useLocationPermissions().requestPermissions(...)`.
 *
 * The flat-envelope shape is intentional: future siblings — currently
 * planned `foregroundRationale` (for `PermissionsAndroid.requestMultiple`)
 * and `notificationRationale` (for `POST_NOTIFICATIONS`) — can be added
 * as additional optional fields without a breaking rename. Each field
 * is named after its target dialog so the call site is self-documenting.
 */
export interface RequestPermissionsOptions {
  /**
   * Optional localized copy for the Android background-location rationale
   * dialog (`PermissionsAndroid.request(ACCESS_BACKGROUND_LOCATION, ...)`).
   *
   * @platform Android (API 29+). Silently ignored on iOS, on Android < 29,
   * on the foreground-only flow (`requestMultiple`), and on the
   * notification permission request. See {@link PermissionRationale}.
   */
  backgroundRationale?: PermissionRationale;
}

/**
 * Result type for useLocationPermissions hook
 */
export interface UseLocationPermissionsResult {
  /**
   * Current permission state
   */
  permissionStatus: PermissionState;

  /**
   * Request location and notification permissions for background tracking.
   *
   * Returns `true` if location permissions are granted. Notification
   * permission denial is non-blocking and does **not** affect the return
   * value — inspect `permissionStatus.notification` for that state.
   *
   * @param options Optional configuration.
   * @param options.backgroundRationale Optional localized copy for the
   *   Android background-location rationale dialog (Android API 29+ only).
   *   See {@link PermissionRationale}. Silently ignored on iOS, on Android
   *   < 29, on the foreground-only flow, and on the notification request.
   *   Future releases may add `foregroundRationale` and
   *   `notificationRationale` as sibling options.
   *
   * @example
   * ```ts
   * // Existing zero-arg call — unchanged behavior, English defaults.
   * await requestPermissions();
   *
   * // New: localized strings on Android API 29+.
   * await requestPermissions({
   *   backgroundRationale: {
   *     title: 'Permissão de localização',
   *     message: 'Precisamos da sua localização em segundo plano.',
   *   },
   * });
   * ```
   */
  requestPermissions: (options?: RequestPermissionsOptions) => Promise<boolean>;

  /**
   * Check current permission status without requesting
   */
  checkPermissions: () => Promise<boolean>;

  /**
   * Whether permissions are currently being requested
   */
  isRequesting: boolean;
}
