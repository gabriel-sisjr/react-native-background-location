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

The library uses GitHub Actions for automated publishing. For complete details on CI/CD workflows, setup, and troubleshooting, see the [CI/CD Pipeline guide](./ci-cd).

### Quick Overview

Three automated workflows handle publishing:

1. **CI** -- Validates code on every PR (lint, test, build)
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

See [CI/CD Pipeline > Setup Guide](./ci-cd#setup-guide) for step-by-step instructions.

---

## Production Release

1. **Prepare your changes in `develop`:**

   ```bash
   git checkout develop
   git add .
   git commit -m "feat: your feature description"
   git push origin develop
   ```

2. **Update version for production (when ready):**

   ```bash
   npm version patch  # or minor, or major
   git push origin develop
   ```

3. **Create PR from `develop` to `main`:**
   - Create a PR on GitHub
   - Wait for CI checks to pass
   - Get approval and merge

4. **Automatic production release:**
   After merge to `main`, the publish workflow automatically:
   - Checks if version changed
   - Builds the package
   - Runs tests
   - Publishes to npm (production tag)
   - Creates GitHub release with tag
   - Generates release notes

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
   - Select branch: `develop`
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

This compiles TypeScript files, generates type definitions, and creates distributable files in `lib/`.

### 2. Verify the Build

```bash
yarn typecheck
yarn lint
yarn test
```

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
| `react-native.config.js` | React Native configuration |

### Verify Package Contents

```bash
npm pack --dry-run
```

---

## Pre-Publish Checklist

- [ ] All tests pass (`yarn test`)
- [ ] TypeScript types are correct (`yarn typecheck`)
- [ ] Linting passes (`yarn lint`)
- [ ] Example app builds and runs on Android
- [ ] Example app builds and runs on iOS
- [ ] CHANGELOG is updated with latest changes
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
| `yarn prepare` | Build the library |
| `yarn typecheck` | Type check |
| `yarn lint` | Lint code |
| `yarn clean` | Clean build artifacts |
| `yarn release` | Publish with versioning (release-it) |
| `yarn example android` | Run example app on Android |
| `yarn example ios` | Run example app on iOS |

---

## Troubleshooting

### "Package already exists"

You are trying to publish a version that already exists on npm. Bump the version first with `npm version patch|minor|major`.

### "You do not have permission to publish"

Ensure you are logged into the correct npm account with publish permissions for the `@gabriel-sisjr` scope.

### Build Errors

Clean and rebuild:

```bash
yarn clean
yarn prepare
```

### Missing Files in Package

Check the `files` field in `package.json` and verify with:

```bash
npm pack --dry-run
```
