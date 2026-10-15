import type { ExpoConfig } from 'expo/config';

/**
 * Expo managed-workflow demo app exercising the
 * `@gabriel-sisjr/react-native-background-location` config plugin.
 *
 * This app is intentionally minimal — its single role is to give CI a
 * project on which to run `expo prebuild` and verify that the plugin
 * correctly mutates AndroidManifest.xml, Info.plist and the iOS
 * deployment target.
 *
 * Both the default path (the plugin's built-in usage-string defaults)
 * and the override path (`locationWhenInUseUsageDescription` +
 * `temporaryUsageDescriptions`) are exercised so the `expo prebuild` CI
 * jobs can prove the precedence chain works end-to-end.
 *
 * There is deliberately no `expo-build-properties` entry and no
 * `ios.deploymentTarget`: the plugin raises the iOS deployment target to
 * the library minimum (16.0) by itself, and the same jobs prove that it
 * does.
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
        // Exercise the `temporaryUsageDescriptions` merge.
        temporaryUsageDescriptions: {
          AccurateFix:
            'example-expo needs accurate location for the demo screen.',
        },
      },
    ],
  ],
};

export default config;
