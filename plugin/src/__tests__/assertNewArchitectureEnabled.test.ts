import type { ConfigPlugin } from 'expo/config-plugins';
import { PluginError } from '../errors/PluginError';
import {
  LAST_SDK_WITH_NEW_ARCH_TOGGLE,
  assertNewArchitectureEnabled,
} from '../guards/assertNewArchitectureEnabled';
import { withBackgroundLocation } from '../withBackgroundLocation';

type ExpoConfig = Parameters<ConfigPlugin<unknown>>[0];

/**
 * `newArchEnabled` only exists in the SDK 54 typings, so the configs under test
 * are built loosely and cast once. This also mirrors what a user can write in
 * app.json regardless of the installed SDK.
 */
const makeConfig = (extra: Record<string, unknown> = {}): ExpoConfig =>
  ({
    name: 'app',
    slug: 'app',
    sdkVersion: '54.0.0',
    ios: {},
    android: {},
    ...extra,
  }) as unknown as ExpoConfig;

const catchError = (config: ExpoConfig): PluginError => {
  try {
    assertNewArchitectureEnabled(config);
  } catch (e) {
    return e as PluginError;
  }
  throw new Error('expected assertNewArchitectureEnabled to throw');
};

describe('assertNewArchitectureEnabled', () => {
  it('last toggleable SDK is 54', () => {
    expect(LAST_SDK_WITH_NEW_ARCH_TOGGLE).toBe(54);
  });

  describe('SDK 54: accepts every configuration that does not explicitly disable it', () => {
    it.each([
      ['key absent (Expo default is enabled)', {}],
      ['top-level true', { newArchEnabled: true }],
      [
        'ios true / android true',
        {
          ios: { newArchEnabled: true },
          android: { newArchEnabled: true },
        },
      ],
      ['string "true"', { newArchEnabled: 'true' }],
      ['null is treated as absent', { newArchEnabled: null }],
      [
        'platform true overrides top-level false for ios, android also true',
        {
          newArchEnabled: false,
          ios: { newArchEnabled: true },
          android: { newArchEnabled: true },
        },
      ],
    ])('%s', (_label, extra) => {
      expect(() =>
        assertNewArchitectureEnabled(makeConfig(extra))
      ).not.toThrow();
    });
  });

  describe('SDK 54: rejects an explicit false', () => {
    it('top-level newArchEnabled: false names both platforms', () => {
      const error = catchError(makeConfig({ newArchEnabled: false }));
      expect(error).toBeInstanceOf(PluginError);
      expect(error.code).toBe('NEW_ARCHITECTURE_DISABLED');
      expect(error.message).toContain(
        'iOS: app config: newArchEnabled = false'
      );
      expect(error.message).toContain(
        'Android: app config: newArchEnabled = false'
      );
    });

    it('ios.newArchEnabled: false names iOS only', () => {
      const error = catchError(
        makeConfig({ newArchEnabled: true, ios: { newArchEnabled: false } })
      );
      expect(error.message).toContain(
        'iOS: app config: ios.newArchEnabled = false'
      );
      expect(error.message).not.toContain('Android:');
    });

    it('android.newArchEnabled: false names Android only', () => {
      const error = catchError(
        makeConfig({ android: { newArchEnabled: false } })
      );
      expect(error.message).toContain(
        'Android: app config: android.newArchEnabled = false'
      );
      expect(error.message).not.toContain('iOS:');
    });

    it('top-level false with an ios override of true only fails for Android', () => {
      const error = catchError(
        makeConfig({ newArchEnabled: false, ios: { newArchEnabled: true } })
      );
      expect(error.message).toContain('Android:');
      expect(error.message).not.toContain('iOS:');
    });

    it('a null ios value falls back to the top-level false (Expo uses ??)', () => {
      // A bare toThrow() would also pass if the null fell through, because
      // Android (undefined) throws for the same top-level false. Assert on iOS.
      const error = catchError(
        makeConfig({ newArchEnabled: false, ios: { newArchEnabled: null } })
      );
      expect(error.message).toContain(
        'iOS: app config: newArchEnabled = false'
      );
    });

    it('the string "false" counts (Expo SDK 54 compares toString() to "false")', () => {
      expect(() =>
        assertNewArchitectureEnabled(makeConfig({ newArchEnabled: 'false' }))
      ).toThrow(PluginError);
    });

    it('SDK 53 and lower are guarded too', () => {
      expect(() =>
        assertNewArchitectureEnabled(
          makeConfig({ sdkVersion: '53.0.0', newArchEnabled: false })
        )
      ).toThrow(PluginError);
    });
  });

  describe('SDK 54: expo-build-properties (deprecated ios/android.newArchEnabled props)', () => {
    it('ios.newArchEnabled: false in the plugin props is rejected even when the app config says true', () => {
      const error = catchError(
        makeConfig({
          newArchEnabled: true,
          plugins: [
            ['expo-build-properties', { ios: { newArchEnabled: false } }],
          ],
        })
      );
      expect(error.message).toContain(
        'iOS: expo-build-properties: ios.newArchEnabled = false'
      );
    });

    it('android.newArchEnabled: false in the plugin props is rejected', () => {
      const error = catchError(
        makeConfig({
          plugins: [
            ['expo-build-properties', { android: { newArchEnabled: false } }],
          ],
        })
      );
      expect(error.message).toContain(
        'Android: expo-build-properties: android.newArchEnabled = false'
      );
    });

    it('expo-build-properties true wins over app config false (it runs later in prebuild)', () => {
      expect(() =>
        assertNewArchitectureEnabled(
          makeConfig({
            newArchEnabled: false,
            plugins: [
              [
                'expo-build-properties',
                {
                  ios: { newArchEnabled: true },
                  android: { newArchEnabled: true },
                },
              ],
            ],
          })
        )
      ).not.toThrow();
    });

    it.each([
      ['bare string entry', ['expo-build-properties']],
      [
        'unrelated plugin with the same prop',
        [['some-plugin', { ios: { newArchEnabled: false } }]],
      ],
      ['function entries are ignored', [() => undefined]],
      ['props that are not an object', [['expo-build-properties', 'nope']]],
      ['plugins that is not an array', 'expo-build-properties'],
      ['empty plugin props', [['expo-build-properties', {}]]],
    ])('ignores %s', (_label, plugins) => {
      expect(() =>
        assertNewArchitectureEnabled(makeConfig({ plugins }))
      ).not.toThrow();
    });
  });

  describe('SDK gate: the flag is ignored from SDK 55, so the guard must not fire', () => {
    it.each(['55.0.0', '56.0.0', '57.0.0', '58.0.0', '99.0.0'])(
      'SDK %s with every flag false does not throw',
      (sdkVersion) => {
        expect(() =>
          assertNewArchitectureEnabled(
            makeConfig({
              sdkVersion,
              newArchEnabled: false,
              ios: { newArchEnabled: false },
              android: { newArchEnabled: false },
              plugins: [
                [
                  'expo-build-properties',
                  {
                    ios: { newArchEnabled: false },
                    android: { newArchEnabled: false },
                  },
                ],
              ],
            })
          )
        ).not.toThrow();
      }
    );

    it.each([undefined, 'UNVERSIONED', '', 54])(
      'unknown sdkVersion %p does not throw (no false positives)',
      (sdkVersion) => {
        expect(() =>
          assertNewArchitectureEnabled(
            makeConfig({ sdkVersion, newArchEnabled: false })
          )
        ).not.toThrow();
      }
    );
  });

  describe('error contract', () => {
    it('uses the plugin prefix, a stable code, an actionable fix and detail', () => {
      const error = catchError(makeConfig({ newArchEnabled: false }));
      expect(error.name).toBe('PluginError');
      expect(error.message).toMatch(
        /^\[react-native-background-location\/plugin\] NEW_ARCHITECTURE_DISABLED: /
      );
      expect(error.message).toContain(
        'requires the React Native New Architecture'
      );
      expect(error.message).toContain('newArchEnabled: false');
      expect(error.message).toContain('npx expo prebuild --clean');
      expect(error.message).toContain('Expo SDK 55+ always enables it');
      expect(error.detail).toMatchObject({ sdkVersion: '54.0.0' });
    });

    it('states the real failure mode: the build succeeds, the app crashes at startup', () => {
      const error = catchError(makeConfig({ newArchEnabled: false }));
      expect(error.message).toContain('the native build still succeeds');
      expect(error.message).toContain('on iOS the app crashes at startup');
      expect(error.message).toContain(
        "TurboModuleRegistry.getEnforcing('BackgroundLocation')"
      );
      expect(error.message).toContain('as soon as the package is imported');
      expect(error.message).toContain(
        'The legacy architecture is not supported on Android either.'
      );
    });

    it('keeps the verification evidence out of the end-user message', () => {
      const error = catchError(makeConfig({ newArchEnabled: false }));
      expect(error.message).not.toContain('verified');
    });
  });
});

describe('withBackgroundLocation + New Architecture guard', () => {
  it('throws before registering any mod, leaving the config untouched', () => {
    const config = makeConfig({ newArchEnabled: false });
    expect(() => withBackgroundLocation(config, {})).toThrow(PluginError);
    expect((config as { mods?: unknown }).mods).toBeUndefined();
  });

  it('props validation still runs first', () => {
    const config = makeConfig({ newArchEnabled: false });
    expect(() => withBackgroundLocation(config, 'oops' as never)).toThrow(
      /INVALID_PROPS_TYPE/
    );
  });

  it('registers all mods when the New Architecture is not disabled', () => {
    const config = withBackgroundLocation(
      makeConfig({ newArchEnabled: true }),
      {}
    );
    const mods = (config as { mods?: Record<string, Record<string, unknown>> })
      .mods;
    expect(mods?.android?.manifest).toBeDefined();
    expect(mods?.ios?.infoPlist).toBeDefined();
    expect(mods?.ios?.finalized).toBeDefined();
  });

  it('does not block SDK 55+ even with a stale newArchEnabled: false', () => {
    const config = makeConfig({ sdkVersion: '55.0.0', newArchEnabled: false });
    expect(() => withBackgroundLocation(config, {})).not.toThrow();
  });
});
