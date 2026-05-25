import type { AndroidConfig } from '@expo/config-plugins';

type AndroidManifest = AndroidConfig.Manifest.AndroidManifest;

/**
 * Returns a fresh, minimal `AndroidManifest` shape used as the baseline
 * input for Phase 5 snapshot tests of the Android-side plugin modifiers.
 *
 * - Bare `<manifest>` root with the standard `xmlns:android` declaration.
 * - Empty `<application/>` child (no activities, services, receivers).
 * - Zero `<uses-permission>` entries.
 *
 * Each invocation returns a brand-new object graph so snapshot tests that
 * mutate the fixture cannot leak state across cases.
 */
export const createBaseAndroidManifest = (): AndroidManifest => ({
  manifest: {
    $: {
      'xmlns:android': 'http://schemas.android.com/apk/res/android',
    },
    queries: [],
    application: [
      {
        $: {
          'android:name': '.MainApplication',
        },
      },
    ],
  },
});
