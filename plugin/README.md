# @gabriel-sisjr/react-native-background-location — Expo Config Plugin

Contributor-facing notes. End-user documentation lives in the
[Expo Config Plugin guide](https://gabriel-sisjr.github.io/react-native-background-location/docs/guides/expo-config-plugin)
(`website/docs/guides/expo-config-plugin.md`). This file is not published to npm.

## What it does

`withBackgroundLocation` validates the props, runs the New Architecture guard
(invalid props or a disabled New Architecture throw `PluginError` before any
modifier is registered, so a half-applied config can never escape) and then
chains the modifiers:

| Step                           | Source                                       | Effect                                                                                                                                                                                                                                                                              |
| ------------------------------ | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `validatePluginProps`          | `src/options/validate.ts`                    | Rejects invalid or unknown props with `PluginError` (an unknown option, including one inside `motionActivity`, throws `UNKNOWN_PROP` and lists the supported ones; a `motionActivity` that is not a plain object throws `INVALID_MOTION_ACTIVITY`).                                 |
| `assertNewArchitectureEnabled` | `src/guards/assertNewArchitectureEnabled.ts` | Throws `PluginError` (`NEW_ARCHITECTURE_DISABLED`) when the New Architecture is explicitly disabled on Expo SDK 54 or earlier. Expo SDK 55+ ignores the flag.                                                                                                                       |
| `warnUnsupportedExpoSdk`       | `src/guards/warnUnsupportedExpoSdk.ts`       | Prints a non-fatal warning, once per platform, when the project uses an Expo SDK older than 54. Never throws and stays silent when the SDK is unknown (missing or `UNVERSIONED`).                                                                                                   |
| `withAndroidPermissions`       | `src/android/withAndroidPermissions.ts`      | Ensures the seven permissions declared by the library's `AndroidManifest.xml` are present in the app manifest. With `motionActivity`, also adds `android.permission.ACTIVITY_RECOGNITION` and `com.google.android.gms.permission.ACTIVITY_RECOGNITION` (`android:maxSdkVersion="28"` only on an entry it adds); entries the app already declares are never duplicated or modified. |
| `withIosUsageStrings`          | `src/ios/withIosUsageStrings.ts`             | Writes the `NSLocation*UsageDescription` keys (prop, then existing value, then default), adds `location` to `UIBackgroundModes` once, and merges `temporaryUsageDescriptions`. With `motionActivity`, also writes `NSMotionUsageDescription` (`motionActivity.usageDescription`, then existing value, then default). |
| `withIosMotionActivity`        | `src/ios/withIosMotionActivity.ts`           | Registered only when `motionActivity` is present. Inserts `$BackgroundLocationMotionActivity = true` (after a comment line) before the first `target '<name>' do` of `ios/Podfile`, so the podspec compiles the CoreMotion code. Idempotent; never removes the line (dropping the prop needs `expo prebuild --clean`). Without a `target` line it leaves the Podfile unchanged and adds a prebuild warning. Tested in `withIosMotionActivity.test.ts`. |
| `withIosDeploymentTarget`      | `src/ios/withIosDeploymentTarget.ts`         | Raises the iOS deployment target to 16.0 (the podspec minimum) in `ios/Podfile.properties.json` and in every `IPHONEOS_DEPLOYMENT_TARGET` of `project.pbxproj`. Never lowers a higher value. Runs as a finalized mod, so it runs after every regular mod whatever the plugin order. |

## Design notes

- **Imports come from `expo/config-plugins`**, never from the standalone
  config-plugins package. `expo` re-exports the version that matches the installed SDK,
  so the plugin always runs against the copy Expo's own tooling uses. `expo` is
  an optional peer dependency (`"*"`): the bare React Native part of the package
  does not need it.
- **Evaluating the plugin function must stay pure.** Expo evaluates a config
  plugin several times per prebuild, so file I/O and logging belong in mods. That
  is why the SDK warning is emitted from a dangerous mod (mods run once per
  platform and per prebuild) and why the deployment target is a finalized mod.
- **The deployment target is a finalized mod on purpose.** Regular mods
  registered under the same name (for example `podfileProperties`) run in
  reverse plugin order, so a regular mod would be overwritten by
  `expo-build-properties` whenever that plugin is listed before this one.
  Finalized mods run after every regular mod, but finalized mods of different
  plugins also run in reverse plugin order: a plugin that is listed before this
  one and writes the deployment target from its own finalized mod runs after it.
  On an untouched Expo SDK 56+ template the default is already above 16.0 and
  the mod changes nothing.
- **`config.sdkVersion` drives the SDK-aware guard and warning**
  (`src/utils/expoSdk.ts`). A missing or `UNVERSIONED` value never triggers
  them. The deployment-target mod does not depend on it: it reads the template
  default from the generated `ios/Podfile`
  (`platform :ios, podfile_properties['ios.deploymentTarget'] || '15.1'`) and
  falls back to the SDK number (below 56 means 15.1) only when that line cannot
  be parsed. It writes the key only when that default is below 16.0, so a 16.4
  template (SDK 56+) is never lowered, even with a stale `sdkVersion`.
- **Every error has a stable code.** `PluginError` exposes `code`
  (`PluginErrorCode` in `src/errors/PluginError.ts`). Document new codes in the
  user guide.

## Layout

| Path                         | Role                                                                                                                             |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `app.plugin.js`              | Repo-root entry shim; `require()`s `./plugin/build`.                                                                             |
| `app.plugin.d.ts`            | Repo-root type stub that re-exports `./plugin/build`, so `<pkg>/app.plugin` has types under `moduleResolution: node`. Published. |
| `plugin/src/`                | TypeScript sources. Not published to npm.                                                                                        |
| `plugin/src/index.ts`        | Default export (`createRunOncePlugin` wrapper); re-exports `PluginError` and types.                                              |
| `plugin/src/__tests__/`      | Jest tests, snapshots, fixtures and the `makeConfig.ts` helpers that run mods.                                                   |
| `plugin/build/`              | Compiled JS + `.d.ts` consumed by `app.plugin.js`. Published.                                                                    |
| `plugin/tsconfig.json`       | Standalone Node-target tsconfig. Does not extend the root tsconfig.                                                              |
| `plugin/tsconfig.tests.json` | Same options, re-includes the tests that `tsconfig.json` excludes (`noEmit`).                                                    |

## Scripts

- `yarn build:plugin` — one-shot compile of `plugin/src` into `plugin/build`.
  `yarn prepare` runs it before building the library.
- `yarn watch:plugin` — incremental rebuild during plugin development.
- `yarn test --selectProjects plugin` — plugin tests (`-u` updates snapshots).
- `yarn typecheck:plugin:tests` — type-check the tests, which `plugin/tsconfig.json` excludes.
- `yarn workspace example-expo prebuild` (or `prebuild:android` / `prebuild:ios`)
  followed by `./scripts/assert-expo-prebuild-output.sh <android|ios>` — run the
  plugin end to end on `example-expo/`, as CI does. The generated
  `example-expo/android` and `example-expo/ios` directories are git-ignored.

## Further reading

- [Expo Config Plugin guide](https://gabriel-sisjr.github.io/react-native-background-location/docs/guides/expo-config-plugin) for end-user documentation.
