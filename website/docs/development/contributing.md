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

- The library package in the root directory
- An example app in the `example/` directory

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

- **Xcode 15+** (from the Mac App Store)
- **CocoaPods** (`sudo gem install cocoapods` or via Homebrew)
- An iOS simulator or physical device running iOS 13+

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

## Code Quality

Make sure your code passes TypeScript and ESLint before submitting:

```sh
yarn typecheck
yarn lint
```

To fix formatting errors:

```sh
yarn lint --fix
```

Add tests for your change if possible:

```sh
yarn test
```

> **Important:** When making changes that affect both platforms, test on both Android and iOS before submitting a pull request. Platform-specific behavior differences should be documented with `> **iOS:**` / `> **Android:**` callouts in the documentation.

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

We use [release-it](https://github.com/release-it/release-it) to make it easier to publish new versions. It handles common tasks like bumping version based on semver, creating tags and releases, etc.

To publish new versions:

```sh
yarn release
```

For more details, see the [Publishing Guide](./publishing.md).

---

## Available Scripts

The `package.json` file contains various scripts for common tasks:

| Script | Description |
| --- | --- |
| `yarn` | Setup project by installing dependencies |
| `yarn typecheck` | Type-check files with TypeScript |
| `yarn lint` | Lint files with ESLint |
| `yarn test` | Run unit tests with Jest |
| `yarn prepare` | Build the library (react-native-builder-bob) |
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
