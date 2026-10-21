# Contributing

Contributions are always welcome, no matter how large or small!

We want this community to be friendly and respectful to each other. Please follow it in all your interactions with the project. Before contributing, please read the [code of conduct](./CODE_OF_CONDUCT.md).

## Development workflow

This project is a monorepo managed using [Yarn workspaces](https://yarnpkg.com/features/workspaces). It contains the following packages:

- The library package in the root directory, which includes the Expo config plugin in `plugin/`.
- An example app in the `example/` directory.
- An Expo example app in the `example-expo/` directory, used to exercise the config plugin with `expo prebuild`.
- The documentation site in the `website/` directory.

To get started with the project, make sure you have the correct version of [Node.js](https://nodejs.org/) installed. See the [`.nvmrc`](./.nvmrc) file for the version used in this project.

Run `yarn` in the root directory to install the required dependencies for each package:

```sh
yarn
```

> Since the project relies on Yarn workspaces, you cannot use [`npm`](https://github.com/npm/cli) for development without manually migrating.

The [example app](/example/) demonstrates usage of the library. You need to run it to test any changes you make.

It is configured to use the local version of the library, so any changes you make to the library's source code will be reflected in the example app. Changes to the library's JavaScript code will be reflected in the example app without a rebuild, but native code changes will require a rebuild of the example app.

If you want to use Android Studio or Xcode to edit the native code, you can open the `example/android` or `example/ios` directories respectively in those editors. To edit the Objective-C or Swift files, open `example/ios/BackgroundLocationExample.xcworkspace` in Xcode and find the source files at `Pods > Development Pods > @gabriel-sisjr/react-native-background-location`.

To edit the Java or Kotlin files, open `example/android` in Android studio and find the source files at `@gabriel-sisjr/react-native-background-location` under `Android`.

You can use various commands from the root directory to work with the project.

To start the packager:

```sh
yarn example start
```

To run the example app on Android:

```sh
yarn example android
```

To run the example app on iOS:

```sh
yarn example ios
```

To confirm that the app is running with the new architecture, you can check the Metro logs for a message like this:

```sh
Running "BackgroundLocationExample" with {"fabric":true,"initialProps":{"concurrentRoot":true},"rootTag":1}
```

Note the `"fabric":true` and `"concurrentRoot":true` properties.

### iOS Development

To work on the iOS native code, you will need:

- **Xcode 16.1+** installed (from the Mac App Store)
- **CocoaPods** installed (`sudo gem install cocoapods` or via Homebrew)
- An iOS simulator or physical device running iOS 16+

After modifying Swift or Objective-C files in `ios/`, rebuild the example app:

```sh
cd example/ios && pod install && cd ../..
yarn example ios
```

The iOS native source files are located at:

- `ios/BackgroundLocation.mm` -- TurboModule bridge (Objective-C++)
- `ios/*.swift` -- Swift implementation (LocationManagerWrapper, LocationStorage, RecoveryManager, etc.)

To edit the Swift files in Xcode, open `example/ios/BackgroundLocationExample.xcworkspace` and find the source files at `Pods > Development Pods > @gabriel-sisjr/react-native-background-location`.

> **Important:** When making changes that affect both platforms, test on both Android and iOS before submitting a pull request. Platform-specific behavior differences should be documented with `> **iOS:**` / `> **Android:**` callouts in the documentation.

Make sure your code passes TypeScript and ESLint. Run the following to verify:

```sh
yarn typecheck
yarn lint
```

If you changed the Expo config plugin in `plugin/`, also run `yarn typecheck:plugin:tests`. It type-checks the plugin together with its tests, which `plugin/tsconfig.json` excludes.

To fix formatting errors, run the following:

```sh
yarn lint --fix
```

Remember to add tests for your change if possible. Run the unit tests by:

```sh
yarn test
```

`yarn test` runs two Jest projects: `lib` (the library, `src/__tests__/`) and `plugin` (the Expo config plugin, `plugin/src/__tests__/`). Add `--selectProjects lib` or `--selectProjects plugin` to run only one of them.

### Commit message convention

We follow the [conventional commits specification](https://www.conventionalcommits.org/en) for our commit messages:

- `fix`: bug fixes, e.g. fix crash due to deprecated method.
- `feat`: new features, e.g. add new method to the module.
- `refactor`: code refactor, e.g. migrate from class components to hooks.
- `docs`: changes into documentation, e.g. add usage example for the module.
- `test`: adding or updating tests, e.g. add integration tests using detox.
- `chore`: tooling changes, e.g. change CI config.

Our pre-commit hooks verify that your commit message matches this format when committing.

### Linting and tests

[ESLint](https://eslint.org/), [Prettier](https://prettier.io/), [TypeScript](https://www.typescriptlang.org/)

We use [TypeScript](https://www.typescriptlang.org/) for type checking, [ESLint](https://eslint.org/) with [Prettier](https://prettier.io/) for linting and formatting the code, and [Jest](https://jestjs.io/) for testing.

Our pre-commit hooks verify that the linter and tests pass when committing.

### Publishing to npm

Releases are published by GitHub Actions, not from a developer machine. To cut a release:

1. On `develop`, bump `version` in `package.json` and update `CHANGELOG.md` (and `BREAKING_CHANGES.md` when needed) by hand. Neither file is generated. The release date in their headings is the day the release pull request is merged: fill it in now and confirm it on that pull request.
2. Open a pull request from `develop` to `main` and wait for the CI checks.
3. Merge it. The publish workflow publishes to npm when the version in `package.json` differs from the one on npm, then creates the `vX.Y.Z` tag and the GitHub release. Do not create or push that tag yourself: the workflow fails when the tag already exists.

Beta builds are published from `develop` with the manual Pre-release workflow. See [Publishing](https://gabriel-sisjr.github.io/react-native-background-location/docs/development/publishing) for the details.

### Scripts

The `package.json` file contains various scripts for common tasks:

- `yarn`: setup project by installing dependencies.
- `yarn typecheck`: type-check files with TypeScript.
- `yarn typecheck:plugin:tests`: type-check the Expo config plugin together with its tests.
- `yarn lint`: lint files with ESLint.
- `yarn test`: run unit tests with Jest (the `lib` and `plugin` projects).
- `yarn prepare`: build the Expo config plugin into `plugin/build/`, then the library into `lib/`.
- `yarn build:plugin` / `yarn watch:plugin`: compile (or watch) only the Expo config plugin.
- `yarn workspace example-expo prebuild`: run `expo prebuild` on the Expo example app (`prebuild:android` and `prebuild:ios` do one platform).
- `yarn verify:expo-tarball all --sdk 54`: pack the checkout and verify the tarball the way an Expo user consumes it. It is an alias for `scripts/verify-expo-tarball.sh` and takes the same arguments (see below).
- `yarn docs:dev` / `yarn docs:build`: run or build the documentation site.
- `yarn example start`: start the Metro server for the example app.
- `yarn example android`: run the example app on Android.
- `yarn example ios`: run the example app on iOS.

### Sending a pull request

> **Working on your first pull request?** You can learn how from this _free_ series: [How to Contribute to an Open Source Project on GitHub](https://app.egghead.io/playlists/how-to-contribute-to-an-open-source-project-on-github).

When you're sending a pull request:

- Prefer small pull requests focused on one change.
- Verify that linters and tests are passing.
- Test on both Android and iOS when changes affect shared code or the TypeScript layer.
- Review the documentation to make sure it looks good.
- Follow the pull request template when opening a pull request.
- For pull requests that change the API or implementation, discuss with maintainers first by opening an issue.
- For platform-specific changes, clearly indicate which platform is affected in the PR title (e.g., `feat(ios): ...` or `fix(android): ...`).

## Working on the Expo config plugin

The plugin source lives in `plugin/src/` and compiles to `plugin/build/` via plain `tsc`; `app.plugin.js` at the repository root loads the compiled output, so `plugin/build/` has to exist before you run `expo prebuild`. The end-user documentation is the [Expo config plugin guide](./website/docs/guides/expo-config-plugin.md). To iterate locally:

**Terminal 1**: watch-compile the plugin:

```bash
yarn watch:plugin
```

**Terminal 2**: run `expo prebuild` against `example-expo/` on demand. The `prebuild*` scripts first symlink the repository root into `example-expo/node_modules` (`yarn link:library`) so Expo's plugin loader resolves the local package:

```bash
yarn workspace example-expo prebuild           # both platforms
yarn workspace example-expo prebuild:android   # Android only
yarn workspace example-expo prebuild:ios       # iOS only
# inspect example-expo/android/app/src/main/AndroidManifest.xml
# inspect example-expo/ios/<name>/Info.plist
./scripts/assert-expo-prebuild-output.sh android   # or ios; the same check CI runs
```

**Terminal 3**: run the plugin tests (snapshots, idempotency and modifier tests) while you iterate:

```bash
yarn test --watch --selectProjects plugin
```

Update snapshots with `yarn test --selectProjects plugin -u` and commit them. `plugin/tsconfig.json` excludes the tests, so type-check them with `yarn typecheck:plugin:tests`.

Keep the `expo` version of the root `package.json` (`devDependencies`) and of `example-expo/package.json` identical (currently `~54.0.37`) and change them together: the symlinked plugin resolves `expo/config-plugins` from the repository root while the Expo CLI runs from `example-expo`, so both have to be the same SDK. `example-expo` deliberately has no `expo-build-properties` entry and sets neither `ios.deploymentTarget` nor an Android `compileSdkVersion`, so that CI proves the plugin works with the SDK defaults (the library needs `compileSdk` 35 or newer; Expo SDK 54 defaults to 36).

### Verifying the plugin the way CI does

These commands need only Node and network access, no Android SDK or Xcode:

```bash
yarn prepare                                    # builds lib/ and plugin/build/
yarn typecheck:plugin:tests                     # type-checks the plugin, tests included
yarn test --selectProjects plugin               # plugin unit tests (`yarn test` runs them too)
./scripts/verify-expo-tarball.sh all --sdk 54   # packs the checkout, installs it with plain npm into a
                                                # fresh Expo SDK 54 app, prebuilds and asserts the output
```

`verify-expo-tarball.sh` also takes `--sdk 55|56|57|58|latest`, `--platforms android,ios`, `--variants defaults,props,preexisting` and `--keep` (keeps the scratch app), and its `contents <tarball>` command checks a packed tarball offline (required files, no sources or tests, the `package.json` contract and the privacy manifest). On any prebuilt Expo project, `./scripts/assert-expo-prebuild-output.sh <android|android-merged|ios> [--project-dir <dir>]` runs the value-level assertions (default project: `example-expo`).

The two native builds that CI runs on `example-expo` need the platform toolchains (a JDK and the Android SDK, or a Mac with Xcode and CocoaPods). Run `yarn prepare` first so that `plugin/build/` and `lib/` exist:

```bash
# Android: build, then assert on the manifest Gradle merged
yarn workspace example-expo prebuild:android
(cd example-expo/android && ./gradlew :app:assembleDebug -PreactNativeArchitectures=arm64-v8a)
./scripts/assert-expo-prebuild-output.sh android-merged

# iOS: the project name comes from the app name in example-expo/app.config.ts
yarn workspace example-expo prebuild:ios
(cd example-expo/ios && pod install)
(cd example-expo/ios && xcodebuild -workspace exampleexpo.xcworkspace -scheme exampleexpo \
  -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
  ARCHS=arm64 ONLY_ACTIVE_ARCH=NO CODE_SIGNING_ALLOWED=NO SWIFT_ENABLE_EXPLICIT_MODULES=NO build)
```

### Expo checks in CI

| Check on the PR                                     | What it proves                                                                                                                                                 |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `expo prebuild (android)` and `expo prebuild (ios)` | `example-expo` prebuilds with the plugin; permissions, usage strings, background modes, deployment target and New Architecture are as expected.                |
| `expo android build`                                | `./gradlew :app:assembleDebug` (one ABI) succeeds and the merged manifest contains the library service and receivers exactly once.                             |
| `expo ios build`                                    | `pod install` and an `xcodebuild` for the iOS Simulator succeed on the prebuilt `example-expo`.                                                                |
| `expo tarball (sdk-54)` to `expo tarball (sdk-58)`  | The packed tarball installs with plain `npm install` into a fresh Expo SDK app, resolves its exports and prebuilds (no props, all props, pre-existing config). |

The native builds run on Expo SDK 54 only (the SDK `example-expo` uses); SDK 55 to 58 are verified up to the prebuild.
