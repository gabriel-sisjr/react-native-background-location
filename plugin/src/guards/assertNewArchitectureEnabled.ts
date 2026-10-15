import type { ConfigPlugin } from 'expo/config-plugins';
import { PluginError } from '../errors/PluginError';
import { getExpoSdkMajor } from '../utils/expoSdk';

type ExpoConfig = Parameters<ConfigPlugin<unknown>>[0];

/**
 * Last Expo SDK in which the New Architecture can still be switched off.
 * SDK 55 (React Native 0.83) removed the legacy architecture: the app config
 * key is gone from `ExpoConfig`, prebuild-config no longer maps it to
 * `Podfile.properties.json` / `gradle.properties`, and React Native itself
 * forces `newArchEnabled=true` (it only logs when it finds `false`).
 */
export const LAST_SDK_WITH_NEW_ARCH_TOGGLE = 54;

const BUILD_PROPERTIES_PLUGIN = 'expo-build-properties';

type Platform = 'ios' | 'android';

/**
 * The `ExpoConfig` typings differ per SDK (`newArchEnabled` only exists up to
 * SDK 54), so the guard reads the config through this narrow, defensive view.
 */
interface ConfigView {
  sdkVersion?: unknown;
  newArchEnabled?: unknown;
  ios?: { newArchEnabled?: unknown } | null;
  android?: { newArchEnabled?: unknown } | null;
  plugins?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Same test Expo SDK 54 applies: `value?.toString() === 'false'`. */
function isFalse(value: unknown): boolean {
  return value !== undefined && value !== null && String(value) === 'false';
}

/**
 * `expo-build-properties` can still write `newArchEnabled` through its own
 * (deprecated) `ios.newArchEnabled` / `android.newArchEnabled` props on SDK 54.
 * Those props never reach `ExpoConfig`, and the mod that applies them runs
 * after Expo's own, so they win. The first listed entry wins among duplicates.
 */
function readBuildPropertiesOverride(
  plugins: unknown,
  platform: Platform
): unknown {
  if (!Array.isArray(plugins)) return undefined;
  for (const entry of plugins) {
    const [name, props] = Array.isArray(entry) ? entry : [entry, undefined];
    if (name !== BUILD_PROPERTIES_PLUGIN || !isRecord(props)) continue;
    const platformProps = props[platform];
    if (isRecord(platformProps) && platformProps.newArchEnabled !== undefined) {
      return platformProps.newArchEnabled;
    }
  }
  return undefined;
}

function describeDisabledSources(
  view: ConfigView,
  platform: Platform
): string[] {
  const sources: string[] = [];
  const override = readBuildPropertiesOverride(view.plugins, platform);
  if (override !== undefined) {
    // expo-build-properties wins over the app config on the platform it targets.
    if (isFalse(override)) {
      sources.push(
        `expo-build-properties: ${platform}.newArchEnabled = ${String(override)}`
      );
    }
    return sources;
  }
  const platformValue = view[platform]?.newArchEnabled;
  if (isFalse(platformValue)) {
    sources.push(`app config: ${platform}.newArchEnabled = false`);
  } else if (platformValue === undefined || platformValue === null) {
    if (isFalse(view.newArchEnabled)) {
      sources.push('app config: newArchEnabled = false');
    }
  }
  return sources;
}

/**
 * Fails fast, before any mod is registered, when the New Architecture has been
 * explicitly disabled for iOS or Android.
 *
 * The library is a TurboModule documented as New Architecture only. iOS cannot
 * work without it: `BackgroundLocation.mm` never registers with the legacy
 * bridge (no `RCT_EXPORT_MODULE`; it is found only through
 * `RCTTurboModuleManager`'s class-name lookup), so
 * `TurboModuleRegistry.getEnforcing('BackgroundLocation')` throws on import.
 * The native build still succeeds on the legacy architecture (verified with a
 * build and an iOS simulator run), so nothing but this guard warns the user
 * before the app crashes at startup.
 * Android is expected to load on the legacy bridge too (codegen spec base class
 * plus `BaseReactPackage`), but only the New Architecture is validated and
 * documented, so both platforms are enforced.
 *
 * Only an explicit `false` is rejected. From Expo SDK 55 the flag cannot be
 * turned off (it is ignored by Expo and React Native), so the check is skipped
 * for SDK 55+ and for an unknown SDK to avoid blocking builds that would work.
 */
export function assertNewArchitectureEnabled(config: ExpoConfig): void {
  const view = config as unknown as ConfigView;
  const sdkMajor = getExpoSdkMajor(view.sdkVersion);
  if (sdkMajor === undefined || sdkMajor > LAST_SDK_WITH_NEW_ARCH_TOGGLE) {
    return;
  }

  const offenders: Array<{ platform: Platform; sources: string[] }> = [];
  for (const platform of ['ios', 'android'] as const) {
    const sources = describeDisabledSources(view, platform);
    if (sources.length > 0) offenders.push({ platform, sources });
  }
  if (offenders.length === 0) return;

  const details = offenders
    .map(
      ({ platform, sources }) =>
        `  - ${platform === 'ios' ? 'iOS' : 'Android'}: ${sources.join('; ')}`
    )
    .join('\n');

  throw new PluginError(
    'NEW_ARCHITECTURE_DISABLED',
    `@gabriel-sisjr/react-native-background-location requires the React Native ` +
      `New Architecture, but it is disabled in your Expo config:\n${details}\n` +
      `Without it the native build still succeeds, but the app crashes at ` +
      `startup: TurboModuleRegistry.getEnforcing('BackgroundLocation') throws ` +
      `as soon as the package is imported (verified on iOS; the legacy ` +
      `architecture is not supported on Android either).\n` +
      `Fix: remove \`newArchEnabled: false\` (top level, \`ios\` and \`android\` ` +
      `in app.json / app.config.*) and the \`newArchEnabled\` props of ` +
      `expo-build-properties, or set them to \`true\`, then run ` +
      `\`npx expo prebuild --clean\`. Expo SDK 54 enables the New Architecture ` +
      `by default; Expo SDK 55+ always enables it.`,
    { sdkVersion: view.sdkVersion, offenders }
  );
}
