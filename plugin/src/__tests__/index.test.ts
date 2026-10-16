import plugin, { PluginError } from '../index';
import { PluginError as SourcePluginError } from '../errors/PluginError';
import { createBaseInfoPlist } from './fixtures/baseInfoPlist';
import { runInfoPlistMod } from './utils/makeConfig';
import type { ConfigPlugin } from 'expo/config-plugins';

const pkg = require('../../../package.json') as {
  name: string;
  version: string;
};

type ExpoConfig = Parameters<ConfigPlugin<unknown>>[0];

const baseExpoConfig = (): ExpoConfig => ({
  name: 'app',
  slug: 'app',
  ios: {},
  android: {},
});

describe('published entry point (plugin/src/index.ts)', () => {
  it('forwards the plugin props to the mods', async () => {
    const config = plugin(baseExpoConfig(), {
      locationWhenInUseUsageDescription: 'From the entry point',
    });
    const result = await runInfoPlistMod(config, createBaseInfoPlist());

    expect(result.NSLocationWhenInUseUsageDescription).toBe(
      'From the entry point'
    );
  });

  it('records the package in the plugin history and runs only once', () => {
    const config = plugin(baseExpoConfig(), {});
    expect(
      (config._internal as { pluginHistory?: Record<string, unknown> })
        .pluginHistory?.[pkg.name]
    ).toEqual({ name: pkg.name, version: pkg.version });

    // A second application is skipped before validation, so even invalid props
    // do not throw and the same config object comes back.
    expect(plugin(config, 42 as never)).toBe(config);
  });

  it('re-exports PluginError', () => {
    expect(PluginError).toBe(SourcePluginError);
  });
});
