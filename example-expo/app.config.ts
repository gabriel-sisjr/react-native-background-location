import type { ExpoConfig } from 'expo/config';

/**
 * Expo managed-workflow demo app exercising the
 * `@gabriel-sisjr/react-native-background-location` config plugin.
 *
 * This app is intentionally minimal — its single role is to give CI a
 * project on which to run `expo prebuild` and verify that the plugin
 * correctly mutates AndroidManifest.xml and Info.plist.
 *
 * Both the default path (the plugin's built-in usage-string defaults)
 * and the override path (`locationWhenInUseUsageDescription` +
 * `temporaryUsageDescriptions`) are exercised so the Phase 5 CI smoke
 * job can prove the precedence chain works end-to-end.
 */
const config: ExpoConfig = {
  name: 'example-expo',
  slug: 'example-expo',
  version: '1.0.0',
  ios: {
    bundleIdentifier: 'com.backgroundlocation.exampleexpo',
  },
  android: {
    package: 'com.backgroundlocation.exampleexpo',
  },
  plugins: [
    [
      '@gabriel-sisjr/react-native-background-location',
      {
        // Exercise the override path for at least one usage string.
        locationWhenInUseUsageDescription:
          'example-expo needs your location while you use the app.',
        // Forward-compat C6 knob exercised here too.
        temporaryUsageDescriptions: {
          AccurateFix:
            'example-expo needs accurate location for the demo screen.',
        },
      },
    ],
    [
      'expo-build-properties',
      {
        ios: { deploymentTarget: '16.0' },
        android: {
          compileSdkVersion: 34,
          targetSdkVersion: 34,
          minSdkVersion: 24,
        },
      },
    ],
  ],
};

export default config;
