import {
  AndroidConfig,
  withAndroidManifest,
  type ConfigPlugin,
} from 'expo/config-plugins';
import type { BackgroundLocationPluginProps } from '../options/types';

/**
 * The seven Android permissions owned by this library's
 * `android/src/main/AndroidManifest.xml`. Re-injected defensively so that
 * `expo prebuild` produces a manifest containing them even if the consumer
 * never declares them in their own `app.json` / `AndroidManifest.xml`.
 *
 * Kept module-private on purpose — the list is an implementation detail of
 * the Android side of the plugin. Changing it requires updating the snapshot in
 * `__tests__/__snapshots__/withAndroidPermissions.test.ts.snap`.
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

/**
 * Runtime permission for activity recognition on Android 10 (API 29) and
 * newer. Added only when the `motionActivity` prop is present: the library
 * manifest never declares it, so apps that do not use motion activity never
 * request it.
 */
const ACTIVITY_RECOGNITION_PERMISSION =
  'android.permission.ACTIVITY_RECOGNITION';

/**
 * Install-time Google Play services permission that grants activity
 * recognition on Android 9 (API 28) and older. Capped with
 * `android:maxSdkVersion="28"` when the plugin adds it, because newer
 * versions use {@link ACTIVITY_RECOGNITION_PERMISSION} instead.
 */
const PLAY_SERVICES_ACTIVITY_RECOGNITION_PERMISSION =
  'com.google.android.gms.permission.ACTIVITY_RECOGNITION';

const PLAY_SERVICES_PERMISSION_MAX_SDK_VERSION = '28';

/**
 * Adds the two activity-recognition permissions for the `motionActivity`
 * prop. `ensurePermission` returns `true` only when it appended a new
 * `<uses-permission>` node, so the `android:maxSdkVersion` cap is set only on
 * the entry this plugin created. An entry the app already declares is never
 * duplicated or modified.
 */
function ensureMotionActivityPermissions(
  manifest: AndroidConfig.Manifest.AndroidManifest
): void {
  AndroidConfig.Permissions.ensurePermission(
    manifest,
    ACTIVITY_RECOGNITION_PERMISSION
  );

  const addedPlayServicesPermission =
    AndroidConfig.Permissions.ensurePermission(
      manifest,
      PLAY_SERVICES_ACTIVITY_RECOGNITION_PERMISSION
    );
  if (!addedPlayServicesPermission) return;

  const node = manifest.manifest['uses-permission']?.find(
    (permission) =>
      permission.$['android:name'] ===
      PLAY_SERVICES_ACTIVITY_RECOGNITION_PERMISSION
  );
  if (node) {
    // `AndroidManifestAttributes` does not declare `android:maxSdkVersion`,
    // so the attribute is merged in; the manifest builder writes every
    // attribute present on `$`.
    Object.assign(node.$, {
      'android:maxSdkVersion': PLAY_SERVICES_PERMISSION_MAX_SDK_VERSION,
    });
  }
}

/**
 * Defensive Android permission injector.
 *
 * Uses `AndroidConfig.Permissions.ensurePermissions`, which mutates the
 * supplied `AndroidManifest` in place and returns a `Record<string, boolean>`
 * summary where `true` marks a permission that was added and `false` one that
 * was already present. The summary is intentionally discarded — assigning it
 * back to `cfg.modResults` would clobber the manifest object with the summary
 * record and break the build.
 *
 * When the `motionActivity` prop is present, it also adds
 * `android.permission.ACTIVITY_RECOGNITION` and
 * `com.google.android.gms.permission.ACTIVITY_RECOGNITION` (capped at
 * `android:maxSdkVersion="28"`). Without the prop, the manifest gets exactly
 * the seven library permissions.
 *
 * The helper is idempotent: calling it twice with the same permission list
 * produces a byte-identical manifest.
 */
export const withAndroidPermissions: ConfigPlugin<
  BackgroundLocationPluginProps
> = (config, props) => {
  return withAndroidManifest(config, (cfg) => {
    AndroidConfig.Permissions.ensurePermissions(cfg.modResults, [
      ...LIBRARY_PERMISSIONS,
    ]);
    if (props.motionActivity) {
      ensureMotionActivityPermissions(cfg.modResults);
    }
    return cfg;
  });
};
