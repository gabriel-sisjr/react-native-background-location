import { withBackgroundLocation } from '../withBackgroundLocation';
import { createBaseAndroidManifest } from './fixtures/baseAndroidManifest';
import { runAndroidManifestMod } from './utils/makeConfig';
import type { AndroidConfig, ConfigPlugin } from 'expo/config-plugins';

type AndroidManifest = AndroidConfig.Manifest.AndroidManifest;
type ManifestUsesPermission = AndroidConfig.Manifest.ManifestUsesPermission;
type ExpoConfig = Parameters<ConfigPlugin<unknown>>[0];

/** Added only when the `motionActivity` prop is present. */
const ACTIVITY_RECOGNITION = 'android.permission.ACTIVITY_RECOGNITION';
const PLAY_SERVICES_ACTIVITY_RECOGNITION =
  'com.google.android.gms.permission.ACTIVITY_RECOGNITION';

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

/** Every `<uses-permission>` node with the given name. */
const findPermissions = (
  manifest: AndroidManifest,
  name: string
): ManifestUsesPermission[] =>
  (manifest.manifest['uses-permission'] ?? []).filter(
    (p) => p.$['android:name'] === name
  );

/**
 * A `<uses-permission>` node, optionally with attributes the Expo type does
 * not declare (such as `android:maxSdkVersion`).
 */
const permissionNode = (
  name: string,
  extraAttributes: Record<string, string> = {}
): ManifestUsesPermission => {
  const node: ManifestUsesPermission = { $: { 'android:name': name } };
  Object.assign(node.$, extraAttributes);
  return node;
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

  describe('motionActivity prop', () => {
    it('adds neither activity-recognition permission without the prop', async () => {
      const config = withBackgroundLocation(baseExpoConfig(), {});
      const result = await runAndroidManifestMod(
        config,
        createBaseAndroidManifest()
      );

      const names = collectPermissionNames(result);
      expect(names).not.toContain(ACTIVITY_RECOGNITION);
      expect(names).not.toContain(PLAY_SERVICES_ACTIVITY_RECOGNITION);
    });

    it('adds both activity-recognition permissions exactly once next to the 7 library permissions', async () => {
      const config = withBackgroundLocation(baseExpoConfig(), {
        motionActivity: {},
      });
      const result = await runAndroidManifestMod(
        config,
        createBaseAndroidManifest()
      );

      const names = collectPermissionNames(result);
      expect([...names].sort()).toEqual(
        [
          ...LIBRARY_PERMISSIONS,
          ACTIVITY_RECOGNITION,
          PLAY_SERVICES_ACTIVITY_RECOGNITION,
        ].sort()
      );
      expect(findPermissions(result, ACTIVITY_RECOGNITION)).toHaveLength(1);
      expect(
        findPermissions(result, PLAY_SERVICES_ACTIVITY_RECOGNITION)
      ).toHaveLength(1);
    });

    it('caps the Play services entry at android:maxSdkVersion 28 and leaves the platform entry uncapped', async () => {
      const config = withBackgroundLocation(baseExpoConfig(), {
        motionActivity: { usageDescription: 'Only used on iOS' },
      });
      const result = await runAndroidManifestMod(
        config,
        createBaseAndroidManifest()
      );

      expect(
        findPermissions(result, PLAY_SERVICES_ACTIVITY_RECOGNITION)[0]?.$
      ).toEqual({
        'android:name': PLAY_SERVICES_ACTIVITY_RECOGNITION,
        'android:maxSdkVersion': '28',
      });
      expect(findPermissions(result, ACTIVITY_RECOGNITION)[0]?.$).toEqual({
        'android:name': ACTIVITY_RECOGNITION,
      });
    });

    const declaredAttributeSets: ReadonlyArray<
      [label: string, extraAttributes: Record<string, string>]
    > = [
      ['without attributes', {}],
      ['with their own attributes', { 'android:maxSdkVersion': '27' }],
    ];

    it.each(declaredAttributeSets)(
      'neither duplicates nor modifies entries the app already declared %s',
      async (_label, extraAttributes) => {
        const declared = (name: string): ManifestUsesPermission =>
          permissionNode(name, extraAttributes);
        const baseline = createBaseAndroidManifest();
        baseline.manifest['uses-permission'] = [
          declared(ACTIVITY_RECOGNITION),
          declared(PLAY_SERVICES_ACTIVITY_RECOGNITION),
        ];

        const config = withBackgroundLocation(baseExpoConfig(), {
          motionActivity: {},
        });
        const result = await runAndroidManifestMod(config, baseline);

        const platformEntries = findPermissions(result, ACTIVITY_RECOGNITION);
        const playServicesEntries = findPermissions(
          result,
          PLAY_SERVICES_ACTIVITY_RECOGNITION
        );
        expect(platformEntries).toHaveLength(1);
        expect(playServicesEntries).toHaveLength(1);
        expect(platformEntries[0]).toEqual(declared(ACTIVITY_RECOGNITION));
        expect(playServicesEntries[0]).toEqual(
          declared(PLAY_SERVICES_ACTIVITY_RECOGNITION)
        );
      }
    );

    it('caps only the entry it adds when the app declares just the platform permission', async () => {
      const baseline = createBaseAndroidManifest();
      baseline.manifest['uses-permission'] = [
        permissionNode(ACTIVITY_RECOGNITION),
      ];

      const config = withBackgroundLocation(baseExpoConfig(), {
        motionActivity: {},
      });
      const result = await runAndroidManifestMod(config, baseline);

      expect(findPermissions(result, ACTIVITY_RECOGNITION)).toEqual([
        permissionNode(ACTIVITY_RECOGNITION),
      ]);
      expect(
        findPermissions(result, PLAY_SERVICES_ACTIVITY_RECOGNITION)[0]?.$
      ).toEqual({
        'android:name': PLAY_SERVICES_ACTIVITY_RECOGNITION,
        'android:maxSdkVersion': '28',
      });
    });

    it('keeps the cap the app chose when it declares only the Play services permission', async () => {
      const baseline = createBaseAndroidManifest();
      baseline.manifest['uses-permission'] = [
        permissionNode(PLAY_SERVICES_ACTIVITY_RECOGNITION, {
          'android:maxSdkVersion': '26',
        }),
      ];

      const config = withBackgroundLocation(baseExpoConfig(), {
        motionActivity: {},
      });
      const result = await runAndroidManifestMod(config, baseline);

      expect(
        findPermissions(result, PLAY_SERVICES_ACTIVITY_RECOGNITION)
      ).toEqual([
        permissionNode(PLAY_SERVICES_ACTIVITY_RECOGNITION, {
          'android:maxSdkVersion': '26',
        }),
      ]);
      expect(findPermissions(result, ACTIVITY_RECOGNITION)).toEqual([
        permissionNode(ACTIVITY_RECOGNITION),
      ]);
    });

    it('is idempotent on a second pass', async () => {
      const firstConfig = withBackgroundLocation(baseExpoConfig(), {
        motionActivity: {},
      });
      const firstResult = await runAndroidManifestMod(
        firstConfig,
        createBaseAndroidManifest()
      );
      // The mod mutates its input in place, so compare against a deep copy.
      const afterFirstPass = JSON.parse(
        JSON.stringify(firstResult)
      ) as AndroidManifest;

      const secondConfig = withBackgroundLocation(baseExpoConfig(), {
        motionActivity: {},
      });
      const secondResult = await runAndroidManifestMod(
        secondConfig,
        firstResult
      );

      expect(secondResult).toEqual(afterFirstPass);
      expect(collectPermissionNames(secondResult)).toHaveLength(
        LIBRARY_PERMISSIONS.length + 2
      );
    });
  });
});
