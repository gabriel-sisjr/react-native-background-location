import { withBackgroundLocation } from '../withBackgroundLocation';
import { createBaseAndroidManifest } from './fixtures/baseAndroidManifest';
import { runAndroidManifestMod } from './utils/makeConfig';
import type { AndroidConfig, ConfigPlugin } from '@expo/config-plugins';

type AndroidManifest = AndroidConfig.Manifest.AndroidManifest;
type ExpoConfig = Parameters<ConfigPlugin<unknown>>[0];

/**
 * The seven Android permissions this library owns. Kept in sync with
 * `plugin/src/android/withAndroidPermissions.ts#LIBRARY_PERMISSIONS`.
 * Listed here, not imported, so a regression in either file is caught
 * by the test rather than silently masked.
 */
const LIBRARY_PERMISSIONS: ReadonlyArray<string> = [
  'android.permission.ACCESS_FINE_LOCATION',
  'android.permission.ACCESS_COARSE_LOCATION',
  'android.permission.ACCESS_BACKGROUND_LOCATION',
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_LOCATION',
  'android.permission.POST_NOTIFICATIONS',
  'android.permission.RECEIVE_BOOT_COMPLETED',
];

const baseExpoConfig = (): ExpoConfig => ({
  name: 'app',
  slug: 'app',
  ios: {},
  android: {},
});

const collectPermissionNames = (manifest: AndroidManifest): string[] => {
  const perms = manifest.manifest['uses-permission'] ?? [];
  return perms.map((p) => p.$['android:name']);
};

describe('withAndroidPermissions', () => {
  it('injects exactly the 7 library permissions on a clean manifest', async () => {
    const config = withBackgroundLocation(baseExpoConfig(), {});
    const result = await runAndroidManifestMod(
      config,
      createBaseAndroidManifest()
    );

    expect(result).toMatchSnapshot();
    expect(collectPermissionNames(result).sort()).toEqual(
      [...LIBRARY_PERMISSIONS].sort()
    );
  });

  it('is idempotent on a second pass', async () => {
    // First pass — register and run the mod against a clean manifest.
    const firstConfig = withBackgroundLocation(baseExpoConfig(), {});
    const firstResult = await runAndroidManifestMod(
      firstConfig,
      createBaseAndroidManifest()
    );

    // Second pass — re-apply the plugin on a config whose manifest already
    // carries the seven library permissions. Result must be byte-identical.
    const secondConfig = withBackgroundLocation(baseExpoConfig(), {});
    const secondResult = await runAndroidManifestMod(secondConfig, firstResult);

    expect(secondResult).toEqual(firstResult);
  });

  it('does not inject services, receivers, or application children', async () => {
    const baseline = createBaseAndroidManifest();
    const baselineApplication = baseline.manifest.application;

    const config = withBackgroundLocation(baseExpoConfig(), {});
    const result = await runAndroidManifestMod(config, baseline);

    // The application array shape is preserved exactly — no new <service>,
    // <receiver>, <activity>, or <provider> nodes were introduced by the
    // plugin. The plugin owns permissions only; native-component registration
    // is the responsibility of the library's own AndroidManifest.xml.
    expect(result.manifest.application).toEqual(baselineApplication);
  });

  it('preserves existing unrelated permissions on the host manifest', async () => {
    const baseline = createBaseAndroidManifest();
    // Pre-seed an unrelated permission a host app might own.
    baseline.manifest['uses-permission'] = [
      {
        $: { 'android:name': 'android.permission.CAMERA' },
      },
    ];

    const config = withBackgroundLocation(baseExpoConfig(), {});
    const result = await runAndroidManifestMod(config, baseline);

    const names = new Set(collectPermissionNames(result));
    expect(names.has('android.permission.CAMERA')).toBe(true);
    for (const perm of LIBRARY_PERMISSIONS) {
      expect(names.has(perm)).toBe(true);
    }
    // Total = 7 library + 1 host = 8, with no duplicates.
    expect(names.size).toBe(LIBRARY_PERMISSIONS.length + 1);
  });
});
