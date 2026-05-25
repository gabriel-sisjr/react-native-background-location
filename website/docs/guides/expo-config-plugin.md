---
sidebar_position: 9
title: Expo Config Plugin
description: Install and configure the @gabriel-sisjr/react-native-background-location Expo config plugin — options reference, troubleshooting, and migrating from bare workflow.
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

The library ships an [Expo config plugin](https://docs.expo.dev/config-plugins/introduction/) that lets managed-workflow apps integrate background location without ejecting. Adding the plugin to your `app.json` (or `app.config.ts`) wires the Android permissions, iOS usage strings, and `UIBackgroundModes` declaration automatically on every `expo prebuild`.

## Overview

The plugin is a thin, declarative wrapper around the native module's manifest and plist requirements. It runs at `expo prebuild` time and is responsible for:

- Injecting the seven Android permissions the library needs into `AndroidManifest.xml`.
- Writing the three `NSLocation*UsageDescription` keys into `Info.plist`.
- Adding `"location"` to the `UIBackgroundModes` array.
- Optionally merging a `NSLocationTemporaryUsageDescriptionDictionary` for the forward-compat C6 feature.

The plugin is **consumer-scoped**: it touches only files inside the consumer's generated `android/` and `ios/` directories. It does not patch the library itself, register services or receivers, edit Gradle scripts, or modify the podspec — autolinking handles all of that.

If you are on the **bare workflow** and edit `AndroidManifest.xml` or `Info.plist` yourself, you do **not** need the plugin. Install it only when Expo manages your native projects.

## Prerequisites

| Requirement | Minimum | Notes |
| --- | --- | --- |
| Expo SDK | 50 | SDK 53+ recommended (matches the New Architecture defaults this library requires) |
| `ios.deploymentTarget` | `16.0` | Bumped via `expo-build-properties` — the library's podspec requires iOS 16+ |
| Node.js | 18 | Match the engine declared in your Expo project |

You also need an Expo project that uses **continuous native generation** (`expo prebuild` or EAS Build). The plugin has no effect on Expo Go builds — Expo Go cannot load custom native modules.

## Install

Install the library and the build-properties plugin via the Expo CLI so the versions resolve against your SDK:

```bash
expo install @gabriel-sisjr/react-native-background-location
expo install expo-build-properties
```

`expo-build-properties` is required to raise the iOS deployment target to 16. The library plugin does not modify the Podfile on your behalf.

## Configure

Add the plugin to the `plugins` array in `app.json` (or the equivalent `app.config.ts` / `app.config.js`). The minimal configuration uses the package name as a string entry:

```json
{
  "expo": {
    "plugins": [
      "@gabriel-sisjr/react-native-background-location",
      ["expo-build-properties", { "ios": { "deploymentTarget": "16.0" } }]
    ]
  }
}
```

Run `expo prebuild --clean` after editing `app.json`. The plugin executes during prebuild and mutates the generated `android/` and `ios/` folders.

:::tip Plugin order
The library plugin and `expo-build-properties` are independent — order does not matter. Both are idempotent and can be re-run safely.
:::

## Customize Usage Strings

iOS App Review is strict about location usage strings. The library ships sensible defaults that pass automated checks, but you should override them with copy that reflects **your** app's purpose. Pass the plugin a config object instead of the bare string entry:

```jsonc
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
            "AccurateFix": "We need precise location for in-app navigation.",
          },
        },
      ],
    ],
  },
}
```

:::caution App Review copy
The defaults shipped with the plugin are intentionally generic so they do not impersonate your product. They are **not** intended as production-ready store copy. Override every key with sentences that describe what your app actually does with location data.
:::

## What the Plugin Sets Up

### Android — `AndroidManifest.xml`

The plugin uses Expo's `AndroidConfig.Permissions.ensurePermissions` modifier (idempotent) to inject the seven permissions required by the foreground service and the location pipeline:

| Permission | Required For |
| --- | --- |
| `android.permission.ACCESS_FINE_LOCATION` | GPS-based location |
| `android.permission.ACCESS_COARSE_LOCATION` | Network-based location |
| `android.permission.ACCESS_BACKGROUND_LOCATION` | Background tracking on Android 10+ |
| `android.permission.FOREGROUND_SERVICE` | Foreground service runtime |
| `android.permission.FOREGROUND_SERVICE_LOCATION` | Typed foreground service on Android 14+ |
| `android.permission.POST_NOTIFICATIONS` | Foreground service notification on Android 13+ |
| `android.permission.WAKE_LOCK` | Keep the CPU awake for the recovery worker |

### iOS — `Info.plist`

The plugin writes three usage description keys and ensures `UIBackgroundModes` contains `location`:

| Key | Source |
| --- | --- |
| `NSLocationWhenInUseUsageDescription` | `locationWhenInUseUsageDescription` prop (or default) |
| `NSLocationAlwaysAndWhenInUseUsageDescription` | `locationAlwaysAndWhenInUseUsageDescription` prop (or default) |
| `NSLocationAlwaysUsageDescription` | `locationAlwaysUsageDescription` prop (or default) |
| `UIBackgroundModes` | `["location"]` appended (guarded against duplicates) |
| `NSLocationTemporaryUsageDescriptionDictionary` | Shallow-merged from `temporaryUsageDescriptions`, if provided |

### What the plugin does NOT set up

- Foreground services or broadcast receivers — registered by the library's `AndroidManifest.xml` and merged via autolinking.
- Gradle configuration (KSP, Room schema, Kotlin version) — declared in the library's `android/build.gradle`.
- The iOS podspec — autolinking picks it up from the published tarball.
- The iOS Privacy Manifest (`PrivacyInfo.xcprivacy`) — bundled inside the pod and not regenerated by the plugin. Your **app-level** privacy manifest is still your responsibility.

## Verify Your Build

After updating `app.json`, regenerate the native projects:

```bash
expo prebuild --clean
```

Inspect the generated files to confirm the plugin ran:

```bash
# Android — should contain the 7 permissions listed above
grep "uses-permission" android/app/src/main/AndroidManifest.xml

# iOS — should contain the 3 NSLocation* keys and UIBackgroundModes
plutil -p "ios/$(basename "$PWD")/Info.plist" | grep -E "NSLocation|UIBackgroundModes"
```

You can also run prebuild with debug logging to confirm the plugin executed exactly once:

```bash
EXPO_DEBUG=true expo prebuild --clean
```

Look for the `withRunOnce` log line referencing `@gabriel-sisjr/react-native-background-location`.

## Troubleshooting

### `Manifest merger failed`

Almost always a version mismatch between this library's plugin and `@expo/config-plugins`. The library declares a compatible peer range, but a sibling Expo plugin can pin an incompatible version. Resolve by aligning your Expo SDK and re-running `expo install` for both the library and any other config plugins.

### `pod install` fails on `BackgroundLocation`

The iOS deployment target is below 16. Add `expo-build-properties` to your plugins array as shown in [Configure](#configure) and re-run `expo prebuild --clean`.

### Usage string rejected by App Review

The default strings are generic on purpose. Override them with consumer-specific copy in your `app.json` (see [Customize usage strings](#customize-usage-strings)) — every `NSLocation*` key should mention **why** your specific app needs location access.

### `Plugin props must be a plain object`

The plugin validates its props synchronously before mutating any file. This error means the config entry is malformed — for example, you passed an array of strings instead of `[name, propsObject]`. Compare your `plugins` array against the snippet in [Customize usage strings](#customize-usage-strings).

### Permissions appear in `AndroidManifest.xml` but the foreground service still crashes

The plugin only injects manifest declarations. Runtime permission requests are a separate concern — call `useLocationPermissions().requestPermissions()` from the hooks layer before starting tracking. See the [Permissions guide](../getting-started/permissions.md) for the full runtime flow.

## Migrating From Bare Workflow

If you previously edited `AndroidManifest.xml` and `Info.plist` by hand:

1. **Install the plugin** via `expo install @gabriel-sisjr/react-native-background-location`.
2. **Add the plugin entry** to `app.json` (see [Configure](#configure)).
3. **Remove the manual entries** from `AndroidManifest.xml` and `Info.plist` so the regenerated files come solely from the plugin. The modifiers are idempotent, but keeping stale manual entries makes audits harder.
4. **Move custom usage strings** into the plugin's `locationWhenInUseUsageDescription` / `locationAlwaysAndWhenInUseUsageDescription` / `locationAlwaysUsageDescription` props.
5. **Re-run `expo prebuild --clean`** to regenerate both native folders.
6. **Verify** with the commands in [Verify your build](#verify-your-build) — they should produce the same surface area as your previous manual setup.

No JavaScript imports change. Your existing call sites continue to compile and run.

## Options Reference

All props are optional. Pass them in the second position of the plugin tuple: `["@gabriel-sisjr/react-native-background-location", { ... }]`.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `locationWhenInUseUsageDescription` | `string` | App-Review-safe generic string mentioning `$(PRODUCT_NAME)` | Writes the iOS `NSLocationWhenInUseUsageDescription` key in `Info.plist`. Must be a non-empty, non-whitespace string. |
| `locationAlwaysAndWhenInUseUsageDescription` | `string` | App-Review-safe generic background-location string mentioning `$(PRODUCT_NAME)` | Writes the iOS `NSLocationAlwaysAndWhenInUseUsageDescription` key in `Info.plist`. Must be a non-empty, non-whitespace string. |
| `locationAlwaysUsageDescription` | `string` | App-Review-safe generic always-on string mentioning `$(PRODUCT_NAME)` | Writes the iOS `NSLocationAlwaysUsageDescription` key (legacy, iOS < 11 compatibility). Must be a non-empty, non-whitespace string. |
| `temporaryUsageDescriptions` | `Record<string, string>` | _(omitted)_ | Shallow-merged into `NSLocationTemporaryUsageDescriptionDictionary`. Keys are purpose strings referenced by the upcoming `requestTemporaryFullAccuracy(purposeKey:)` API (C6); values must be non-empty App-Review-safe strings. |

The typed export lives in [`plugin/src/options/types.ts`](https://github.com/gabriel-sisjr/react-native-background-location/blob/develop/plugin/src/options/types.ts) — pull it into TypeScript-authored Expo configs with:

```ts
import type { BackgroundLocationPluginProps } from '@gabriel-sisjr/react-native-background-location/plugin/build/options/types';
```

## Forward-Compat: `temporaryUsageDescriptions` and C6

`temporaryUsageDescriptions` exists today as a **forward-compat hook** for the upcoming C6 roadmap item ([ROADMAP.md](https://github.com/gabriel-sisjr/react-native-background-location/blob/develop/ROADMAP.md)), which adds `requestTemporaryFullAccuracy(purposeKey:)` for short-lived precise-location requests on iOS 14+.

Setting `temporaryUsageDescriptions` in v0.18.x:

- **Does** write the `NSLocationTemporaryUsageDescriptionDictionary` into `Info.plist`.
- **Does** survive future plugin upgrades — the schema is stable.
- **Does not** wire any runtime API yet. The matching `requestTemporaryFullAccuracy` method ships in C6.

You can safely declare your purpose keys now so that when C6 lands, no `Info.plist` edit is needed — only a code-side method call.

## Caveats and Known Limitations

- **iOS deployment target is the consumer's responsibility.** The plugin does not raise `ios.deploymentTarget`. Use `expo-build-properties` as shown in [Configure](#configure).
- **No Privacy Manifest generation.** The library bundles its own `PrivacyInfo.xcprivacy`. Your app-level privacy manifest must still declare location data collection for App Store submissions on iOS 17+.
- **Bare workflow consumers should NOT install the plugin.** If you maintain `AndroidManifest.xml` and `Info.plist` by hand, the plugin adds nothing new and overlaps with your manual edits.
- **Expo Go is unsupported.** The library uses TurboModules and a foreground service; Expo Go cannot load custom native modules. Use a [development build](https://docs.expo.dev/develop/development-builds/introduction/) or EAS Build.
- **Runtime permissions still required.** The plugin only manages manifest declarations — the runtime flow lives in the [`useLocationPermissions` hook](../getting-started/permissions.md).
