import { WarningAggregator } from 'expo/config-plugins';
import type { ConfigPlugin } from 'expo/config-plugins';
import { PluginError } from '../errors/PluginError';
import {
  MIN_SUPPORTED_EXPO_SDK,
  getUnsupportedExpoSdkWarning,
  warnUnsupportedExpoSdk,
} from '../guards/warnUnsupportedExpoSdk';
import { withBackgroundLocation } from '../withBackgroundLocation';
import { createBaseAndroidManifest } from './fixtures/baseAndroidManifest';
import {
  hasRegisteredMod,
  runAndroidManifestMod,
  runRegisteredMod,
} from './utils/makeConfig';

// Newer `expo` builds export `WarningAggregator.addWarning*` as non-configurable
// getters, so `jest.spyOn` would throw there. Replace the exports through a
// module mock instead.
jest.mock('expo/config-plugins', () => {
  const actual = jest.requireActual('expo/config-plugins');
  return {
    ...actual,
    WarningAggregator: {
      ...actual.WarningAggregator,
      addWarningAndroid: jest.fn(),
      addWarningIOS: jest.fn(),
    },
  };
});

type ExpoConfig = Parameters<ConfigPlugin<unknown>>[0];

const warnAndroid = WarningAggregator.addWarningAndroid as unknown as jest.Mock;
const warnIos = WarningAggregator.addWarningIOS as unknown as jest.Mock;

/** `sdkVersion` is typed `string`, but Expo hands over whatever app.json holds. */
const configForSdk = (sdkVersion?: unknown): ExpoConfig =>
  ({
    name: 'app',
    slug: 'app',
    ios: {},
    android: {},
    ...(sdkVersion === undefined ? {} : { sdkVersion }),
  }) as unknown as ExpoConfig;

const registeredMods = (config: ExpoConfig): unknown =>
  (config as { mods?: unknown }).mods;

const SUPPORTED_OR_UNKNOWN: ReadonlyArray<unknown> = [
  '54.0.0',
  '54.0.31',
  '55.0.0',
  '58.0.0',
  '99.0.0',
  undefined,
  null,
  'UNVERSIONED',
  '',
  'abc',
  '53',
  53,
  {},
  [],
  true,
];

describe('getUnsupportedExpoSdkWarning', () => {
  it('the supported floor is Expo SDK 54', () => {
    expect(MIN_SUPPORTED_EXPO_SDK).toBe(54);
  });

  it.each(['53.0.0', '52.0.0', '50.0.0', '49.1.2', '1.0.0'])(
    'warns for Expo SDK %s and names the detected SDK',
    (sdkVersion) => {
      const major = Number(sdkVersion.split('.')[0]);
      expect(getUnsupportedExpoSdkWarning(sdkVersion)).toContain(
        `this project uses Expo SDK ${major}.`
      );
    }
  );

  it('says what is supported, what happened and what to do', () => {
    const warning = getUnsupportedExpoSdkWarning('53.0.0');
    expect(warning).toContain(
      '@gabriel-sisjr/react-native-background-location supports Expo SDK 54 or later'
    );
    expect(warning).toContain('React Native 0.81+');
    expect(warning).toContain('New Architecture');
    expect(warning).toContain('The plugin still applied its changes');
    expect(warning).toContain('this SDK is unsupported');
    expect(warning).toContain('Upgrade Expo to SDK 54 or later');
  });

  it.each(SUPPORTED_OR_UNKNOWN)('stays silent for %p', (sdkVersion) => {
    expect(getUnsupportedExpoSdkWarning(sdkVersion)).toBeNull();
  });
});

describe('warnUnsupportedExpoSdk', () => {
  describe('Expo SDK 53', () => {
    it('registers one dangerous mod per platform and emits nothing while the plugin is evaluated', () => {
      const config = warnUnsupportedExpoSdk(configForSdk('53.0.0'));
      expect(hasRegisteredMod(config, 'android', 'dangerous')).toBe(true);
      expect(hasRegisteredMod(config, 'ios', 'dangerous')).toBe(true);
      expect(warnAndroid).not.toHaveBeenCalled();
      expect(warnIos).not.toHaveBeenCalled();
    });

    it('warns once on Android when the Android mod runs, and not on iOS', async () => {
      const config = warnUnsupportedExpoSdk(configForSdk('53.0.0'));
      await runRegisteredMod(config, 'android', 'dangerous');
      expect(warnAndroid).toHaveBeenCalledTimes(1);
      expect(warnAndroid).toHaveBeenCalledWith(
        'warnUnsupportedExpoSdk',
        getUnsupportedExpoSdkWarning('53.0.0')
      );
      expect(warnIos).not.toHaveBeenCalled();
    });

    it('warns once on iOS when the iOS mod runs, and not on Android', async () => {
      const config = warnUnsupportedExpoSdk(configForSdk('53.0.0'));
      await runRegisteredMod(config, 'ios', 'dangerous');
      expect(warnIos).toHaveBeenCalledTimes(1);
      expect(warnIos).toHaveBeenCalledWith(
        'warnUnsupportedExpoSdk',
        getUnsupportedExpoSdkWarning('53.0.0')
      );
      expect(warnAndroid).not.toHaveBeenCalled();
    });

    it('warns exactly once per platform although Expo evaluates the plugin several times per prebuild', async () => {
      // Expo evaluates the plugin function repeatedly while it reads the
      // config, but only the mods of the final config are executed (once).
      let config = configForSdk('53.0.0');
      for (let evaluation = 0; evaluation < 4; evaluation += 1) {
        config = warnUnsupportedExpoSdk(configForSdk('53.0.0'));
      }
      expect(warnAndroid).not.toHaveBeenCalled();
      expect(warnIos).not.toHaveBeenCalled();

      await runRegisteredMod(config, 'android', 'dangerous');
      await runRegisteredMod(config, 'ios', 'dangerous');
      expect(warnAndroid).toHaveBeenCalledTimes(1);
      expect(warnIos).toHaveBeenCalledTimes(1);
    });

    it('returns the config it was given to the mod chain (never fails the prebuild)', async () => {
      const config = warnUnsupportedExpoSdk(configForSdk('53.0.0'));
      await expect(
        runRegisteredMod(config, 'android', 'dangerous')
      ).resolves.toBeUndefined();
      await expect(
        runRegisteredMod(config, 'ios', 'dangerous')
      ).resolves.toBeUndefined();
    });
  });

  describe('supported or unknown SDK', () => {
    it.each(SUPPORTED_OR_UNKNOWN)(
      'registers no mod and never warns for sdkVersion %p',
      (sdkVersion) => {
        const config = warnUnsupportedExpoSdk(configForSdk(sdkVersion));
        expect(hasRegisteredMod(config, 'android', 'dangerous')).toBe(false);
        expect(hasRegisteredMod(config, 'ios', 'dangerous')).toBe(false);
        expect(registeredMods(config)).toBeUndefined();
        expect(warnAndroid).not.toHaveBeenCalled();
        expect(warnIos).not.toHaveBeenCalled();
      }
    );
  });
});

describe('withBackgroundLocation + unsupported Expo SDK warning', () => {
  it('on Expo SDK 53 still registers every mod and keeps applying the Android permissions', async () => {
    const config = withBackgroundLocation(configForSdk('53.0.0'), {});

    expect(hasRegisteredMod(config, 'android', 'dangerous')).toBe(true);
    expect(hasRegisteredMod(config, 'ios', 'dangerous')).toBe(true);
    expect(hasRegisteredMod(config, 'android', 'manifest')).toBe(true);
    expect(hasRegisteredMod(config, 'ios', 'infoPlist')).toBe(true);
    expect(hasRegisteredMod(config, 'ios', 'finalized')).toBe(true);

    const manifest = await runAndroidManifestMod(
      config,
      createBaseAndroidManifest()
    );
    const names = (manifest.manifest['uses-permission'] ?? []).map(
      (p) => p.$['android:name']
    );
    expect(names).toContain('android.permission.ACCESS_BACKGROUND_LOCATION');
    expect(names).toHaveLength(7);
  });

  it.each(['54.0.0', '55.0.0', '58.0.0', undefined, 'UNVERSIONED', 'garbage'])(
    'leaves the mod graph untouched for sdkVersion %p',
    (sdkVersion) => {
      const config = withBackgroundLocation(configForSdk(sdkVersion), {});
      expect(hasRegisteredMod(config, 'android', 'dangerous')).toBe(false);
      expect(hasRegisteredMod(config, 'ios', 'dangerous')).toBe(false);
      expect(hasRegisteredMod(config, 'android', 'manifest')).toBe(true);
      expect(hasRegisteredMod(config, 'ios', 'finalized')).toBe(true);
    }
  );

  it('the New Architecture guard still runs first on Expo SDK 53', () => {
    const config = {
      ...configForSdk('53.0.0'),
      newArchEnabled: false,
    } as unknown as ExpoConfig;
    expect(() => withBackgroundLocation(config, {})).toThrow(PluginError);
    expect(() => withBackgroundLocation(config, {})).toThrow(
      /NEW_ARCHITECTURE_DISABLED/
    );
    expect(registeredMods(config)).toBeUndefined();
  });

  it('does not touch the props validation order (invalid props still fail first)', () => {
    expect(() =>
      withBackgroundLocation(configForSdk('53.0.0'), 'oops' as never)
    ).toThrow(/INVALID_PROPS_TYPE/);
  });
});
