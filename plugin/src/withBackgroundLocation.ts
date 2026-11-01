import type { ConfigPlugin } from 'expo/config-plugins';
import { withAndroidPermissions } from './android/withAndroidPermissions';
import { assertNewArchitectureEnabled } from './guards/assertNewArchitectureEnabled';
import { warnUnsupportedExpoSdk } from './guards/warnUnsupportedExpoSdk';
import { withIosDeploymentTarget } from './ios/withIosDeploymentTarget';
import { withIosMotionActivity } from './ios/withIosMotionActivity';
import { withIosUsageStrings } from './ios/withIosUsageStrings';
import { validatePluginProps } from './options/validate';
import type { BackgroundLocationPluginProps } from './options/types';

/**
 * Orchestrator that chains every platform-specific mod owned by the library.
 *
 * 1. `validatePluginProps` rejects invalid props and
 *    `assertNewArchitectureEnabled` rejects a disabled New Architecture. Both
 *    throw `PluginError` before any `with*` modifier is registered, so a
 *    partially mutated config can never escape.
 * 2. `warnUnsupportedExpoSdk` adds a non-fatal warning when the project uses an
 *    Expo SDK older than 54. The modifiers below are still applied.
 * 3. The platform modifiers: `withAndroidPermissions` (manifest permissions,
 *    plus the activity-recognition permissions when `motionActivity` is
 *    present), `withIosUsageStrings` (usage strings and `UIBackgroundModes`,
 *    plus `NSMotionUsageDescription` when `motionActivity` is present),
 *    `withIosMotionActivity` (the `$BackgroundLocationMotionActivity = true`
 *    Podfile flag, registered only when `motionActivity` is present) and
 *    `withIosDeploymentTarget` (iOS deployment target of at least 16.0).
 *
 * Without the `motionActivity` prop no motion-related mod is registered, so the
 * prebuild output is the same as for an app that does not use the feature.
 *
 * Each modifier is scoped to its own platform, so their order only matters for
 * readability; we keep the convention `android → ios`.
 */
export const withBackgroundLocation: ConfigPlugin<
  BackgroundLocationPluginProps | void
> = (config, rawProps) => {
  const props = validatePluginProps(rawProps);
  assertNewArchitectureEnabled(config);
  config = warnUnsupportedExpoSdk(config);
  config = withAndroidPermissions(config, props);
  config = withIosUsageStrings(config, props);
  if (props.motionActivity) {
    config = withIosMotionActivity(config);
  }
  config = withIosDeploymentTarget(config);
  return config;
};
