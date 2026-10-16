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
}
