/**
 * Plugin options for `@gabriel-sisjr/react-native-background-location`.
 *
 * All fields are optional. Sensible defaults apply when omitted.
 * Validation lives in `./validate.ts` and runs before any modifier.
 */
export interface BackgroundLocationPluginProps {
  /**
   * iOS `NSLocationWhenInUseUsageDescription`.
   * Defaults to a generic, App-Review-safe string mentioning `$(PRODUCT_NAME)`.
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
   * iOS `NSLocationTemporaryUsageDescriptionDictionary` — purpose-keyed
   * temporary-full-accuracy descriptions. Shallow-merged into any existing
   * dictionary in the consumer's `Info.plist`. Forward-compat hook for C6
   * (`requestTemporaryFullAccuracy`) shipping in v0.18.x — the same train
   * that now carries this plugin (see decision #13).
   *
   * Keys are purpose strings (referenced by `requestTemporaryFullAccuracy(purposeKey:)`).
   * Values are App-Review-safe usage strings.
   *
   * @example
   * { "AccurateFix": "We need accurate location for in-app navigation." }
   */
  temporaryUsageDescriptions?: Record<string, string>;
}
