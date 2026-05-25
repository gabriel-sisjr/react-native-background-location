import type {
  AndroidConfig,
  IOSConfig,
  ConfigPlugin,
  ExportedConfigWithProps,
  Mod,
} from '@expo/config-plugins';

type AndroidManifest = AndroidConfig.Manifest.AndroidManifest;
type InfoPlist = IOSConfig.InfoPlist;

/**
 * `ConfigPlugin<unknown>` accepts an `ExpoConfig` as its first argument. We
 * extract that type via `Parameters<...>` to avoid taking a direct dependency
 * on `@expo/config-types` from the test layer — `@expo/config-plugins` already
 * re-exports the shape transitively via its public function signatures.
 */
type ExpoConfig = Parameters<ConfigPlugin<unknown>>[0];

/**
 * Test helpers that bridge the gap between `withBackgroundLocation` — a
 * `ConfigPlugin` that only *registers* mods under `config.mods.<platform>.<name>`
 * — and the snapshot/idempotency assertions in Phase 5 tests, which need the
 * actual mutated `modResults` (the parsed `AndroidManifest.xml` / `Info.plist`).
 *
 * At runtime, `expo prebuild` invokes the registered mods with a fully-typed
 * `ExportedConfigWithProps<T>` envelope. In unit tests we synthesise the same
 * envelope and invoke the registered mod ourselves so the assertions operate
 * on real mutated data rather than on the dormant mod registration.
 *
 * Both helpers return properly-typed values so neither
 * `withAndroidPermissions.test.ts` nor `withIosUsageStrings.test.ts` ever
 * needs an `as never` cast.
 *
 * Each call returns a fresh object graph so concurrent test cases that
 * mutate the config cannot leak state across one another.
 */

const FIXED_PROJECT_ROOT = '/tmp/example-expo';
const FIXED_PLATFORM_ROOT_ANDROID = '/tmp/example-expo/android';
const FIXED_PLATFORM_ROOT_IOS = '/tmp/example-expo/ios';
const FIXED_PROJECT_NAME = 'example-expo';

const baseExpoConfig = (): ExpoConfig => ({
  name: 'app',
  slug: 'app',
  ios: {},
  android: {},
});

/**
 * Build a fully-typed `ExportedConfigWithProps<AndroidManifest>` envelope
 * around the supplied `modResults`. Mirrors what the `@expo/config-plugins`
 * runtime hands to `withAndroidManifest` mod callbacks during `expo prebuild`.
 */
export const makeAndroidConfig = (
  modResults: AndroidManifest
): ExportedConfigWithProps<AndroidManifest> => {
  const expo = baseExpoConfig();
  return {
    ...expo,
    modResults,
    modRawConfig: { ...expo },
    modRequest: {
      projectRoot: FIXED_PROJECT_ROOT,
      platformProjectRoot: FIXED_PLATFORM_ROOT_ANDROID,
      modName: 'manifest',
      platform: 'android',
      introspect: false,
      projectName: FIXED_PROJECT_NAME,
    },
  };
};

/**
 * Build a fully-typed `ExportedConfigWithProps<InfoPlist>` envelope
 * around the supplied `modResults`. Mirrors what the `@expo/config-plugins`
 * runtime hands to `withInfoPlist` mod callbacks during `expo prebuild`.
 */
export const makeIosConfig = (
  modResults: InfoPlist
): ExportedConfigWithProps<InfoPlist> => {
  const expo = baseExpoConfig();
  return {
    ...expo,
    modResults,
    modRawConfig: { ...expo },
    modRequest: {
      projectRoot: FIXED_PROJECT_ROOT,
      platformProjectRoot: FIXED_PLATFORM_ROOT_IOS,
      modName: 'infoPlist',
      platform: 'ios',
      introspect: false,
      projectName: FIXED_PROJECT_NAME,
    },
  };
};

/**
 * Narrow `ExpoConfig` to the runtime-only `mods` registry the plugin chain
 * mutates in-place. `ConfigPlugin`'s public return type is `ExpoConfig`, but
 * `withAndroidManifest` / `withInfoPlist` attach `mods.<platform>.<name>` to
 * the same object reference under the hood. This local cast exposes that
 * runtime contract to TypeScript without forcing the test files to depend on
 * the package-private `ExportedConfig` type.
 */
type ConfigWithMods = ExpoConfig & {
  mods?: {
    android?: { manifest?: Mod<AndroidManifest> };
    ios?: { infoPlist?: Mod<InfoPlist> };
  };
};

/**
 * Extract the registered Android manifest mod from a config that has had
 * `withBackgroundLocation` (or any plugin that calls `withAndroidManifest`)
 * applied to it. Throws if the mod is not registered, which would indicate
 * a regression in the plugin chain.
 */
export const getRegisteredAndroidManifestMod = (
  config: ExpoConfig
): Mod<AndroidManifest> => {
  const mod = (config as ConfigWithMods).mods?.android?.manifest;
  if (!mod) {
    throw new Error(
      'Expected config.mods.android.manifest to be registered after withBackgroundLocation'
    );
  }
  return mod;
};

/**
 * Extract the registered iOS Info.plist mod from a config that has had
 * `withBackgroundLocation` (or any plugin that calls `withInfoPlist`)
 * applied to it. Throws if the mod is not registered, which would indicate
 * a regression in the plugin chain.
 */
export const getRegisteredInfoPlistMod = (
  config: ExpoConfig
): Mod<InfoPlist> => {
  const mod = (config as ConfigWithMods).mods?.ios?.infoPlist;
  if (!mod) {
    throw new Error(
      'Expected config.mods.ios.infoPlist to be registered after withBackgroundLocation'
    );
  }
  return mod;
};

/**
 * Invoke a registered Android manifest mod against a fresh `ExportedConfigWithProps`
 * envelope. Returns the mutated `modResults` synchronously when the mod is sync;
 * otherwise awaits it. The plugin chain in this library is sync end-to-end, so
 * the helper deliberately exposes a `Promise`-aware return type for forward-compat
 * but most callers can `await` it without contortion.
 */
export const runAndroidManifestMod = async (
  config: ExpoConfig,
  modResults: AndroidManifest
): Promise<AndroidManifest> => {
  const mod = getRegisteredAndroidManifestMod(config);
  // The runtime always wraps the action via `withMod` → `withBaseMod`, which
  // injects a `nextMod` (identity by default). Mirror that exactly so the
  // mod's `modRequest.nextMod` is never `undefined`.
  const identityNextMod: Mod<AndroidManifest> = (cfg) => cfg;
  const envelope = makeAndroidConfig(modResults);
  const out = await mod({
    ...envelope,
    modRequest: { ...envelope.modRequest, nextMod: identityNextMod },
  });
  return out.modResults;
};

/**
 * Invoke a registered iOS Info.plist mod against a fresh `ExportedConfigWithProps`
 * envelope. Symmetric companion to `runAndroidManifestMod`.
 */
export const runInfoPlistMod = async (
  config: ExpoConfig,
  modResults: InfoPlist
): Promise<InfoPlist> => {
  const mod = getRegisteredInfoPlistMod(config);
  const identityNextMod: Mod<InfoPlist> = (cfg) => cfg;
  const envelope = makeIosConfig(modResults);
  const out = await mod({
    ...envelope,
    modRequest: { ...envelope.modRequest, nextMod: identityNextMod },
  });
  return out.modResults;
};
