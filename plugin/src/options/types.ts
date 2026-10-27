/**
 * Options of the `motionActivity` plugin prop.
 *
 * All fields are optional: `{}` opts in with the library defaults.
 */
export interface MotionActivityPluginProps {
  /**
   * iOS `NSMotionUsageDescription`, shown in the Motion & Fitness permission
   * prompt. Resolved as `usageDescription` → the value already in the
   * project's `Info.plist` (for example from `ios.infoPlist`) → a generic
   * library default mentioning `$(PRODUCT_NAME)`; override it before
   * submitting to App Review.
   */
  usageDescription?: string;
}

/**
 * Plugin options for `@gabriel-sisjr/react-native-background-location`.
 *
 * All fields are optional. Sensible defaults apply when omitted.
 * Validation lives in `./validate.ts` and runs before any modifier.
 */
export interface BackgroundLocationPluginProps {
  /**
   * iOS `NSLocationWhenInUseUsageDescription`.
   * Defaults to a generic string mentioning `$(PRODUCT_NAME)`; override it
   * before submitting to App Review.
   */
  locationWhenInUseUsageDescription?: string;

  /**
   * iOS `NSLocationAlwaysAndWhenInUseUsageDescription`.
   * Defaults to a generic background-location string mentioning `$(PRODUCT_NAME)`.
   */
  locationAlwaysAndWhenInUseUsageDescription?: string;

  /**
   * iOS `NSLocationAlwaysUsageDescription` (legacy — iOS < 11).
   * Defaults to a generic always-on string mentioning `$(PRODUCT_NAME)`.
   */
  locationAlwaysUsageDescription?: string;

  /**
   * iOS `NSLocationTemporaryUsageDescriptionDictionary` — purpose-keyed usage
   * descriptions that make a purpose string available for temporary
   * precise-location requests. Shallow-merged into any existing dictionary in
   * the consumer's `Info.plist`; when omitted, the dictionary is left
   * untouched.
   *
   * The library has no API that requests temporary full accuracy, so these
   * entries are only used by app code or other libraries that call
   * `requestTemporaryFullAccuracyAuthorization(withPurposeKey:)`.
   *
   * Keys are purpose strings (the `withPurposeKey` argument of that call).
   * Values must be non-empty strings.
   *
   * @example
   * { "AccurateFix": "We need accurate location for in-app navigation." }
   */
  temporaryUsageDescriptions?: Record<string, string>;

  /**
   * Opt-in for motion activity recognition. Its presence, even as `{}`,
   * enables the native setup the `motionActivity` tracking option needs:
   *
   * - Android: adds `android.permission.ACTIVITY_RECOGNITION` and
   *   `com.google.android.gms.permission.ACTIVITY_RECOGNITION` (with
   *   `android:maxSdkVersion="28"`) to the manifest. Entries the app already
   *   declares are kept as they are.
   * - iOS: writes `NSMotionUsageDescription` and adds
   *   `$BackgroundLocationMotionActivity = true` to the `Podfile`, so the
   *   CoreMotion code is compiled into the app.
   *
   * When omitted, the prebuild output is the same as without motion support.
   * Removing the prop later requires `expo prebuild --clean`, because the
   * `Podfile` line is not removed by an incremental prebuild.
   *
   * @example
   * { "usageDescription": "$(PRODUCT_NAME) detects when you are stationary to save battery." }
   */
  motionActivity?: MotionActivityPluginProps;
}
