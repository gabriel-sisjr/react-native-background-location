---
sidebar_position: 1
title: Contributing
description: How to contribute to @gabriel-sisjr/react-native-background-location. Development workflow, monorepo setup, running the example app, commit conventions, and pull request guidelines.
keywords:
  - contributing
  - development
  - open-source
  - pull-request
  - monorepo
  - react-native
  - background-location
---

# Contributing

Contributions are always welcome, no matter how large or small! We want this community to be friendly and respectful to each other. Please read the [Code of Conduct](https://github.com/gabriel-sisjr/react-native-background-location/blob/main/CODE_OF_CONDUCT.md) before contributing.

---

## Development Workflow

This project is a monorepo managed using [Yarn workspaces](https://yarnpkg.com/features/workspaces). It contains the following packages:

- The library package in the root directory, which includes the Expo config plugin in `plugin/`
- An example app in the `example/` directory
- An Expo example app in the `example-expo/` directory, used to exercise the config plugin with `expo prebuild`
- The documentation site in the `website/` directory

### Prerequisites

Make sure you have the correct version of [Node.js](https://nodejs.org/) installed. See the `.nvmrc` file for the version used in this project.

### Setup

Run `yarn` in the root directory to install the required dependencies for each package:

```sh
yarn
```

> **Important:** Since the project relies on Yarn workspaces, you cannot use `npm` for development without manually migrating.

---

## Running the Example App

The example app demonstrates usage of the library and is configured to use the local version. Any changes you make to the library's JavaScript code will be reflected without a rebuild, but native code changes require rebuilding the example app.

To start the Metro bundler:

```sh
yarn example start
```

To run on Android:

```sh
yarn example android
```

To run on iOS:

```sh
yarn example ios
```

### Verifying New Architecture

To confirm the app is running with the New Architecture, check the Metro logs for:

```sh
Running "BackgroundLocationExample" with {"fabric":true,"initialProps":{"concurrentRoot":true},"rootTag":1}
```

Note the `"fabric":true` and `"concurrentRoot":true` properties.

---

## iOS Development

To work on the iOS native code, you need:

- **Xcode 16.1+** (from the Mac App Store)
- **CocoaPods** (`sudo gem install cocoapods` or via Homebrew)
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

---

## Android Development

To edit the Kotlin files, open `example/android` in Android Studio and find the source files at `@gabriel-sisjr/react-native-background-location` under `Android`.

After modifying Kotlin files, rebuild the example app:

```sh
yarn example android
```

---

## Working on the Expo Config Plugin

The plugin source lives in `plugin/src/` and compiles to `plugin/build/` via plain `tsc`; `app.plugin.js` at the repository root loads the compiled output, so `plugin/build/` has to exist before you run `expo prebuild`. The end-user documentation is the [Expo Config Plugin guide](../guides/expo-config-plugin.md). To iterate locally:

**Terminal 1**: watch-compile the plugin:

```sh
yarn watch:plugin
```

**Terminal 2**: run `expo prebuild` against `example-expo/` on demand. The `prebuild*` scripts first symlink the repository root into `example-expo/node_modules` (`yarn link:library`) so Expo's plugin loader resolves the local package:

```sh
yarn workspace example-expo prebuild           # both platforms
yarn workspace example-expo prebuild:android   # Android only
yarn workspace example-expo prebuild:ios       # iOS only
# inspect example-expo/android/app/src/main/AndroidManifest.xml
# inspect example-expo/ios/<name>/Info.plist
./scripts/assert-expo-prebuild-output.sh android   # or ios; the same check CI runs
```

**Terminal 3**: run the plugin tests (snapshots, idempotency and modifier tests) while you iterate:

```sh
yarn test --watch --selectProjects plugin
```

Update snapshots with `yarn test --selectProjects plugin -u` and commit them. `plugin/tsconfig.json` excludes the tests, so type-check them with `yarn typecheck:plugin:tests`.

> **Important:** Keep the `expo` version of the root `package.json` (`devDependencies`) and of `example-expo/package.json` identical (currently `~54.0.37`) and change them together. The symlinked plugin resolves `expo/config-plugins` from the repository root while the Expo CLI runs from `example-expo`, so both have to be the same SDK. `example-expo` deliberately has no `expo-build-properties` entry and sets neither `ios.deploymentTarget` nor an Android `compileSdkVersion`, so that CI proves the plugin works with the SDK defaults (the library needs `compileSdk` 35 or newer; Expo SDK 54 defaults to 36).

### Verifying the Plugin the Way CI Does

These commands need only Node and network access, no Android SDK or Xcode:

```sh
yarn prepare                                    # builds lib/ and plugin/build/
yarn typecheck:plugin:tests                     # type-checks the plugin, tests included
yarn test --selectProjects plugin               # plugin unit tests (`yarn test` runs them too)
./scripts/verify-expo-tarball.sh all --sdk 54   # packs the checkout, installs it with plain npm into a
                                                # fresh Expo SDK 54 app, prebuilds and asserts the output
```

`verify-expo-tarball.sh` also takes `--sdk 55|56|57|58|latest`, `--platforms android,ios`, `--variants defaults,props,preexisting` and `--keep` (keeps the scratch app), and its `contents <tarball>` command checks a packed tarball offline (required files, no sources or tests, the `package.json` contract and the privacy manifest). On any prebuilt Expo project, `./scripts/assert-expo-prebuild-output.sh <android|android-merged|ios> [--project-dir <dir>]` runs the value-level assertions (default project: `example-expo`).

The two native builds that CI runs on `example-expo` need the platform toolchains (a JDK and the Android SDK, or a Mac with Xcode and CocoaPods). Run `yarn prepare` first so that `plugin/build/` and `lib/` exist:

```sh
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

The CI jobs that run these checks (`expo prebuild (android)`, `expo prebuild (ios)`, `expo android build`, `expo ios build` and `expo tarball (sdk-54)` to `expo tarball (sdk-58)`) are described in the [CI/CD Pipeline guide](./ci-cd.md).

---

## Code Quality

Make sure your code passes TypeScript and ESLint before submitting:

```sh
yarn typecheck
yarn lint
```

If you changed the Expo config plugin in `plugin/`, also run `yarn typecheck:plugin:tests`. It type-checks the plugin together with its tests, which `plugin/tsconfig.json` excludes.

To fix formatting errors:

```sh
yarn lint --fix
```

Add tests for your change if possible:

```sh
yarn test
```

`yarn test` runs two Jest projects: `lib` (the library, `src/__tests__/`) and `plugin` (the Expo config plugin, `plugin/src/__tests__/`). Add `--selectProjects lib` or `--selectProjects plugin` to run only one of them. See the [Testing Guide](./testing.md) for the details.

> **Important:** When making changes that affect both platforms, test on both Android and iOS before submitting a pull request. Platform-specific behavior differences should be documented with `> **iOS:**` / `> **Android:**` callouts in the documentation.

---

## Authoring Mermaid Diagrams

Mermaid is enabled via `@docusaurus/theme-mermaid`. Use ```` ```mermaid ```` code fences in any `.md` file under `website/docs/`.

**Quoting rule:** any node label containing reserved characters (`(`, `)`, `[`, `]`, `{`, `}`, `/`, `:`, `|`, `&`, `#`, `<br/>`) MUST be wrapped in double quotes. This applies to diamond `{...}`, square `[...]`, round `(...)`, and stadium `([...])` shapes alike.

- Wrong: `NODE{Rate limit?<br/>(5/hour)}`
- Right: `NODE{"Rate limit?<br/>(5/hour)"}`

**Validation:** run the following before committing:

```sh
yarn workspace website validate:mermaid
```

The validator also runs automatically during `yarn workspace website build` (prebuild lifecycle), so broken diagrams fail the docs build.

---

## Commit Message Convention

We follow the [Conventional Commits specification](https://www.conventionalcommits.org/en) for commit messages:

| Type | Description | Example |
| --- | --- | --- |
| `fix` | Bug fixes | `fix: resolve crash due to deprecated method` |
| `feat` | New features | `feat: add new method to the module` |
| `refactor` | Code refactor | `refactor: migrate from class components to hooks` |
| `docs` | Documentation changes | `docs: add usage example for the module` |
| `test` | Adding or updating tests | `test: add integration tests using detox` |
| `chore` | Tooling changes | `chore: change CI config` |
| `style` | Code style / formatting | `style: fix indentation in LocationService` |
| `perf` | Performance improvements | `perf: reduce memory allocation in batch writes` |

Pre-commit hooks (via Lefthook) verify that your commit message matches this format when committing.

---

## Linting and Tests

We use:

- [TypeScript](https://www.typescriptlang.org/) for type checking
- [ESLint](https://eslint.org/) with [Prettier](https://prettier.io/) for linting and formatting
- [Jest](https://jestjs.io/) for testing

Pre-commit hooks verify that the linter and tests pass when committing.

---

## Publishing to npm

Releases are published by GitHub Actions, not from a developer machine. To cut a release:

1. On `develop`, bump `version` in `package.json` and update `CHANGELOG.md` (and `BREAKING_CHANGES.md` when needed) by hand. Neither file is generated. The release date in their headings is the day the release pull request is merged: fill it in now and confirm it on that pull request.
2. Open a pull request from `develop` to `main` and wait for the CI checks.
3. Merge it. The publish workflow publishes to npm when the version in `package.json` differs from the one on npm, then creates the `vX.Y.Z` tag and the GitHub release. Do not create or push that tag yourself: the workflow fails when the tag already exists.

Beta builds are published from `develop` with the manual Pre-release workflow.

For more details, see the [Publishing Guide](./publishing.md).

---

## Available Scripts

The `package.json` file contains various scripts for common tasks:

| Script | Description |
| --- | --- |
| `yarn` | Setup project by installing dependencies |
| `yarn typecheck` | Type-check files with TypeScript |
| `yarn typecheck:plugin:tests` | Type-check the Expo config plugin together with its tests |
| `yarn lint` | Lint files with ESLint |
| `yarn test` | Run unit tests with Jest (the `lib` and `plugin` projects) |
| `yarn prepare` | Build the Expo config plugin (`tsc --project plugin/tsconfig.json`), then the library (react-native-builder-bob) |
| `yarn build:plugin` | Compile only the Expo config plugin into `plugin/build/` |
| `yarn watch:plugin` | Recompile the Expo config plugin on every change |
| `yarn workspace example-expo prebuild` | Run `expo prebuild` on the Expo example app (`prebuild:android` and `prebuild:ios` do one platform) |
| `yarn verify:expo-tarball all --sdk 54` | Pack the checkout and verify the tarball the way an Expo user consumes it (alias for `scripts/verify-expo-tarball.sh`, same arguments) |
| `yarn docs:dev` | Start the documentation site locally |
| `yarn docs:build` | Build the documentation site |
| `yarn clean` | Clean build artifacts |
| `yarn example start` | Start the Metro server for the example app |
| `yarn example android` | Run the example app on Android |
| `yarn example ios` | Run the example app on iOS |

---

## Sending a Pull Request

> **Working on your first pull request?** You can learn how from this free series: [How to Contribute to an Open Source Project on GitHub](https://app.egghead.io/playlists/how-to-contribute-to-an-open-source-project-on-github).

When you're sending a pull request:

- Prefer small pull requests focused on one change
- Verify that linters and tests are passing
- Test on both Android and iOS when changes affect shared code or the TypeScript layer
- Review the documentation to make sure it looks good
- Follow the pull request template when opening a pull request
- For pull requests that change the API or implementation, discuss with maintainers first by opening an issue
- For platform-specific changes, clearly indicate which platform is affected in the PR title (e.g., `feat(ios): ...` or `fix(android): ...`)
