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

**Jobs:**

| Job | Description |
| --- | --- |
| Lint | ESLint validation |
| Test | Jest unit tests with coverage |
| Build Library | TypeScript compilation |
| Build Android | Native Android compilation |
| Build iOS | Native iOS compilation (macOS runner) |

**Duration:** ~10-15 minutes

---

## Publish Workflow (`publish.yml`)

**Purpose:** Automated production releases to npm when code lands on `main`.

**Triggers:** Push to `main` branch only.

**Process:**

1. Check if version changed (compare with npm registry)
2. Build package (`yarn prepare`)
3. Run unit tests
4. Publish to npm with production tag
5. Create git tag (e.g., `v1.2.3`)
6. Create GitHub Release with auto-generated notes

**Duration:** ~5-7 minutes

**Version Detection:** The workflow automatically compares `package.json` version with the latest on npm. If versions match, publishing is skipped.

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
4. Select branch: `develop`
5. (Optional) Provide custom version suffix (e.g., `rc1`, `beta1`)
6. (Optional) Provide description for the pre-release
7. Click **"Run workflow"**

### What Happens

1. Generates beta version: `X.Y.Z-beta.TIMESTAMP.SHA` (or custom suffix)
2. Builds the package
3. Runs unit tests
4. Publishes to npm with `@beta` tag
5. Creates pre-release tag
6. Creates GitHub Pre-release
7. Comments on recently merged PRs with install instructions

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
   - Required status checks: `lint`, `test`, `build-library`, `build-android`, `build-ios`
   - Enable: Require conversation resolution
   - Enable: Do not allow bypassing settings
   - Disable: Force pushes and deletions
4. Click **"Create"**

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

# 2. Bump version (semantic versioning)
npm version patch   # Bug fixes: 1.0.0 -> 1.0.1
npm version minor   # New features: 1.0.0 -> 1.1.0
npm version major   # Breaking changes: 1.0.0 -> 2.0.0

# 3. Push version
git push origin develop
git push origin --tags

# 4. Create PR from develop to main on GitHub
# 5. After merge, production is published automatically
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

**Solution:**

```bash
npm version patch  # or minor, major
git push --tags
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
yarn test
yarn prepare
```

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
