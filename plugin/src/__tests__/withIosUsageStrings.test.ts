import { withBackgroundLocation } from '../withBackgroundLocation';
import {
  createBaseInfoPlist,
  createPrePopulatedInfoPlist,
} from './fixtures/baseInfoPlist';
import { runInfoPlistMod } from './utils/makeConfig';
import type { ConfigPlugin } from 'expo/config-plugins';

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

  // Precedence chain for every usage string: prop > existing plist value >
  // library default. A value the consumer's app.json or another plugin already
  // put in the plist must survive, and an explicit prop must beat it.
  describe.each([
    [
      'locationWhenInUseUsageDescription',
      'NSLocationWhenInUseUsageDescription',
    ],
    [
      'locationAlwaysAndWhenInUseUsageDescription',
      'NSLocationAlwaysAndWhenInUseUsageDescription',
    ],
    ['locationAlwaysUsageDescription', 'NSLocationAlwaysUsageDescription'],
  ] as const)('%s', (prop, plistKey) => {
    it('the prop wins over an existing plist value', async () => {
      const config = withBackgroundLocation(baseExpoConfig(), {
        [prop]: 'Custom copy',
      });
      const seeded = createBaseInfoPlist();
      seeded[plistKey] = 'Pre-existing plist value';

      const result = await runInfoPlistMod(config, seeded);

      expect(result[plistKey]).toBe('Custom copy');
    });

    it('an existing plist value wins over the default when the prop is omitted', async () => {
      const config = withBackgroundLocation(baseExpoConfig(), {});
      const seeded = createBaseInfoPlist();
      seeded[plistKey] = 'Pre-existing plist value';

      const result = await runInfoPlistMod(config, seeded);

      expect(result[plistKey]).toBe('Pre-existing plist value');
    });
  });

  it.each([
    ['a string', 'audio'],
    ['an object', { audio: true }],
  ])(
    'replaces a malformed UIBackgroundModes (%s) with ["location"]',
    async (_label, malformed) => {
      const config = withBackgroundLocation(baseExpoConfig(), {});
      const seeded = createBaseInfoPlist();
      (seeded as Record<string, unknown>).UIBackgroundModes = malformed;

      const result = await runInfoPlistMod(config, seeded);

      expect(result.UIBackgroundModes).toEqual(['location']);
    }
  );

  it('lets temporaryUsageDescriptions win over an existing entry with the same key', async () => {
    const config = withBackgroundLocation(baseExpoConfig(), {
      temporaryUsageDescriptions: { ExistingKey: 'Prop value' },
    });
    const result = await runInfoPlistMod(config, createPrePopulatedInfoPlist());

    expect(result.NSLocationTemporaryUsageDescriptionDictionary).toEqual({
      ExistingKey: 'Prop value',
    });
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
});
