import { createRunOncePlugin, type ConfigPlugin } from '@expo/config-plugins';
import { withBackgroundLocation } from './withBackgroundLocation';
import type { BackgroundLocationPluginProps } from './options/types';

const pkg = require('../../package.json') as { name: string; version: string };

const plugin: ConfigPlugin<BackgroundLocationPluginProps | void> = (
  config,
  props
) => withBackgroundLocation(config, props);

export default createRunOncePlugin(plugin, pkg.name, pkg.version);

export { PluginError } from './errors/PluginError';
export type { PluginErrorCode } from './errors/PluginError';
export type { BackgroundLocationPluginProps } from './options/types';
