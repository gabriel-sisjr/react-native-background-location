import {
  AndroidConfig,
  withAndroidManifest,
  type ConfigPlugin,
} from '@expo/config-plugins';
import type { BackgroundLocationPluginProps } from '../options/types';

/**
 * The seven Android permissions owned by this library's
 * `android/src/main/AndroidManifest.xml`. Re-injected defensively so that
 * `expo prebuild` produces a manifest containing them even if the consumer
 * never declares them in their own `app.json` / `AndroidManifest.xml`.
 *
 * Kept module-private on purpose — the list is an implementation detail of
 * the Android side of the plugin. Changing it requires a code review and a
 * Phase 5 snapshot test update.
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
 * Defensive Android permission injector.
 *
 * Uses `AndroidConfig.Permissions.ensurePermissions`, which mutates the
 * supplied `AndroidManifest` in place and returns a `Record<string, boolean>`
 * summary of which permissions were already present. The summary is
 * intentionally discarded — assigning it back to `cfg.modResults` would
 * clobber the manifest object with the summary record and break the build.
 *
 * The helper is idempotent: calling it twice with the same permission list
 * produces a byte-identical manifest.
 */
export const withAndroidPermissions: ConfigPlugin<
  BackgroundLocationPluginProps
> = (config, _props) => {
  return withAndroidManifest(config, (cfg) => {
    AndroidConfig.Permissions.ensurePermissions(cfg.modResults, [
      ...LIBRARY_PERMISSIONS,
    ]);
    return cfg;
  });
};
