import type { ConfigPlugin } from '@expo/config-plugins';
import { withAndroidPermissions } from './android/withAndroidPermissions';
import { withIosUsageStrings } from './ios/withIosUsageStrings';
import { validatePluginProps } from './options/validate';
import type { BackgroundLocationPluginProps } from './options/types';

/**
 * Orchestrator that chains every platform-specific mod owned by the library.
 *
 * Order matters only loosely — each mod is scoped to its own platform — but we
 * keep the convention `android → ios` for readability. Raw props are validated
 * up-front via `validatePluginProps`; bad input throws `PluginError` before any
 * `with*` modifier runs so a partial config mutation can never escape.
 */
export const withBackgroundLocation: ConfigPlugin<
  BackgroundLocationPluginProps | void
> = (config, rawProps) => {
  const props = validatePluginProps(rawProps);
  config = withAndroidPermissions(config, props);
  config = withIosUsageStrings(config, props);
  return config;
};
