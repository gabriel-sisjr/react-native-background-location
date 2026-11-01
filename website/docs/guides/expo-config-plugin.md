---
sidebar_position: 9
title: Expo Config Plugin
description: Install and configure the @gabriel-sisjr/react-native-background-location Expo config plugin — supported SDK versions, options reference, troubleshooting, and migrating from bare workflow.
keywords:
  - expo
  - config plugin
  - app.json
  - prebuild
  - managed workflow
  - react-native
  - background-location
---

# Expo Config Plugin

The library ships an [Expo config plugin](https://docs.expo.dev/config-plugins/introduction/) that lets managed-workflow apps integrate background location without ejecting. Adding the plugin to your `app.json` (or `app.config.ts`) wires the Android permissions, iOS usage strings, `UIBackgroundModes` declaration, and the iOS 16.0 deployment target automatically on every `expo prebuild`.

## Overview

The plugin is a thin, declarative wrapper around the native module's manifest, plist, and project requirements. It runs at `expo prebuild` time and is responsible for:

- Injecting the seven Android permissions the library needs into `AndroidManifest.xml` (nine with the [`motionActivity`](#motionactivity) prop).
- Writing the three `NSLocation*UsageDescription` keys into `Info.plist`.
- Adding `"location"` to the `UIBackgroundModes` array.
- Raising the iOS deployment target to 16.0 when your project is set lower (a higher value is left untouched).
- Stopping `expo prebuild` (and any other Expo command that loads your config) with a `PluginError` when the New Architecture is explicitly disabled, because the library only works on the New Architecture.
- Printing a warning when your project uses an Expo SDK older than 54.
- Optionally merging a `NSLocationTemporaryUsageDescriptionDictionary` (see [`temporaryUsageDescriptions`](#temporaryusagedescriptions)).
- Optionally, with the [`motionActivity`](#motionactivity) prop, preparing the native projects for motion activity: two Android activity-recognition permissions, `NSMotionUsageDescription`, and a Podfile flag that compiles the library's CoreMotion code.

The plugin is **consumer-scoped**: it touches only files inside the consumer's generated `android/` and `ios/` directories. It does not patch the library itself, register services or receivers, edit Gradle scripts, or modify the podspec — autolinking handles all of that. It edits the generated `ios/Podfile` only for the `motionActivity` prop, to set the flag that the podspec reads.

If you are on the **bare workflow** and edit `AndroidManifest.xml` or `Info.plist` yourself, you do **not** need the plugin. Install it only when Expo manages your native projects.

## Prerequisites

| Requirement | Minimum | Notes |
| --- | --- | --- |
| Library version | 1.1.0 | The first release that ships the config plugin (`app.plugin.js`); 1.0.x does not have it. Check with `npm ls @gabriel-sisjr/react-native-background-location`. |
| Expo SDK | 54 | React Native 0.81 and React 19.1. SDK 50–53 are not supported. See [Supported Expo SDK versions](#supported-expo-sdk-versions). |
| Node.js | 20.19.4 | Required by Expo SDK 54. Newer SDKs raise this minimum — follow the Expo documentation for your SDK. |
| Xcode | 16.1 | Required by Expo SDK 54 for iOS builds. Newer SDKs raise this minimum (SDK 55 already requires Xcode 26) — follow the Expo documentation for your SDK. |
| Android `compileSdk` | 35 | Expo SDK 54 builds with 36, so this only matters if you override `android.compileSdkVersion` (for example through `expo-build-properties`). The library does not compile with a lower value. |
| iOS deployment target | 16.0 | Raised automatically by the plugin — no `expo-build-properties` needed. |
| New Architecture | Enabled | The default on Expo SDK 54. The plugin stops `expo prebuild` and any other Expo command that loads your config if you disable it. |

You also need an Expo project that uses **continuous native generation** (`expo prebuild` or EAS Build) and a [development build](https://docs.expo.dev/develop/development-builds/introduction/). The plugin has no effect in Expo Go: Expo Go ships a fixed set of native modules and cannot load this library's native code.

## Supported Expo SDK versions

Expo SDK 54 is the minimum supported version. SDK 50–53 are not supported: the plugin still applies its changes there, but it prints a warning during `expo prebuild`, and builds and runtime behavior are not guaranteed. The warning never fails the prebuild.

The table lists what each SDK bundles, what the plugin does for the iOS deployment target, and what is verified in this repository's continuous integration (CI).

| Expo SDK | React Native | React | Expo's default iOS deployment target | iOS deployment target with the plugin | New Architecture | Verified |
| --- | --- | --- | --- | --- | --- | --- |
| 54 | 0.81 | 19.1 | 15.1 | Raised to 16.0 | On by default; `newArchEnabled: false` is possible but makes the plugin fail | Plugin prebuild plus native Android and iOS builds in CI |
| 55 | 0.83 | 19.2 | 15.1 | Raised to 16.0 | Always on (Expo no longer allows disabling it) | Plugin prebuild and package install in CI; native builds not verified |
| 56 | 0.85 | 19.2 | 16.4 | Unchanged (already higher) | Always on | Plugin prebuild and package install in CI; native builds not verified |
| 57 | 0.86 | 19.2 | 16.4 | Unchanged (already higher) | Always on | Plugin prebuild and package install in CI; native builds not verified |
| 58 | 0.88 | 19.3 | 16.4 | Unchanged (already higher) | Always on | Plugin prebuild and package install in CI; native builds not verified |

React Native and React versions come from each SDK's `bundledNativeModules.json`; iOS defaults come from each SDK's `Expo.podspec` and the Expo SDK documentation.

**What "Verified" means.** On SDK 54, CI runs `expo prebuild` with the plugin on the `example-expo` app and then builds that app natively for Android and for the iOS Simulator. For every SDK from 54 to 58, CI also installs the packed npm package into a fresh Expo app and runs `expo prebuild` on it, checking the generated manifest, `Info.plist` and iOS deployment target. Native builds are not run on SDK 55–58, and SDKs newer than 58 are not covered at all, so treat those as unverified.

## Install

Install the library with the Expo CLI:

```bash
npx expo install @gabriel-sisjr/react-native-background-location
```

The plugin ships inside the package and imports its helpers from `expo/config-plugins`, which is part of the `expo` package your project already has, so there is nothing else to install. You do **not** need `expo-build-properties` for this library.

## Configure

Add the plugin to the `plugins` array in `app.json` (or the equivalent `app.config.ts` / `app.config.js`). The minimal configuration uses the package name as a string entry:

```json
{
  "expo": {
    "plugins": ["@gabriel-sisjr/react-native-background-location"]
  }
}
```

Run `npx expo prebuild --clean` after editing `app.json`. The plugin executes during prebuild and mutates the generated `android/` and `ios/` folders.

:::tip Using expo-build-properties?
You do not need it for this library. If you use it (or the built-in `ios.deploymentTarget` of newer SDKs) for other reasons, keep the iOS deployment target at `16.0` or higher: the plugin only raises lower values and never lowers a higher one. The order of `expo-build-properties` and this plugin in `plugins` does not matter for the deployment target, because the plugin applies it after `expo-build-properties` has run. If you also set `android.compileSdkVersion`, keep it at `35` or higher.
:::

## Customize Usage Strings

iOS App Review is strict about location usage strings. The library ships sensible defaults that pass automated checks, but you should override them with copy that reflects **your** app's purpose. Pass the plugin a config object instead of the bare string entry:

```json
{
  "expo": {
    "plugins": [
      [
        "@gabriel-sisjr/react-native-background-location",
        {
          "locationWhenInUseUsageDescription": "We use your location to track your shift in real time.",
          "locationAlwaysAndWhenInUseUsageDescription": "We need background location to record your route during shifts.",
          "locationAlwaysUsageDescription": "We use your location even when the app is closed to support clock-out reminders.",
          "temporaryUsageDescriptions": {
            "AccurateFix": "We need precise location for in-app navigation."
          }
        }
      ]
    ]
  }
}
```

Each key resolves in this order: the plugin prop, then a value already set in `ios.infoPlist` or by a plugin listed after this one, then the library default. A plugin listed before this one runs its modifier after this plugin's, so if it sets the same key explicitly (for example `expo-location` with `locationAlwaysAndWhenInUsePermission`), its value replaces the one resolved here and Expo prints no warning. Set each usage string in one place, or list this plugin first.

:::caution App Review copy
The defaults shipped with the plugin are intentionally generic so they do not impersonate your product. They are **not** intended as production-ready store copy. Override every key with sentences that describe what your app actually does with location data.
:::

## What the Plugin Sets Up

### Android — `AndroidManifest.xml`

The plugin uses Expo's `AndroidConfig.Permissions.ensurePermissions` modifier (idempotent) to make sure the permissions required by the foreground service and the location pipeline are present in the generated app manifest: seven without the `motionActivity` prop, nine with it. The library's own `AndroidManifest.xml` declares the seven listed here and is merged into the app manifest by Gradle's manifest merger:

| Permission | Required For |
| --- | --- |
| `android.permission.ACCESS_FINE_LOCATION` | GPS-based location |
| `android.permission.ACCESS_COARSE_LOCATION` | Network-based location |
| `android.permission.ACCESS_BACKGROUND_LOCATION` | Background tracking on Android 10+ |
| `android.permission.FOREGROUND_SERVICE` | Foreground service runtime |
| `android.permission.FOREGROUND_SERVICE_LOCATION` | Typed foreground service on Android 14+ |
| `android.permission.POST_NOTIFICATIONS` | Foreground service notification on Android 13+ |
| `android.permission.RECEIVE_BOOT_COMPLETED` | Restore registered geofences after a device reboot |

With the [`motionActivity`](#motionactivity) prop, the plugin adds two more permissions. The library's own manifest declares neither of them, so without the prop they are not added:

| Permission | Required For |
| --- | --- |
| `android.permission.ACTIVITY_RECOGNITION` | Motion activity on Android 10+ (runtime permission) |
| `com.google.android.gms.permission.ACTIVITY_RECOGNITION` | Motion activity on Android 9 and lower (granted at install time) |

The plugin writes `android:maxSdkVersion="28"` on the Google Play services entry only when it adds that entry itself. An entry your app already declares is never duplicated or modified.

### iOS — `Info.plist`

The plugin writes three usage description keys (four with the `motionActivity` prop) and ensures `UIBackgroundModes` contains `location`:

| Key | Source |
| --- | --- |
| `NSLocationWhenInUseUsageDescription` | `locationWhenInUseUsageDescription` prop (then an existing value, then the default) |
| `NSLocationAlwaysAndWhenInUseUsageDescription` | `locationAlwaysAndWhenInUseUsageDescription` prop (then an existing value, then the default) |
| `NSLocationAlwaysUsageDescription` | `locationAlwaysUsageDescription` prop (then an existing value, then the default) |
| `UIBackgroundModes` | `["location"]` appended (guarded against duplicates) |
| `NSLocationTemporaryUsageDescriptionDictionary` | Shallow-merged from `temporaryUsageDescriptions`, if provided |
| `NSMotionUsageDescription` | Only with `motionActivity`: the `motionActivity.usageDescription` prop (then an existing value, then the default) |

### iOS — `Podfile`

Only with the `motionActivity` prop, the plugin inserts these two lines before the first `target '<name>' do` line of the generated `ios/Podfile`:

```ruby
# Motion activity (CoreMotion) for @gabriel-sisjr/react-native-background-location, added by its config plugin.
$BackgroundLocationMotionActivity = true
```

When CocoaPods reads the library's podspec, the flag makes it compile the CoreMotion code and link the `CoreMotion` framework. The change is idempotent: a Podfile that already sets `$BackgroundLocationMotionActivity = true` is left as it is. If the Podfile has no `target` line, the plugin leaves it unchanged and prints a `withIosMotionActivity` warning; the app still builds, and at runtime iOS reports `MOTION_ACTIVITY_UNAVAILABLE` while tracking continues at full accuracy (see [Motion activity is not compiled into this app](#motion-activity-is-not-compiled-into-this-app)). The plugin never removes the lines, so run `npx expo prebuild --clean` after removing the prop.

### iOS — deployment target

The library needs iOS 16.0 or later (its podspec declares it). Expo SDK 54 and 55 generate projects with a deployment target of 15.1, so the plugin raises it for you:

- It raises `ios.deploymentTarget` in `ios/Podfile.properties.json` (read by the generated `Podfile`) and every plain `IPHONEOS_DEPLOYMENT_TARGET` below 16.0 in the Xcode project (`project.pbxproj`) to `16.0`.
- When `ios.deploymentTarget` is not set, the plugin reads the default from your generated `ios/Podfile` (the value after `||` in its `platform :ios` line) and writes `16.0` only when that default is lower. If the line cannot be read, the plugin falls back to your Expo SDK version (it writes `16.0` below SDK 56 and nothing from SDK 56 on).
- A value that is already `16.0` or higher is never lowered, so a higher target you chose stays as it is.
- It runs after the regular modifiers of every other plugin (`expo-build-properties` included), so the result does not depend on where the plugin sits in the `plugins` array relative to them. The one exception is another plugin that also writes the deployment target from a finalized modifier (`withFinalizedMod`): it runs after this plugin when it is listed before it, so list this plugin before it. It is safe to combine with `expo-build-properties`.
- If you explicitly configured a value below `16.0` (for example `ios.deploymentTarget` in `expo-build-properties`), the plugin still raises it to `16.0` and prints a `withIosDeploymentTarget` warning so the override does not go unnoticed. Set the target to `16.0` or higher to silence the warning.
- On Expo SDK 56 and later the SDK's own default is already `16.4`, so with no explicit setting the plugin changes nothing. If you did set `ios.deploymentTarget` below that yourself, remove it or raise it to `16.4`: Expo SDK 56 and later cannot build with a lower value, and raising it to `16.0` is not enough.

### New Architecture

The library is a TurboModule and only works on the React Native New Architecture. Expo SDK 54 enables it by default and SDK 55 and later cannot turn it off, so only SDK 54 and earlier need attention: SDK 54 is the last SDK where `newArchEnabled: false` is possible. On those SDKs, the plugin stops `expo prebuild` (and any other Expo command that loads your config) with a [`NEW_ARCHITECTURE_DISABLED`](#new_architecture_disabled) error when `newArchEnabled` is explicitly `false` at the top level of your Expo config, under `ios` or `android`, or in the `ios` / `android` options of `expo-build-properties`. The check covers both platforms, so it also applies to `expo prebuild --platform android`. Unset or `true` values pass.

### What the plugin does NOT set up

- Foreground services or broadcast receivers — registered by the library's `AndroidManifest.xml` and merged into the app manifest by Gradle's manifest merger.
- Gradle configuration (KSP, Room schema, Kotlin version) — declared in the library's `android/build.gradle`.
- The iOS podspec — autolinking picks it up from the published tarball.
- The iOS Privacy Manifest (`PrivacyInfo.xcprivacy`) — bundled inside the pod and neither generated nor modified by the plugin. The library's manifest declares precise and coarse location collection and its use of the `UserDefaults` required-reason API (reason `CA92.1`). Your **app-level** privacy manifest is still your responsibility.
- The default notification icon and accent color (the `com.backgroundlocation.default_notification_*` meta-data entries and the `bg_location_notification_icon` / `bg_location_notification_large_icon` drawables). The plugin has no option for them, and anything you add by hand under `android/` is deleted by `npx expo prebuild --clean`. Set `color`, `smallIcon` and `largeIcon` in `notificationOptions` at runtime instead (the icons must be drawables that already exist in the app; see [Notification Customization](./notification-customization.md)). The start-up and crash-recovery notifications read only the static defaults, so the runtime options do not change their icon.

## Verify Your Build

After updating `app.json`, regenerate the native projects:

```bash
npx expo prebuild --clean
```

Inspect the generated files to confirm the plugin ran:

```bash
# Android — should contain the 7 permissions listed above (9 with motionActivity)
grep "uses-permission" android/app/src/main/AndroidManifest.xml

# iOS (macOS) — should contain the 3 NSLocation* keys and UIBackgroundModes
plutil -p "$(find ios -maxdepth 2 -name Info.plist -not -path '*/Pods/*' | head -n 1)" | grep -E -A2 "NSLocation|UIBackgroundModes"

# iOS (any OS, plutil is macOS-only) — the same check on the raw XML
grep -A2 -E 'NSLocation|UIBackgroundModes' ios/*/Info.plist

# iOS — the deployment target should be 16.0 or higher
grep ios.deploymentTarget ios/Podfile.properties.json
grep IPHONEOS_DEPLOYMENT_TARGET ios/*.xcodeproj/project.pbxproj

# iOS, only with motionActivity — the Podfile flag and the motion usage string
grep -n BackgroundLocationMotionActivity ios/Podfile
grep -A1 NSMotionUsageDescription ios/*/Info.plist
```

On Expo SDK 54 and 55, the first deployment target command prints `"ios.deploymentTarget": "16.0"` and every line of the second ends in `16.0;` (a higher value that you configured yourself is kept). From SDK 56 the Expo default of `16.4` applies: the first command prints nothing and the second prints `16.4;`.

## Troubleshooting

### `Unable to resolve a valid config plugin`

`expo prebuild` stops with an error like:

```text
PluginError: Unable to resolve a valid config plugin for @gabriel-sisjr/react-native-background-location.
• No "app.plugin.js" file found in @gabriel-sisjr/react-native-background-location: config plugins are typically exported from an "app.plugin.js" file in the package root.
```

The installed copy of the library is older than 1.1.0, the first release that contains `app.plugin.js`. Expo's closing hint to remove the entry from `plugins` does not apply here, and a second bullet about the library's main file not being a config plugin is a side effect of the missing file.

**Fix.** Run `npm ls @gabriel-sisjr/react-native-background-location`. If it prints `1.0.x`, upgrade with `npx expo install @gabriel-sisjr/react-native-background-location`, then run `npx expo prebuild --clean` again.

### `NEW_ARCHITECTURE_DISABLED`

`expo prebuild` stops with:

```text
PluginError: [react-native-background-location/plugin] NEW_ARCHITECTURE_DISABLED: @gabriel-sisjr/react-native-background-location requires the React Native New Architecture, but it is disabled in your Expo config
```

The message lists every place where the New Architecture is turned off: `newArchEnabled: false` at the top level of your Expo config, under `ios` or `android`, or in the `ios` / `android` options of `expo-build-properties`. The library does not work on the legacy architecture, and the check covers both platforms, so `expo prebuild --platform android` stops as well.

The error is thrown whenever Expo loads your config with the plugin applied, so it is not limited to `expo prebuild`: `npx expo start` and `npx expo config` exit with the same error, and so do the EAS CLI commands that read your config. EAS CLI reads it through `expo config --json`, which exits with code 1 without printing anything, so run `npx expo config` to see the message. Expo prints the error and then its stack trace, which starts with the same text, so the message appears twice.

The plugin fails this early on purpose: with the New Architecture disabled, the iOS build still succeeds and the app then crashes at startup (see [the startup crash](#the-app-crashes-at-startup-with-backgroundlocation-could-not-be-found)). The legacy architecture is not supported on Android either.

**Fix.** Remove `newArchEnabled: false` from `app.json` / `app.config.*` and the `newArchEnabled` options from `expo-build-properties` (or set them to `true`), then run `npx expo prebuild --clean`. Expo SDK 54 enables the New Architecture by default, and SDK 55 and later always run on it, so the check only applies to SDK 54 and earlier.

### The app crashes at startup with `'BackgroundLocation' could not be found`

The app crashes on launch (a red screen in development) with:

```text
Invariant Violation: TurboModuleRegistry.getEnforcing(...): 'BackgroundLocation' could not be found. Verify that a module by this name is registered in the native binary.
```

The JavaScript package is installed, but the app that is running does not contain the library's native code. Check, in this order:

1. **The app is running in Expo Go.** Expo Go ships a fixed set of native modules and cannot load this library. Create a [development build](https://docs.expo.dev/develop/development-builds/introduction/) (`npx expo run:android`, `npx expo run:ios` or EAS Build) instead.
2. **The development build is older than the library.** Adding the library or the plugin changes the native projects. Run `npx expo prebuild --clean`, then build and install the app again.
3. **(SDK 54 only) The New Architecture was switched off by hand** in the generated iOS project (`"newArchEnabled": "false"` in `ios/Podfile.properties.json`). The plugin only checks your Expo config, so it cannot see this. Remove the setting and run `npx expo prebuild --clean` again.

### Android build fails because `onTimeout` overrides nothing

Kotlin reports that `onTimeout` in the library's `LocationService.kt` overrides nothing. The library is being compiled against an Android SDK older than 35, usually because of an `android.compileSdkVersion` override in `expo-build-properties`; Expo SDK 54 builds with 36 by default. Remove the override or raise it to `35` or higher, then run `npx expo prebuild --clean` and rebuild.

### `pod install` fails on `BackgroundLocation`

CocoaPods reports `required a higher minimum deployment target` because the iOS deployment target is below 16.0. The plugin raises it during `expo prebuild`, so this means the plugin did not run, or `ios/` was changed after the prebuild. Check that `"@gabriel-sisjr/react-native-background-location"` is listed in `plugins`, make sure nothing else (for example a manual edit of `ios/Podfile.properties.json`) sets the target below `16.0`, and run `npx expo prebuild --clean` again.

On Expo SDK 56 and later, Expo itself needs a deployment target of `16.4`. If `pod install` fails there, remove any `ios.deploymentTarget` override from your config or set it to `16.4` or higher.

### Motion activity is not compiled into this app

On iOS, a trip started with the `motionActivity` tracking option emits a `MOTION_ACTIVITY_UNAVAILABLE` warning with this message, and tracking continues at full accuracy:

```text
Motion activity is not compiled into this app. Set $BackgroundLocationMotionActivity = true in the Podfile (or add the motionActivity plugin prop) and reinstall pods. Location tracking continues at full accuracy.
```

The installed app was built without the Podfile flag. Check, in this order:

1. **The `motionActivity` prop is missing** from the plugin entry. Add it (see [`motionActivity`](#motionactivity)).
2. **The build is older than the prop.** Run `npx expo prebuild --clean`, then build and install the app again.
3. **The prebuild printed a `withIosMotionActivity` warning** saying that no `target '<name>' do` line was found in `ios/Podfile`. The plugin then leaves the Podfile unchanged. Add `$BackgroundLocationMotionActivity = true` above the first `target` yourself and run `pod install`.

### `MOTION_PERMISSION_NOT_GRANTED` after adding `motionActivity`

The prop declares the permissions and the usage string, but it does not request anything at runtime. Call `requestMotionPermission()` after the location permissions and before `startTracking()`; until the permission is granted, trips run at full accuracy and report this warning. See [Motion Activity Permission](./permission-handling.md#motion-activity-permission).

### Usage string rejected by App Review

The default strings are generic on purpose. Override them with consumer-specific copy in your `app.json` (see [Customize usage strings](#customize-usage-strings)) — every `NSLocation*` key should mention **why** your specific app needs location access. The same applies to `NSMotionUsageDescription`: set `motionActivity.usageDescription` to say why your app uses motion activity.

### Plugin error codes

The plugin validates its options synchronously, when your config is loaded and before it changes any file, and reports every problem as a `PluginError`. Each message starts with `[react-native-background-location/plugin]` and one of the codes below, for example `[react-native-background-location/plugin] UNKNOWN_PROP: Unknown plugin option: ...`. The codes are stable: the exported `PluginError` class (from `@gabriel-sisjr/react-native-background-location/app.plugin`) carries the same value in its `code` property.

| Code | Cause | Fix |
| --- | --- | --- |
| `INVALID_PROPS_TYPE` | The options in the second position of the plugin entry are not an object, for example a string or an array: `Plugin props must be a plain object. Received string.` | Pass `["@gabriel-sisjr/react-native-background-location", { ... }]`, or only the package name when you set no options. Compare your `plugins` array with the snippet in [Customize usage strings](#customize-usage-strings). |
| `UNKNOWN_PROP` | The options object has a key the plugin does not have: a typo such as `locationWhenInUseUsageDescripton`, or an option of another plugin such as `locationWhenInUsePermission` from `expo-location`. The message lists the unknown keys and the supported options: `` Unknown plugin option: `locationWhenInUseUsageDescripton`. Supported options: ... `` Keys inside `motionActivity` are checked the same way and reported with their path: `` Unknown plugin option: `motionActivity.usageDescripton`. Supported options: `motionActivity.usageDescription`. `` | Rename or remove the key. The supported options are in the [Options Reference](#options-reference). |
| `INVALID_USAGE_DESCRIPTION` | One of `locationWhenInUseUsageDescription`, `locationAlwaysAndWhenInUseUsageDescription`, `locationAlwaysUsageDescription` or `motionActivity.usageDescription` is not a string (a number or `null`, for example): `` `locationWhenInUseUsageDescription` must be a string when provided. Received number. `` Or it is empty or whitespace-only: `` `locationWhenInUseUsageDescription` must not be empty or whitespace-only. `` | Pass a non-empty string, or remove the option to keep the default. |
| `INVALID_TEMPORARY_USAGE_DESCRIPTIONS` | `temporaryUsageDescriptions` is not an object, for example an array of strings: `` `temporaryUsageDescriptions` must be a plain object mapping purpose keys to usage strings. `` | Pass an object that maps purpose keys to strings, for example `{ "AccurateFix": "..." }`. See [`temporaryUsageDescriptions`](#temporaryusagedescriptions). |
| `INVALID_TEMPORARY_USAGE_DESCRIPTION_VALUE` | One value of `temporaryUsageDescriptions` is not a string or is empty or whitespace-only. The message names the key: `` `temporaryUsageDescriptions["AccurateFix"]` must be a non-empty string. Received number. `` | Give every purpose key a non-empty string. |
| `INVALID_MOTION_ACTIVITY` | `motionActivity` is not a plain object, for example `true`, `null`, an array or a string: `` `motionActivity` must be a plain object (use `{}` to opt in with the default usage string). Received boolean. `` | Pass an object: `{}` for the default usage string, or `{ "usageDescription": "..." }`. Remove the key to leave motion activity off. |
| `NEW_ARCHITECTURE_DISABLED` | The New Architecture is explicitly disabled in your Expo config (SDK 54 and earlier). | See [`NEW_ARCHITECTURE_DISABLED`](#new_architecture_disabled) above. |

### Permissions appear in `AndroidManifest.xml` but the foreground service still crashes

The plugin only injects manifest declarations. Runtime permission requests are a separate concern — call `useLocationPermissions().requestPermissions()` from the hooks layer before starting tracking. See the [Permissions guide](../getting-started/permissions.md) for the full runtime flow.

## Migrating From Bare Workflow

:::caution This hands your native folders over to Expo
Follow these steps only if you want Expo to generate `android/` and `ios/` from now on (continuous native generation, see [Prerequisites](#prerequisites)). Step 5 deletes both folders and regenerates them from Expo's template, so everything else you changed in them is lost: `MainApplication` / `AppDelegate` edits, Gradle and Podfile changes, signing configuration and the manual setup of other libraries. Commit your work first, and make sure every other native customization is expressed as a config plugin (or an Expo `patch-project` patch) before you continue. If you want to keep maintaining the native projects yourself, do not install the plugin.
:::

If you previously edited `AndroidManifest.xml` and `Info.plist` by hand:

1. **Upgrade the library to 1.1.0 or later** (the plugin ships from 1.1.0): `npx expo install @gabriel-sisjr/react-native-background-location`.
2. **Add the plugin entry** to `app.json` (see [Configure](#configure)). If you added `expo-build-properties` only to raise `ios.deploymentTarget` to 16.0 for this library, you can remove that entry.
3. **If you prebuild without `--clean`, remove the manual entries** from `AndroidManifest.xml` and `Info.plist` so the files come solely from the plugin (`--clean` regenerates both files anyway). The modifiers are idempotent, but keeping stale manual entries makes audits harder.
4. **Move custom usage strings** into the plugin's `locationWhenInUseUsageDescription` / `locationAlwaysAndWhenInUseUsageDescription` / `locationAlwaysUsageDescription` props. If you use motion activity, also add the [`motionActivity`](#motionactivity) prop and move your `NSMotionUsageDescription` text into `motionActivity.usageDescription`: the prop replaces the hand-added activity-recognition permissions and Podfile flag, which step 5 deletes.
5. **Run `npx expo prebuild --clean`.** It deletes both native folders and regenerates them with the plugin applied.
6. **Verify** with the commands in [Verify your build](#verify-your-build) — they should produce the same surface area as your previous manual setup.

No JavaScript imports change. Your existing call sites continue to compile and run.

## Options Reference

All props are optional. Pass them in the second position of the plugin tuple: `["@gabriel-sisjr/react-native-background-location", { ... }]`. Any other key, including an unknown key inside `motionActivity`, is rejected with an `UNKNOWN_PROP` error that lists the supported options (see [Plugin error codes](#plugin-error-codes)), so a misspelled name fails the prebuild instead of silently falling back to the default copy. List the plugin once in `plugins`: if the same package appears twice, Expo applies only the first entry and skips the others without validating them.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `locationWhenInUseUsageDescription` | `string` | Generic string mentioning `$(PRODUCT_NAME)` | Writes the iOS `NSLocationWhenInUseUsageDescription` key in `Info.plist`. Must be a non-empty, non-whitespace string. |
| `locationAlwaysAndWhenInUseUsageDescription` | `string` | Generic background-location string mentioning `$(PRODUCT_NAME)` | Writes the iOS `NSLocationAlwaysAndWhenInUseUsageDescription` key in `Info.plist`. Must be a non-empty, non-whitespace string. |
| `locationAlwaysUsageDescription` | `string` | Generic always-on string mentioning `$(PRODUCT_NAME)` | Writes the iOS `NSLocationAlwaysUsageDescription` key (legacy, iOS < 11 compatibility). Must be a non-empty, non-whitespace string. |
| `temporaryUsageDescriptions` | `Record<string, string>` | _(omitted)_ | Shallow-merged into `NSLocationTemporaryUsageDescriptionDictionary`. Keys are purpose keys for `requestTemporaryFullAccuracyAuthorization(withPurposeKey:)`; values must be non-empty strings. See [`temporaryUsageDescriptions`](#temporaryusagedescriptions). |
| `motionActivity` | `MotionActivityPluginProps` | _(omitted: off)_ | Opt-in for motion activity; its presence turns it on, even as `{}`. Adds the two Android activity-recognition permissions, `NSMotionUsageDescription` and the iOS Podfile flag. Must be a plain object. See [`motionActivity`](#motionactivity). |
| `motionActivity.usageDescription` | `string` | `Allow $(PRODUCT_NAME) to use motion activity to detect when you are stationary or driving.` | Writes the iOS `NSMotionUsageDescription` key in `Info.plist`. When omitted, a value already in `Info.plist` is kept; otherwise the default is written. Must be a non-empty, non-whitespace string. |

The props type is exported from the plugin entry point (source: [`plugin/src/options/types.ts`](https://github.com/gabriel-sisjr/react-native-background-location/blob/develop/plugin/src/options/types.ts)). Use `import type` so nothing from the plugin is loaded at runtime:

```ts
import type { BackgroundLocationPluginProps } from '@gabriel-sisjr/react-native-background-location/app.plugin';
```

For example, in an `app.config.ts`:

```ts
import type { ExpoConfig } from 'expo/config';
import type { BackgroundLocationPluginProps } from '@gabriel-sisjr/react-native-background-location/app.plugin';

const backgroundLocation: BackgroundLocationPluginProps = {
  locationWhenInUseUsageDescription:
    'We use your location to track your shift in real time.',
};

const config: ExpoConfig = {
  name: 'my-app',
  slug: 'my-app',
  plugins: [
    ['@gabriel-sisjr/react-native-background-location', backgroundLocation],
  ],
};

export default config;
```

The type of the `motionActivity` object, `MotionActivityPluginProps`, is exported from the same entry point; see [`motionActivity`](#motionactivity) for an example.

## `temporaryUsageDescriptions`

`temporaryUsageDescriptions` fills the `NSLocationTemporaryUsageDescriptionDictionary` that iOS 14 and later use for temporary full-accuracy requests (`CLLocationManager.requestTemporaryFullAccuracyAuthorization(withPurposeKey:)`). Each key is a purpose key and each value is the text shown to the user.

- It **does** write the dictionary into `Info.plist`, merging it into any dictionary that already exists (the prop wins when both define the same purpose key).
- It **does not** add a library API: the library never calls `requestTemporaryFullAccuracyAuthorization`, so the entries are only used by your own native code or by another library that does.

When the prop is omitted, the dictionary is left untouched.

## `motionActivity`

`motionActivity` prepares the native projects for the library's opt-in motion activity detection. The prop is available from library version 1.2.0. Its presence turns it on, even as an empty object. Without it, the prebuild output is unchanged: exactly the seven library permissions, no `NSMotionUsageDescription` key and no Podfile line.

```json
{
  "expo": {
    "plugins": [
      [
        "@gabriel-sisjr/react-native-background-location",
        {
          "motionActivity": {
            "usageDescription": "We use motion activity to detect when your vehicle is parked."
          }
        }
      ]
    ]
  }
}
```

Use `"motionActivity": {}` to keep the default usage string. In `app.config.ts`, type the object with the exported `MotionActivityPluginProps`:

```ts
import type { ExpoConfig } from 'expo/config';
import type { MotionActivityPluginProps } from '@gabriel-sisjr/react-native-background-location/app.plugin';

const motionActivity: MotionActivityPluginProps = {
  usageDescription:
    'We use motion activity to detect when your vehicle is parked.',
};

const config: ExpoConfig = {
  name: 'my-app',
  slug: 'my-app',
  plugins: [
    ['@gabriel-sisjr/react-native-background-location', { motionActivity }],
  ],
};

export default config;
```

With the prop, the plugin:

- **Android:** adds `android.permission.ACTIVITY_RECOGNITION` and `com.google.android.gms.permission.ACTIVITY_RECOGNITION`. The second entry gets `android:maxSdkVersion="28"` only when the plugin adds it, and entries your app already declares are never duplicated or modified.
- **iOS:** writes `NSMotionUsageDescription`, resolved in this order: `motionActivity.usageDescription`, then a value already in `Info.plist` (for example from `ios.infoPlist`), then the default `Allow $(PRODUCT_NAME) to use motion activity to detect when you are stationary or driving.` It also inserts the `$BackgroundLocationMotionActivity = true` flag before the first `target` of the Podfile.

[What the Plugin Sets Up](#what-the-plugin-sets-up) shows the exact entries. The library's privacy manifest does not change. On Google Play, `ACTIVITY_RECOGNITION` is health-related sensitive data: show a prominent disclosure and request the permission only after the user accepts it, complete the Health apps declaration, and declare motion-derived data that leaves the device in the Data safety form under Health and fitness > Fitness info (see [Google Play Compliance](../production/google-play-compliance.md#motion-activity-optional)). Declare such data in your App Store privacy details as well.

The prop only prepares the native projects. Your JavaScript still turns detection on per trip with the `motionActivity` tracking option and requests the permission with `requestMotionPermission()` before `startTracking()`; see the [Motion Activity guide](./motion-activity.md#expo-setup).

The default usage string is generic. Replace it with copy that says why your app uses motion activity before you submit to App Review. Removing the prop later requires `npx expo prebuild --clean`, because an incremental prebuild does not remove the permissions, the usage string or the Podfile line.

## Caveats and Known Limitations

- **The iOS deployment target is raised, never lowered.** The plugin sets 16.0 when your project is lower. Keep any other setting at 16.0 or higher.
- **Usage strings depend on plugin order.** A plugin listed before this one that sets the same `NSLocation*UsageDescription` key explicitly (for example `expo-location`) overrides the prop. Set each string in one place, or list this plugin first.
- **No privacy manifest changes.** The library bundles its own `PrivacyInfo.xcprivacy` (location collection plus the `UserDefaults` required-reason API, reason `CA92.1`); the plugin does not touch it. Your app-level privacy manifest must still declare location data collection for App Store submissions on iOS 17+.
- **Bare workflow consumers should NOT install the plugin.** If you maintain `AndroidManifest.xml` and `Info.plist` by hand, the plugin adds nothing new and overlaps with your manual edits.
- **Expo Go is unsupported.** Expo Go ships a fixed set of native modules and cannot load this library's Kotlin/Swift code. Use a [development build](https://docs.expo.dev/develop/development-builds/introduction/) or EAS Build.
- **The New Architecture must stay enabled.** The plugin stops `expo prebuild` and any other Expo command that loads your config if it is explicitly disabled (SDK 54 is the last SDK where that is possible).
- **Expo SDK 54 or later.** SDK 50–53 are not supported; the plugin prints a warning there.
- **Runtime permissions still required.** The plugin only manages manifest declarations — the runtime flow lives in the [`useLocationPermissions` hook](../getting-started/permissions.md).
- **Removing `motionActivity` needs a clean prebuild.** An incremental prebuild does not remove the permissions, the usage string or the Podfile line the prop added; run `npx expo prebuild --clean`.
