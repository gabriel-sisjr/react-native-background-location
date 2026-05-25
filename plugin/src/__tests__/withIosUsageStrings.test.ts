import { withBackgroundLocation } from '../withBackgroundLocation';
import {
  createBaseInfoPlist,
  createPrePopulatedInfoPlist,
} from './fixtures/baseInfoPlist';
import { runInfoPlistMod } from './utils/makeConfig';
import type { ConfigPlugin } from '@expo/config-plugins';

type ExpoConfig = Parameters<ConfigPlugin<unknown>>[0];

const baseExpoConfig = (): ExpoConfig => ({
  name: 'app',
  slug: 'app',
  ios: {},
  android: {},
});

describe('withIosUsageStrings', () => {
  it('populates all three usage strings with defaults when props are empty', async () => {
    const config = withBackgroundLocation(baseExpoConfig(), {});
    const result = await runInfoPlistMod(config, createBaseInfoPlist());

    expect(result.NSLocationWhenInUseUsageDescription).toBe(
      'Allow $(PRODUCT_NAME) to access your location while you use the app.'
    );
    expect(result.NSLocationAlwaysAndWhenInUseUsageDescription).toBe(
      'Allow $(PRODUCT_NAME) to access your location, even when the app is in the background.'
    );
    expect(result.NSLocationAlwaysUsageDescription).toBe(
      'Allow $(PRODUCT_NAME) to access your location at all times.'
    );
    expect(result).toMatchSnapshot();
  });

  it('appends location to UIBackgroundModes preserving existing entries', async () => {
    const config = withBackgroundLocation(baseExpoConfig(), {});
    const result = await runInfoPlistMod(config, createPrePopulatedInfoPlist());

    expect(result.UIBackgroundModes).toEqual(['audio', 'location']);
  });

  it('consumer override wins for locationWhenInUseUsageDescription', async () => {
    const config = withBackgroundLocation(baseExpoConfig(), {
      locationWhenInUseUsageDescription: 'Custom copy',
    });

    // Pre-populate the plist with a value the consumer's app.json or another
    // plugin could have set. The explicit prop must beat that value, which
    // in turn beats the library default.
    const seeded = createBaseInfoPlist();
    seeded.NSLocationWhenInUseUsageDescription = 'Pre-existing plist value';

    const result = await runInfoPlistMod(config, seeded);

    expect(result.NSLocationWhenInUseUsageDescription).toBe('Custom copy');
  });

  it('shallow-merges temporaryUsageDescriptions preserving existing keys', async () => {
    const config = withBackgroundLocation(baseExpoConfig(), {
      temporaryUsageDescriptions: {
        AccurateFix: 'We need accurate location for in-app navigation.',
      },
    });
    const result = await runInfoPlistMod(config, createPrePopulatedInfoPlist());

    expect(result.NSLocationTemporaryUsageDescriptionDictionary).toEqual({
      ExistingKey: 'pre-existing value',
      AccurateFix: 'We need accurate location for in-app navigation.',
    });
  });

  it('is idempotent — UIBackgroundModes contains location exactly once after a second pass', async () => {
    // First pass — register and run on a clean baseline.
    const firstConfig = withBackgroundLocation(baseExpoConfig(), {});
    const firstResult = await runInfoPlistMod(
      firstConfig,
      createBaseInfoPlist()
    );

    // Second pass — apply the plugin again to the already-modified plist.
    const secondConfig = withBackgroundLocation(baseExpoConfig(), {});
    const secondResult = await runInfoPlistMod(secondConfig, firstResult);

    const modes = secondResult.UIBackgroundModes as string[];
    expect(modes.filter((m) => m === 'location').length).toBe(1);
    expect(secondResult).toEqual(firstResult);
  });

  it('snapshot of full plist after applying defaults to an empty baseline', async () => {
    // Top-level snapshot — locks the shape of the plist after the modifier
    // runs on the canonical empty baseline. Mirrors the Android snapshot and
    // gives the reviewer a single source of truth for the expected output.
    const config = withBackgroundLocation(baseExpoConfig(), {});
    const result = await runInfoPlistMod(config, createBaseInfoPlist());

    expect(result).toMatchSnapshot();
  });
});
