import type { IOSConfig } from '@expo/config-plugins';

type InfoPlist = IOSConfig.InfoPlist;

/**
 * Returns a fresh, minimal `Info.plist` shape used as the baseline input for
 * Phase 5 snapshot tests of the iOS-side plugin modifiers.
 *
 * - Three universally-present keys an Xcode-managed Info.plist always ships
 *   with (`CFBundleDevelopmentRegion`, `CFBundleExecutable`,
 *   `CFBundleIdentifier`).
 * - No `NSLocation*` usage descriptions.
 * - No `UIBackgroundModes` array.
 * - No `NSLocationTemporaryUsageDescriptionDictionary`.
 *
 * Tests can therefore verify both empty-baseline and pre-populated-baseline
 * behaviors by reading the result of this factory and mutating the copy
 * locally before invoking the modifier.
 *
 * Each invocation returns a brand-new object graph so snapshot tests that
 * mutate the fixture cannot leak state across cases.
 */
export const createBaseInfoPlist = (): InfoPlist => ({
  CFBundleDevelopmentRegion: 'en',
  CFBundleExecutable: '$(EXECUTABLE_NAME)',
  CFBundleIdentifier: '$(PRODUCT_BUNDLE_IDENTIFIER)',
});

/**
 * Returns a fresh `Info.plist` baseline that is **already pre-populated** with
 * non-trivial values the iOS modifier must preserve and merge with rather than
 * overwrite. Used to exercise the `withIosUsageStrings` modifier's three key
 * preservation guarantees:
 *
 * 1. `UIBackgroundModes` must keep any pre-existing entries (e.g. `audio`) and
 *    append `location` exactly once.
 * 2. `NSLocationTemporaryUsageDescriptionDictionary` must be shallow-merged so
 *    pre-existing purpose keys survive alongside the consumer-supplied ones.
 * 3. The three Xcode-managed bundle keys remain untouched.
 *
 * Each invocation returns a brand-new object graph (including the array and
 * dictionary fields) so snapshot tests that mutate the fixture cannot leak
 * state across cases.
 */
export const createPrePopulatedInfoPlist = (): InfoPlist => ({
  CFBundleDevelopmentRegion: 'en',
  CFBundleExecutable: '$(EXECUTABLE_NAME)',
  CFBundleIdentifier: '$(PRODUCT_BUNDLE_IDENTIFIER)',
  UIBackgroundModes: ['audio'],
  NSLocationTemporaryUsageDescriptionDictionary: {
    ExistingKey: 'pre-existing value',
  },
});
