---
sidebar_position: 4
title: Publishing
description: How to publish @gabriel-sisjr/react-native-background-location to npm. Covers automated CI/CD publishing, manual publishing, versioning strategy, and pre-publish checklist.
keywords:
  - publishing
  - npm
  - release
  - versioning
  - semver
  - release-it
  - react-native
  - background-location
---

# Publishing Guide

This guide explains how to publish `@gabriel-sisjr/react-native-background-location` to npm.

---

## Automated Publishing (Recommended)

The library uses GitHub Actions for automated publishing. For complete details on CI/CD workflows, setup, and troubleshooting, see the [CI/CD Pipeline guide](./ci-cd.md).

### Quick Overview

Three automated workflows handle publishing:

1. **CI** -- Validates code on every PR (lint, test, build, Expo config plugin checks)
2. **Publish** -- Publishes production versions from `main` branch
3. **Pre-release** -- Publishes beta versions from `develop` branch (manual trigger)

### Branch Strategy

| Branch | npm Tag | Usage |
| --- | --- | --- |
| `main` | `latest` | Production releases |
| `develop` | `beta` | Beta releases (manual trigger) |

### Required Setup

Before using automated publishing, configure:

1. **NPM Token** -- Create an automation token on npmjs.com
2. **GitHub Secret** -- Add `NPM_TOKEN` to repository secrets
3. **Branch Protection** -- Protect `main` and `develop` branches

See [CI/CD Pipeline > Setup Guide](./ci-cd.md#setup-guide) for step-by-step instructions.

---

## Production Release

1. **Prepare your changes in `develop`:**

   ```bash
   git checkout develop
   git add .
   git commit -m "feat: your feature description"
   git push origin develop
   ```

2. **Update version and changelog for production (when ready):**

   ```bash
   npm version patch --no-git-tag-version  # or minor, or major
   ```

   `--no-git-tag-version` only edits `package.json`: the publish workflow creates the `vX.Y.Z` tag itself, and it fails if the tag already exists, so do not create or push it. Then update `CHANGELOG.md` (and `BREAKING_CHANGES.md` when the release has breaking changes) by hand, including the release date; neither file is generated. Commit and push:

   ```bash
   git add package.json CHANGELOG.md BREAKING_CHANGES.md
   git commit -m "chore(version): bump v1.1.0"
   git push origin develop
   ```

3. **Create PR from `develop` to `main`:**
   - Create a PR on GitHub
   - Wait for CI checks to pass
   - Get approval and merge

4. **Automatic production release:**
   After merge to `main`, the publish workflow automatically:
   - Checks if version changed
   - Builds the package (Expo config plugin, then library)
   - Type-checks the plugin and verifies the contents of the packed tarball
   - Runs tests
   - Publishes to npm (production tag); `npm publish` first runs the `prepublishOnly` hook (library and plugin type checks, lint, tests and a rebuild of `plugin/build/` and `lib/`), and `prepare` runs once more while packing
   - Creates the git tag and the GitHub release (the notes list the commit subjects since the previous tag; `CHANGELOG.md` is not read)

---

## Beta Release

Beta releases are triggered manually via GitHub Actions UI (not automatic on push to `develop`).

1. **Push your changes to `develop`:**

   ```bash
   git checkout develop
   git add .
   git commit -m "feat: new feature"
   git push origin develop
   ```

2. **Trigger beta release:**
   - Go to GitHub repository > **Actions** tab
   - Select **"Pre-release to NPM"** workflow
   - Click **"Run workflow"**
   - Select branch: `develop` (**Use workflow from**)
   - Leave **Branch to release from** at `develop`. The version suffix, the release note and the npm provenance record the commit of the branch chosen in **Use workflow from**, not of this input, so when you pre-release another branch, choose it in both fields.
   - (Optional) Provide custom version suffix (e.g., `rc1`, `beta1`)
   - (Optional) Provide description for the pre-release
   - Click **"Run workflow"**

3. **Install the beta version:**

   ```bash
   npm install @gabriel-sisjr/react-native-background-location@beta
   # or
   yarn add @gabriel-sisjr/react-native-background-location@beta
   ```

---

## Manual Publishing (Alternative)

If you need to publish manually (not recommended for typical releases):

### 1. Build the Library

```bash
yarn install
yarn prepare
```

This compiles the Expo config plugin into `plugin/build/`, then compiles TypeScript files, generates type definitions, and creates distributable files in `lib/`.

### 2. Verify the Build

```bash
yarn typecheck
yarn typecheck:plugin:tests
yarn lint
yarn test
./scripts/verify-expo-tarball.sh all --sdk 54
```

The last command packs the checkout, checks the tarball contents and installs the tarball into a fresh Expo SDK 54 app (see [Verify Package Contents](#verify-package-contents)).

### 3. Bump the Version

```bash
npm version patch  # 0.1.0 -> 0.1.1 (bug fixes)
npm version minor  # 0.1.0 -> 0.2.0 (new features)
npm version major  # 0.1.0 -> 1.0.0 (breaking changes)
```

### 4. Publish to npm

```bash
npm publish --access public
```

`npm publish` runs the `prepublishOnly` hook before packing (`yarn typecheck`, `yarn typecheck:plugin:tests`, `yarn lint`, `yarn test`, then `yarn build:plugin` and `bob build`), so step 2 is repeated automatically and a failure there aborts the publish.

---

## What Gets Published

The `files` field in `package.json` controls what gets included in the npm package:

| Directory/File | Contents |
| --- | --- |
| `src/` | Source TypeScript files |
| `lib/` | Compiled JavaScript and type definitions |
| `android/` | Native Android code |
| `ios/` | Native iOS code |
| `cpp/` | C++ code (if any) |
| `*.podspec` | CocoaPods spec |
| `react-native.config.js` | Named in `files`, but the repository has no such file, so no release has ever shipped it |
| `app.plugin.js` | Expo config plugin entry point |
| `app.plugin.d.ts` | Type declarations for the `./app.plugin` entry (re-exports `plugin/build`) |
| `plugin/build/` | Compiled Expo config plugin (JavaScript and type declarations). `files` names `plugin/build` only, so plugin sources, tests, tsconfig files and `plugin/README.md` are not published |

### Verify Package Contents

```bash
yarn prepare
npm pack --dry-run --ignore-scripts
```

`yarn prepare` builds `lib/` and `plugin/build/`, which have to exist before packing. With npm 11 or later, `--ignore-scripts` keeps `npm pack` from running `prepare` a second time; npm 10 (bundled with the Node version in `.nvmrc`) runs it anyway, which only rebuilds the same files.

To check the packed tarball against the release contract instead of reading the file list, run the verifier. It packs the checkout, checks the contents (required files such as `app.plugin.js` and `plugin/build/`, no plugin sources, tests or typings of `example-expo` and `website`, the `package.json` exports and optional `expo` peer, and the iOS privacy manifest) and installs the tarball with plain `npm install` into a fresh Expo SDK app, where it runs `expo prebuild` and asserts the output:

```bash
./scripts/verify-expo-tarball.sh all --sdk 54
```

The CI/CD workflows run the same content check (`verify-expo-tarball.sh contents`) before they publish.

---

## Pre-Publish Checklist

- [ ] All tests pass (`yarn test`)
- [ ] TypeScript types are correct (`yarn typecheck` and `yarn typecheck:plugin:tests`)
- [ ] Linting passes (`yarn lint`)
- [ ] The packed tarball passes `./scripts/verify-expo-tarball.sh all --sdk 54`
- [ ] Example app builds and runs on Android
- [ ] Example app builds and runs on iOS
- [ ] `CHANGELOG.md` is updated by hand (release-it does not write it); `BREAKING_CHANGES.md` too when the release has breaking changes. The release date in their headings is the day the release pull request is merged: confirm it on that pull request
- [ ] Version number follows semantic versioning
- [ ] No uncommitted changes in git
- [ ] All native code compiles without warnings

---

## Post-Publish Verification

After publishing:

1. **Verify on npm:**

   ```bash
   npm view @gabriel-sisjr/react-native-background-location
   ```

2. **Test installation in a fresh project:**

   ```bash
   npx react-native init TestApp
   cd TestApp
   npm install @gabriel-sisjr/react-native-background-location
   ```

3. **Update GitHub release notes** with new features, breaking changes, bug fixes, and migration guide links (if needed).

---

## Versioning Guidelines

Follow [Semantic Versioning](https://semver.org/):

| Change Type | Bump | Example |
| --- | --- | --- |
| Bug fixes, no API changes | Patch | 0.1.0 -> 0.1.1 |
| New features, backward compatible | Minor | 0.1.0 -> 0.2.0 |
| Breaking changes | Major | 0.1.0 -> 1.0.0 |

### Conventional Commits

Use [Conventional Commits](https://www.conventionalcommits.org/) for commit messages. The commit type determines version semantics:

```bash
git commit -m "feat: add location accuracy configuration"   # minor
git commit -m "fix: resolve memory leak in location tracking" # patch
git commit -m "docs: update installation instructions"        # no version bump

# Breaking change
git commit -m "feat!: redesign location API

BREAKING CHANGE: Location API has been completely redesigned"  # major
```

---

## Release Scripts

| Script | Description |
| --- | --- |
| `yarn prepare` | Build the Expo config plugin, then the library |
| `yarn build:plugin` | Build only the Expo config plugin |
| `yarn typecheck` | Type check |
| `yarn typecheck:plugin:tests` | Type check the Expo config plugin, tests included |
| `yarn lint` | Lint code |
| `yarn verify:expo-tarball all --sdk 54` | Check the packed tarball; alias for `scripts/verify-expo-tarball.sh`, same arguments (see [Verify Package Contents](#verify-package-contents)) |
| `yarn clean` | Clean build artifacts |
| `yarn release` | Runs release-it. Not part of the release process: releases are published by the publish workflow, and this script would version, tag and publish from your machine |
| `yarn example android` | Run example app on Android |
| `yarn example ios` | Run example app on iOS |

---

## Troubleshooting

### "Package already exists"

You are trying to publish a version that already exists on npm. Bump the version first with `npm version patch|minor|major --no-git-tag-version` (see [Production Release](#production-release), step 2: the publish workflow creates the tag itself).

### "You do not have permission to publish"

Ensure you are logged into the correct npm account with publish permissions for the `@gabriel-sisjr` scope.

### Build Errors

Clean and rebuild:

```bash
yarn clean
yarn prepare
```

### Missing Files in Package

Check the `files` field in `package.json` and verify with (after `yarn prepare`):

```bash
npm pack --dry-run --ignore-scripts
```
