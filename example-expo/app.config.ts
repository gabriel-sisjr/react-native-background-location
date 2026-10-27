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
 * The usage strings resolve as `props -> ios.infoPlist -> library default`
 * and each link is exercised by a different key here:
 * `NSLocationWhenInUseUsageDescription` takes the plugin prop,
 * `NSLocationAlwaysUsageDescription` takes the value already declared in
 * `ios.infoPlist`, and `NSLocationAlwaysAndWhenInUseUsageDescription` falls
 * back to the library default. `UIBackgroundModes` already lists `fetch`,
 * which must survive the `location` injection. The `expo prebuild` CI jobs
 * check all of this against the values in this file. A pre-existing
 * `android.permissions` is covered by the `preexisting` variant of
 * `scripts/verify-expo-tarball.sh`.
 *
 * `motionActivity: {}` opts in to motion activity with the library defaults:
 * the two Android activity-recognition permissions, the default
 * `NSMotionUsageDescription` and the `$BackgroundLocationMotionActivity = true`
 * Podfile flag that compiles the CoreMotion code. The opt-out path (no prop)
 * is covered by the `defaults` variant of `scripts/verify-expo-tarball.sh`.
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
    // Values the plugin has to respect (see the comment above).
    infoPlist: {
      NSLocationAlwaysUsageDescription:
        'example-expo declares this in ios.infoPlist.',
      UIBackgroundModes: ['fetch'],
    },
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
        // Exercise the `temporaryUsageDescriptions` prop.
        temporaryUsageDescriptions: {
          AccurateFix:
            'example-expo needs accurate location for the demo screen.',
        },
        // Opt in to motion activity with the library defaults (see the
        // comment above).
        motionActivity: {},
      },
    ],
  ],
};

export default config;
