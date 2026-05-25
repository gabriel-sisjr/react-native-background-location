import { withInfoPlist, type ConfigPlugin } from '@expo/config-plugins';
import type { BackgroundLocationPluginProps } from '../options/types';

/**
 * Default copy used when the consumer does not provide their own usage strings
 * and the project's `Info.plist` does not already declare them.
 *
 * Kept module-private on purpose — they are an implementation detail of the
 * iOS side of the plugin. Apple's tooling expands `$(PRODUCT_NAME)` at compile
 * time; do not replace it with a hard-coded app name.
 */
const DEFAULT_WHEN_IN_USE =
  'Allow $(PRODUCT_NAME) to access your location while you use the app.';
const DEFAULT_ALWAYS_AND_WHEN_IN_USE =
  'Allow $(PRODUCT_NAME) to access your location, even when the app is in the background.';
const DEFAULT_ALWAYS =
  'Allow $(PRODUCT_NAME) to access your location at all times.';

/**
 * iOS Info.plist injector for background-location.
 *
 * Responsibilities:
 *
 * 1. Ensures the three location usage-description keys are populated, with the
 *    precedence chain `props → existing plist value → library default`. This
 *    preserves any value the consumer already set in
 *    `app.json#expo.ios.infoPlist` or via another config plugin.
 * 2. Defensively appends `"location"` to `UIBackgroundModes` exactly once,
 *    preserving any modes added by the consumer or other plugins.
 * 3. Forward-compat (C6, v0.18.x): when `temporaryUsageDescriptions` is
 *    provided, shallow-merges it into
 *    `NSLocationTemporaryUsageDescriptionDictionary`. When the prop is omitted,
 *    the dictionary is left untouched.
 *
 * The mod is idempotent — calling the plugin chain twice produces a
 * byte-identical plist.
 */
export const withIosUsageStrings: ConfigPlugin<
  BackgroundLocationPluginProps
> = (config, props) => {
  return withInfoPlist(config, (cfg) => {
    const plist = cfg.modResults;

    // 1. Usage strings — defaults with selective override.
    plist.NSLocationWhenInUseUsageDescription =
      props.locationWhenInUseUsageDescription ??
      plist.NSLocationWhenInUseUsageDescription ??
      DEFAULT_WHEN_IN_USE;

    plist.NSLocationAlwaysAndWhenInUseUsageDescription =
      props.locationAlwaysAndWhenInUseUsageDescription ??
      plist.NSLocationAlwaysAndWhenInUseUsageDescription ??
      DEFAULT_ALWAYS_AND_WHEN_IN_USE;

    plist.NSLocationAlwaysUsageDescription =
      props.locationAlwaysUsageDescription ??
      plist.NSLocationAlwaysUsageDescription ??
      DEFAULT_ALWAYS;

    // 2. UIBackgroundModes — always-on injection of "location".
    //    Preserve any existing modes the consumer or other plugins added.
    const existingModes = Array.isArray(plist.UIBackgroundModes)
      ? (plist.UIBackgroundModes as string[])
      : [];
    if (!existingModes.includes('location')) {
      plist.UIBackgroundModes = [...existingModes, 'location'];
    }

    // 3. C6 forward-compat — shallow-merge into the temporary-usage dictionary.
    if (props.temporaryUsageDescriptions) {
      const existing =
        (plist.NSLocationTemporaryUsageDescriptionDictionary as
          | Record<string, string>
          | undefined) ?? {};
      plist.NSLocationTemporaryUsageDescriptionDictionary = {
        ...existing,
        ...props.temporaryUsageDescriptions,
      };
    }

    return cfg;
  });
};
