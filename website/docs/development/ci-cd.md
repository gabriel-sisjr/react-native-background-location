---
sidebar_position: 3
title: CI/CD Pipeline
description: GitHub Actions CI/CD pipeline for @gabriel-sisjr/react-native-background-location. Covers the CI, Publish, and Pre-release workflows, setup instructions, and troubleshooting.
keywords:
  - ci-cd
  - github-actions
  - continuous-integration
  - continuous-deployment
  - npm-publish
  - pre-release
  - beta
  - react-native
  - background-location
---

# CI/CD Pipeline

The library uses GitHub Actions for automated testing, building, and publishing.

---

## Overview

Three automated workflows handle the full lifecycle:

| Workflow | Purpose | Trigger |
| --- | --- | --- |
| **CI** | Validate code quality and builds | Push/PR to `main` or `develop` |
| **Publish** | Production releases to npm | Push to `main` |
| **Pre-release** | Beta releases to npm | Manual trigger via GitHub Actions UI |

### Workflow Architecture

```text
feature/branch --> PR --> develop --> CI (no auto-deploy)
                           |
                      PR --> main --> CI + Publish (production)

Beta releases: Manual trigger via GitHub Actions UI
```

---

## CI Workflow (`ci.yml`)

**Purpose:** Validate code quality and ensure builds succeed on every PR and push.

**Triggers:**
- Push to `main` or `develop` branches
- Pull requests targeting `main` or `develop`
- Merge queue checks
- Manual run (`workflow_dispatch`), available once the workflow is on the default branch

**Jobs:**

| Job | Description |
| --- | --- |
| `lint` | ESLint, `tsc` for the library and `tsc` for the Expo plugin sources and tests (`yarn typecheck:plugin:tests`) |
| `test` | Jest unit tests with coverage (the `lib` and `plugin` projects); fails if the plugin test project is not collected |
| `android-unit-tests` (shown as `android unit tests`) | Kotlin unit tests of the library module (`yarn test:android`, JDK 17, 30-minute timeout), then assertions on the JUnit results, the library manifest and the Room schema export (see [Android Unit Tests Job](#android-unit-tests-job)) |
| `build-library` | `yarn prepare` (Expo config plugin, then library), then packs the npm tarball once, checks its contents (no `android/src/test/`, `android/src/androidTest/` or `ios-tests/`) and uploads it as the `npm-tarball` artifact |
| `build-android` | Native Android compilation of the example app |
| `build-ios` | `yarn test:ios`, then native iOS compilation of the example app (macOS runner) with motion activity compiled out, asserted after `pod install` and on the built binary (see [Motion Activity Compile Checks](#motion-activity-compile-checks)) |
| `expo prebuild (android)` and `expo prebuild (ios)` | `expo prebuild` on `example-expo/` with the plugin built from the checkout, then value-level assertions on the generated project (`scripts/assert-expo-prebuild-output.sh`, which runs `scripts/assert-expo-prebuild-output.mjs`). Both run on Ubuntu: prebuild needs neither CocoaPods nor Xcode |
| `expo android build` | Prebuild, then `./gradlew :app:assembleDebug` of `example-expo` (one ABI) and assertions on the merged `AndroidManifest.xml`: the motion receiver is `exported="false"` and the library's own merged manifest has no `ACTIVITY_RECOGNITION` |
| `expo ios build` | Prebuild, `pod install` and `xcodebuild` for the iOS Simulator (macOS runner), with motion activity compiled in through the `example-expo` plugin prop and asserted before and after the build |
| `expo tarball (sdk-54)` to `expo tarball (sdk-58)` | The tarball packed by `build-library`, installed with plain `npm install` into a fresh Expo SDK 54 to 58 app, then `expo prebuild` and the same assertions (no props, all props, pre-existing config) |

The Expo jobs run the plugin the way a user does. The native builds (`expo android build` and `expo ios build`) cover Expo SDK 54, the SDK `example-expo` uses; SDK 55 to 58 are verified up to the prebuild by the tarball jobs. To run the same checks on your machine, see "Working on the Expo Config Plugin" in the [Contributing guide](./contributing.md).

The prebuild and tarball assertions follow the `motionActivity` plugin prop. With the prop they expect both activity-recognition permissions (the Play services one with `android:maxSdkVersion="28"`), `NSMotionUsageDescription` (the prop's `usageDescription`, else the app's own value, else the library default) and exactly one Podfile flag line; without it, none of them. `example-expo` sets `motionActivity: {}`.

**Duration:** roughly 10-20 minutes; the native build jobs run in parallel and take the longest

### Android Unit Tests Job

The `android-unit-tests` job runs on Ubuntu with JDK 17 and a 30-minute timeout. After the setup steps (checkout, dependencies, JDK, Android SDK licences, Gradle cache), it:

1. Asserts that the library manifest declares no `ACTIVITY_RECOGNITION`: apps opt in through their own manifest or the Expo plugin prop.
2. Runs `yarn test:android`, the same command as on a local machine.
3. Runs `scripts/assert-junit-results.sh` on `android/build/test-results/testDebugUnitTest`. Gradle 8 exits 0 when no test runs, so the JUnit XML is the evidence: the step fails on 0 tests, on any failure or error, and when a required class is missing (`MotionGateTest`, `MotionClassifierTest`, `MotionOptionsTest`, `MotionPermissionsTest`, `MotionPendingIntentsTest`, `MotionSessionTest`, `LocationDatabaseMigrationTest`).
4. Asserts that the Room schema export is committed. KSP writes `android/schemas/` during the build, so `git status --porcelain -- android/schemas` must print nothing.
5. Uploads the JUnit XML and HTML reports as the `android-unit-test-reports` artifact, also when an earlier step failed.

The job differs from the build jobs on purpose:

- **No `needs:`** -- A failure elsewhere never turns it into "skipped".
- **No turbo** -- A turbo cache hit would replay the log and restore no JUnit XML.
- **No Gradle build cache** -- The schema export is a side effect of the KSP task, which a `FROM-CACHE` result would skip. The Gradle wrapper and dependency caches under `~/.gradle` are still cached, under a key of their own.

### Motion Activity Compile Checks

`scripts/assert-ios-motion-compile.sh` proves which way the opt-in CoreMotion code of the pod was compiled. After `pod install` it checks the pod's xcconfig (`-DBACKGROUND_LOCATION_MOTION`) and the `CoreMotion` framework entry; with `--binary`, after the Xcode build, it runs `nm -u` on the built library.

```bash
bash scripts/assert-ios-motion-compile.sh off example/ios               # build-ios, after pod install
bash scripts/assert-ios-motion-compile.sh off example/ios --binary      # build-ios, after the build
bash scripts/assert-ios-motion-compile.sh on example-expo/ios           # expo ios build, after pod install
bash scripts/assert-ios-motion-compile.sh on example-expo/ios --binary  # expo ios build, after the build
```

- `build-ios` runs `yarn test:ios` right after setup, before the turbo cache check, so the Swift motion tests also run when the example build is replayed from the cache. The bare example is built without the Podfile flag, like every app that does not opt in: `off` means no `-DBACKGROUND_LOCATION_MOTION`, no `CoreMotion` framework and no CoreMotion class in `nm -u`. The `pod install` check runs only when the pods were installed in that run, and the binary check only after a real build (a turbo cache hit leaves no binary to inspect).
- `expo ios build` asserts `on`: `example-expo` sets the `motionActivity` plugin prop, so the Podfile line the plugin adds must compile the CoreMotion code in, and the binary must reference `CMMotionActivityManager`.

---

## Publish Workflow (`publish.yml`)

**Purpose:** Automated production releases to npm when code lands on `main`.

**Triggers:** Push to `main` branch only.

**Process:**

1. Check if version changed (compare with npm registry)
2. Build package (`yarn prepare`: Expo config plugin, then library)
3. Type-check the plugin sources and tests (`yarn typecheck:plugin:tests`)
4. Verify tarball contents: pack with `npm pack --ignore-scripts`, then `scripts/verify-expo-tarball.sh contents` (required files such as `app.plugin.js` and `plugin/build/`, no sources or tests (Kotlin test sources and `ios-tests/` included), the `package.json` contract and the iOS privacy manifest)
5. Run unit tests
6. Publish to npm with production tag. `npm publish` first runs the `prepublishOnly` hook (`yarn typecheck`, `yarn typecheck:plugin:tests`, `yarn lint`, `yarn test`, then the plugin and library builds) and runs `prepare` once more while packing. This is the only step of the workflow that runs `yarn lint` and the root `yarn typecheck`, so a lint or type error that steps 2-5 do not cover fails the release here, before anything is uploaded
7. Create git tag (e.g., `v1.2.3`)
8. Create GitHub Release (the notes list the commit subjects since the previous tag; `CHANGELOG.md` is not read)

**Duration:** ~5-7 minutes

**Version Detection:** The workflow automatically compares `package.json` version with the latest on npm. If versions match, publishing is skipped.

**Tags:** The workflow creates the `vX.Y.Z` tag itself. Do not create or push that tag manually: the tag step fails when it already exists.

**Security:**
- Uses `--provenance` flag for supply chain security
- Requires `id-token: write` permission
- Token never exposed in logs

---

## Pre-release Workflow (`prerelease.yml`)

**Purpose:** Manual beta releases from the `develop` branch.

**Triggers:** Manual trigger via GitHub Actions UI (`workflow_dispatch`). There is no automatic deployment on push to `develop`.

### How to Trigger

1. Go to the GitHub **Actions** tab
2. Select **"Pre-release to NPM"** workflow
3. Click **"Run workflow"**
4. Select branch: `develop` (**Use workflow from**)
   - Leave **Branch to release from** at `develop`. The version suffix, the release note and the npm provenance record the commit of the branch chosen in **Use workflow from**, not of this input, so when you pre-release another branch, choose it in both fields.
5. (Optional) Provide custom version suffix (e.g., `rc1`, `beta1`)
6. (Optional) Provide description for the pre-release
7. Click **"Run workflow"**

### What Happens

1. Generates beta version: `X.Y.Z-beta.TIMESTAMP.SHA` (or custom suffix)
2. Builds the package (`yarn prepare`: Expo config plugin, then library)
3. Type-checks the plugin sources and tests (`yarn typecheck:plugin:tests`)
4. Verifies the tarball contents (`scripts/verify-expo-tarball.sh contents`, the same check as the Publish workflow)
5. Runs unit tests
6. Publishes to npm with `@beta` tag (`npm publish` first runs the `prepublishOnly` hook: type checks, lint, tests and builds, as in the Publish workflow)
7. Creates pre-release tag
8. Creates GitHub Pre-release
9. Comments on recently merged PRs with install instructions

**Duration:** ~5-7 minutes

### Beta Version Format

```text
0.2.0-beta.20251026143022.a1b2c3d
       |--- timestamp ---|-- SHA --|

Or with custom suffix:
0.2.0-rc1
0.2.0-beta1
```

### Installing a Beta Version

```bash
npm install @gabriel-sisjr/react-native-background-location@beta
# or
yarn add @gabriel-sisjr/react-native-background-location@beta
```

---

## Setup Guide

### Prerequisites

- npm account with publish permissions
- GitHub repository admin access
- npm automation token

### Step 1: Create an NPM Token

**Via CLI:**

```bash
npm login
npm token create --type automation
```

**Via Web:**

1. Go to `https://www.npmjs.com/settings/[username]/tokens`
2. Click "Generate New Token"
3. Select "Automation" type
4. Copy the token (shown only once)

### Step 2: Add GitHub Secret

1. Go to repository **Settings**
2. Navigate to **Secrets and variables** > **Actions**
3. Click **"New repository secret"**
4. Set **Name** to `NPM_TOKEN` (must be exact)
5. Set **Value** to your npm token
6. Click **"Add secret"**

### Step 3: Configure Branch Protection

For both `main` and `develop` branches:

1. Go to **Settings** > **Branches**
2. Click **"Add branch protection rule"**
3. Configure:
   - **Branch name pattern:** `main` (or `develop`)
   - Enable: Require pull request before merging
   - Enable: Require approvals (1)
   - Enable: Require status checks to pass before merging
   - Enable: Require branches to be up to date
   - Required status checks: `lint`, `test`, `build-library`, `build-android`, `build-ios`, plus `expo prebuild (android)`, `expo prebuild (ios)` and `expo tarball (sdk-54)` (see the note below)
   - Enable: Require conversation resolution
   - Enable: Do not allow bypassing settings
   - Disable: Force pushes and deletions
4. Click **"Create"**

**Note on the Expo checks:** Required checks are an owner action in the repository settings; no workflow adds them. GitHub only offers check names it has already seen, so add the Expo checks after they have passed once on the target branch. This repository is governed by a repository ruleset rather than a classic branch protection rule, so add them to the `required_status_checks` rule of that ruleset. `expo android build` and `expo ios build` can be added after a few green runs. `expo tarball (sdk-54)` floats with the Expo patch releases of SDK 54 (the template and the `expo` version it installs), like the SDK 55 to 58 legs, so require it only if you accept that a new Expo patch release can turn it red without a change in this repository. `expo tarball (sdk-55)` to `expo tarball (sdk-58)` should stay informational: the Expo template for each SDK moves independently of this repository, so a patch release of Expo could otherwise block an unrelated pull request.

---

## Development Workflow

### Feature Development

```bash
# 1. Create feature branch from develop
git checkout develop
git pull origin develop
git checkout -b feature/awesome-feature

# 2. Develop and commit (use conventional commits)
git add .
git commit -m "feat: add awesome feature"

# 3. Push and create PR targeting develop
git push origin feature/awesome-feature
```

After merge to develop:
- CI runs automatically (lint, test, build)
- No automatic beta release -- deploy beta manually when needed via GitHub Actions UI

### Production Release

```bash
# 1. Update version on develop
git checkout develop
git pull origin develop

# 2. Bump version (semantic versioning). --no-git-tag-version only edits
#    package.json: the Publish workflow creates the vX.Y.Z tag itself.
npm version patch --no-git-tag-version   # Bug fixes: 1.0.0 -> 1.0.1
npm version minor --no-git-tag-version   # New features: 1.0.0 -> 1.1.0
npm version major --no-git-tag-version   # Breaking changes: 1.0.0 -> 2.0.0

# 3. Update CHANGELOG.md (and BREAKING_CHANGES.md when needed) by hand,
#    including the release date. Neither file is generated.

# 4. Commit and push
git add package.json CHANGELOG.md BREAKING_CHANGES.md
git commit -m "chore(version): bump v1.1.0"
git push origin develop

# 5. Create PR from develop to main on GitHub
# 6. After merge, production is published automatically
```

### Hotfix Process

```bash
# 1. Create hotfix branch from main
git checkout main
git pull origin main
git checkout -b hotfix/critical-bug

# 2. Fix and commit
git add .
git commit -m "fix: resolve critical issue"

# 3. Create PR to main, merge, production published automatically

# 4. Backport to develop
git checkout develop
git merge main
git push origin develop
```

---

## Workflow Triggers Quick Reference

| Event | Branch | Workflow | Result |
| --- | --- | --- | --- |
| Push | `develop` | CI only | Validation (beta via manual trigger) |
| Push | `main` | CI + Publish | Production publish |
| PR | `develop` | CI only | Validation |
| PR | `main` | CI only | Validation |

---

## Semantic Versioning

### Version Format: `MAJOR.MINOR.PATCH`

| Change Type | Version Bump | Commit Prefix |
| --- | --- | --- |
| Bug fix | Patch (1.0.0 -> 1.0.1) | `fix:` |
| New feature (backward compatible) | Minor (1.0.0 -> 1.1.0) | `feat:` |
| Breaking change | Major (1.0.0 -> 2.0.0) | `feat!:` or `BREAKING CHANGE:` |

---

## Monitoring and Troubleshooting

### Check Version Status

```bash
# Production version (latest)
npm view @gabriel-sisjr/react-native-background-location version

# All versions
npm view @gabriel-sisjr/react-native-background-location versions

# Distribution tags
npm view @gabriel-sisjr/react-native-background-location dist-tags
```

### Common Issues

#### Publish workflow skipped

**Cause:** Version in `package.json` matches the published version.

**Solution:** bump the version on `develop` and merge it into `main` again:

```bash
npm version patch --no-git-tag-version  # or minor, major
git add package.json
git commit -m "chore(version): bump v1.0.1"
git push origin develop
```

#### "401 Unauthorized" during npm publish

**Cause:** Invalid or expired `NPM_TOKEN`.

**Solution:**
1. Generate new token: `npm token create --type automation`
2. Update `NPM_TOKEN` secret on GitHub
3. Re-run workflow

#### CI checks failing

Run locally first:

```bash
yarn install
yarn lint
yarn typecheck
yarn typecheck:plugin:tests
yarn test
yarn test:android   # needs JDK 17 and the Android SDK
yarn test:ios       # needs macOS with the Xcode command line tools
yarn prepare
./scripts/verify-expo-tarball.sh all --sdk 54
```

The last command reproduces the `build-library` tarball check and an `expo tarball (sdk-54)` job. `yarn test:android` and `yarn test:ios` run the test steps of the `android-unit-tests` and `build-ios` jobs. The Expo prebuild and native build jobs are reproduced step by step in "Working on the Expo Config Plugin" in the [Contributing guide](./contributing.md).

#### Pre-release not triggered

**Cause:** Branch protection or workflow syntax error.

**Solution:**
- Ensure changes go through PRs
- Check workflow file syntax
- Review Actions logs

---

## Security Best Practices

### Token Management

**Do:**
- Use "Automation" type tokens for CI/CD
- Rotate tokens every 90 days
- Store tokens as GitHub Secrets only
- Use minimum required permissions

**Do not:**
- Commit tokens to git
- Share tokens between projects
- Use personal access tokens for CI
- Bypass branch protection

### Supply Chain Security

The workflows use:
- **Pinned action versions** (commit SHA, not floating tags)
- **Provenance** (`--provenance` flag)
- **Read-only tokens** where possible
- **Minimal permissions** principle

---

## Maintenance

### Updating GitHub Actions

When updating action versions, use commit SHA instead of tags:

```yaml
# Preferred (pinned)
uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2

# Avoid (floating)
uses: actions/checkout@v4
```

Test in a feature branch first and document the version in a comment.

### Rotating NPM Token

Recommended every 90 days:

1. Generate new token on npmjs.com
2. Update GitHub secret: Settings > Secrets > Actions > `NPM_TOKEN` > Update value
3. Revoke old token
4. Test with a non-critical publish
