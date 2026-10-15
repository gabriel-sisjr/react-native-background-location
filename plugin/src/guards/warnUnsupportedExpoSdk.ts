import {
  WarningAggregator,
  withDangerousMod,
  type ConfigPlugin,
} from 'expo/config-plugins';
import { getExpoSdkMajor } from '../utils/expoSdk';

/**
 * Oldest Expo SDK the library supports. SDK 54 ships React Native 0.81 and
 * React 19.1 and is the last SDK in which the New Architecture is optional.
 */
export const MIN_SUPPORTED_EXPO_SDK = 54;

const WARNING_SCOPE = 'warnUnsupportedExpoSdk';

/**
 * Text of the unsupported-SDK warning, or `null` when the SDK is supported or
 * unknown. A missing, `UNVERSIONED` or malformed `sdkVersion` is never treated
 * as "old": the check only fires for a version that parses to a major below
 * {@link MIN_SUPPORTED_EXPO_SDK}.
 */
export function getUnsupportedExpoSdkWarning(
  sdkVersion: unknown
): string | null {
  const sdkMajor = getExpoSdkMajor(sdkVersion);
  if (sdkMajor === undefined || sdkMajor >= MIN_SUPPORTED_EXPO_SDK) return null;
  return (
    `@gabriel-sisjr/react-native-background-location supports Expo SDK ` +
    `${MIN_SUPPORTED_EXPO_SDK} or later (React Native 0.81+ with the New ` +
    `Architecture), but this project uses Expo SDK ${sdkMajor}. The plugin ` +
    `still applied its changes, but this SDK is unsupported: builds and ` +
    `runtime behavior are not guaranteed. Upgrade Expo to SDK ` +
    `${MIN_SUPPORTED_EXPO_SDK} or later.`
  );
}

/**
 * Warns, without ever failing the prebuild, when the project targets an Expo
 * SDK older than {@link MIN_SUPPORTED_EXPO_SDK}.
 *
 * Expo evaluates a config plugin several times per prebuild, and
 * `WarningAggregator` prints on every call, so warning while the plugin
 * function runs would repeat the message. The warning is emitted from one
 * dangerous mod per platform instead: Expo runs every registered mod exactly
 * once per platform and per prebuild, dangerous mods run before all other mods,
 * and `expo prebuild --platform <name>` only reports the platform it generates.
 * Dangerous mods are skipped in introspection mode (`expo config --type
 * introspect`), which therefore never prints the warning.
 *
 * On a supported or unknown SDK no mod is registered at all, so the mod graph
 * is exactly the one built without this plugin.
 */
export const warnUnsupportedExpoSdk: ConfigPlugin = (config) => {
  const warning = getUnsupportedExpoSdkWarning(config.sdkVersion);
  if (warning === null) return config;

  config = withDangerousMod(config, [
    'android',
    (cfg) => {
      WarningAggregator.addWarningAndroid(WARNING_SCOPE, warning);
      return cfg;
    },
  ]);
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      WarningAggregator.addWarningIOS(WARNING_SCOPE, warning);
      return cfg;
    },
  ]);
};
