# CI/CD Configuration

Complete guide for the automated CI/CD pipeline that handles testing, building, and publishing the library.

---

## Overview

The library uses GitHub Actions for automated:
- **Continuous Integration** - Code validation on every PR
- **Beta Releases** - Manual publishing via GitHub Actions UI (workflow_dispatch)
- **Production Releases** - Automatic publishing from `main` branch

### Workflow Architecture

```
feature/branch → PR → develop → CI (no auto-deploy)
                         ↓
                    PR → main → CI + Publish (production)
                    
Beta releases: Manual trigger via GitHub Actions UI
```

---

## Workflows

### 1. CI Workflow (`ci.yml`)

**Purpose**: Validate code quality and ensure builds succeed

**Triggers**:
- Push to `main` or `develop` branches
- Pull requests targeting `main` or `develop`
- Merge queue checks

**Jobs**:
1. **Lint** - ESLint validation
2. **Test** - Jest unit tests with coverage
3. **Build Library** - TypeScript compilation
4. **Build Android** - Native Android compilation
5. **Build iOS** - Native iOS compilation (macOS runner)

**Duration**: ~10-15 minutes

---

### 2. Publish Workflow (`publish.yml`)

**Purpose**: Automated production releases to npm

**Triggers**:
- Push to `main` branch only

**Process**:
1. Check if version changed (compare with npm registry)
2. Build package (`yarn prepare`)
3. Run unit tests
4. Publish to npm with production tag
5. Create git tag (e.g., `v1.2.3`)
6. Create GitHub Release with auto-generated notes

**Duration**: ~5-7 minutes

**Version Detection**:
```javascript
// Automatically compares package.json version with latest on npm
// Skips publishing if versions match
```

**Security**:
- Uses `--provenance` flag for supply chain security
- Requires `id-token: write` permission
- Token never exposed in logs

---

### 3. Pre-release Workflow (`prerelease.yml`)

**Purpose**: Manual beta releases from develop branch

**Triggers**:
- **Manual trigger** via GitHub Actions UI (`workflow_dispatch`)
- No automatic deployment on push to `develop`

**How to Trigger**:
1. Go to GitHub Actions tab
2. Select "Pre-release to NPM" workflow
3. Click "Run workflow"
4. Select branch: `develop`
5. (Optional) Provide custom version suffix (e.g., `rc1`, `beta1`)
6. (Optional) Provide description for the pre-release
7. Click "Run workflow"

**Process**:
1. Generate beta version: `X.Y.Z-beta.TIMESTAMP.SHA` (or custom suffix)
2. Build package
3. Run unit tests
4. Publish to npm with `@beta` tag
5. Create pre-release tag
6. Create GitHub Pre-release
7. Comment on recently merged PRs with install instructions

**Duration**: ~5-7 minutes

**Beta Version Format**:
```
0.2.0-beta.20251026143022.a1b2c3d
       └── timestamp ──┘ └─ commit SHA ─┘

Or with custom suffix:
0.2.0-rc1
0.2.0-beta1
```

**Installation**:
```bash
npm install @gabriel-sisjr/react-native-background-location@beta
```

---

## Setup Guide

### Prerequisites

- npm account with publish permissions
- GitHub repository admin access
- npm automation token

### Step 1: Create NPM Token

**Via CLI:**
```bash
npm login
npm token create --type automation
```

**Via Web:**
1. Go to https://www.npmjs.com/settings/[username]/tokens
2. Click "Generate New Token"
3. Select "Automation" type
4. Copy token (shown only once!)

### Step 2: Add GitHub Secret

1. Go to repository **Settings**
2. Navigate to **Secrets and variables** → **Actions**
3. Click **"New repository secret"**
4. Configure:
   - **Name**: `NPM_TOKEN` (must be exact)
   - **Value**: Your npm token
5. Click **"Add secret"**

### Step 3: Configure Branch Protection

For both `main` and `develop` branches:

1. Go to **Settings** → **Branches**
2. Click **"Add branch protection rule"**
3. Configure:
   - **Branch name pattern**: `main` (or `develop`)
   - ✅ Require pull request before merging
   - ✅ Require approvals: 1
   - ✅ Require status checks to pass before merging
   - ✅ Require branches to be up to date
   - Required status checks:
     - `lint`
     - `test`
     - `build-library`
     - `build-android`
     - `build-ios`
   - ✅ Require conversation resolution
   - ✅ Do not allow bypassing settings
   - ❌ Do not allow force pushes
   - ❌ Do not allow deletions
4. Click **"Create"**

### Step 4: Test the Setup

**Test CI:**
```bash
git checkout develop
git checkout -b test/ci-setup
echo "# Test" >> README.md
git commit -am "test: verify CI workflow"
git push origin test/ci-setup
# Create PR → CI should run
```

**Test Pre-release:**
```bash
# Merge test PR to develop
# Go to GitHub Actions tab → "Pre-release to NPM" → "Run workflow"
# Select branch: develop → Run workflow
# Watch Actions tab → Pre-release should run
npm view @gabriel-sisjr/react-native-background-location dist-tags
# Should see beta version
```

**Test Publish:**
```bash
git checkout develop
npm version patch
git push origin develop --tags
# Create PR to main
# Merge → Publish should run
npm view @gabriel-sisjr/react-native-background-location version
# Should see new version
```

---

## Development Workflow

### Feature Development

```bash
# 1. Create feature branch from develop
git checkout develop
git pull origin develop
git checkout -b feature/awesome-feature

# 2. Develop and commit (use conventional commits!)
git add .
git commit -m "feat: add awesome feature"

# 3. Push and create PR
git push origin feature/awesome-feature
# Create PR on GitHub targeting develop
```

**After merge to develop:**
- CI runs automatically (lint, test, build)
- **No automatic beta release** - Deploy beta manually when needed via GitHub Actions UI
- To publish beta: Go to Actions → "Pre-release to NPM" → "Run workflow"

### Production Release

```bash
# 1. Update version on develop
git checkout develop
git pull origin develop

# 2. Bump version (semantic versioning)
npm version patch   # Bug fixes: 1.0.0 → 1.0.1
npm version minor   # New features: 1.0.0 → 1.1.0
npm version major   # Breaking changes: 1.0.0 → 2.0.0

# 3. Push version
git push origin develop
git push origin --tags

# 4. Create PR from develop to main
# On GitHub: Create Pull Request
# Source: develop → Target: main

# 5. After merge → Production published automatically
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

# 3. Create PR to main
git push origin hotfix/critical-bug
# Create PR targeting main

# 4. After merge → Production published

# 5. Backport to develop
git checkout develop
git merge main
git push origin develop
```

---

## Semantic Versioning

### Version Format: `MAJOR.MINOR.PATCH`

| Change Type | Version Bump | Example | Commit Prefix |
|-------------|--------------|---------|---------------|
| Bug fix | Patch | 1.0.0 → 1.0.1 | `fix:` |
| New feature (backward compatible) | Minor | 1.0.0 → 1.1.0 | `feat:` |
| Breaking change | Major | 1.0.0 → 2.0.0 | `feat!:` or `BREAKING CHANGE:` |

### Conventional Commits

Format: `<type>(<scope>): <subject>`

**Types:**
- `feat:` - New feature (minor version)
- `fix:` - Bug fix (patch version)
- `docs:` - Documentation only
- `style:` - Code style (formatting)
- `refactor:` - Code refactoring
- `perf:` - Performance improvement
- `test:` - Adding/updating tests
- `chore:` - Maintenance tasks
- `ci:` - CI/CD changes

**Examples:**
```bash
git commit -m "feat: add location accuracy configuration"
git commit -m "fix: resolve memory leak in location tracking"
git commit -m "docs: update installation instructions"

# Breaking change
git commit -m "feat!: redesign location API

BREAKING CHANGE: Location API has been completely redesigned.
See migration guide for details."
```

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

**Expected output:**
```json
{
  "latest": "0.2.0",
  "beta": "0.2.0-beta.20251026143022.a1b2c3d"
}
```

### Workflow Debugging

1. Go to **Actions** tab on GitHub
2. Select the workflow (CI, Publish, or Pre-release)
3. Click on a run to see job details
4. Review step-by-step logs

### Common Issues

#### Publish workflow skipped

**Cause**: Version in `package.json` matches published version

**Solution**:
```bash
npm version patch  # or minor, major
git push --tags
```

#### "401 Unauthorized" during npm publish

**Cause**: Invalid or expired `NPM_TOKEN`

**Solution**:
1. Generate new token: `npm token create --type automation`
2. Update `NPM_TOKEN` secret on GitHub
3. Re-run workflow

#### CI checks failing

**Run locally first:**
```bash
yarn install
yarn lint
yarn typecheck
yarn test
yarn prepare
```

#### Pre-release not triggered

**Cause**: Branch protection or workflow syntax error

**Solution**:
- Ensure changes go through PRs
- Check workflow file syntax
- Review Actions logs

---

## Security Best Practices

### Token Management

✅ **Do:**
- Use "Automation" type tokens for CI/CD
- Rotate tokens every 90 days
- Store tokens as GitHub Secrets only
- Use minimum required permissions

❌ **Don't:**
- Commit tokens to git
- Share tokens between projects
- Use personal access tokens
- Bypass branch protection

### Workflow Security

- ✅ Use commit SHA for action versions
- ✅ Enable provenance for npm publish
- ✅ Require status checks before merge
- ✅ Enable branch protection
- ✅ Require PR reviews

### Supply Chain Security

The workflows use:
- **Pinned action versions** (commit SHA)
- **Provenance** (`--provenance` flag)
- **Read-only tokens** where possible
- **Minimal permissions** principle

---

## Maintenance

### Updating GitHub Actions

When updating action versions:

1. Check for security updates
2. Use commit SHA instead of tags:
```yaml
# Good (pinned)
uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2

# Avoid (floating)
uses: actions/checkout@v4
```
3. Test in feature branch first
4. Document version in comment

### Rotating NPM Token

Recommended every 90 days:

1. Generate new token on npmjs.com
2. Update GitHub secret:
   - Settings → Secrets → Actions
   - Click `NPM_TOKEN`
   - Update value
3. Revoke old token
4. Test with a non-critical publish

### Adding New CI Jobs

When adding jobs:

1. Add to `ci.yml`
2. Test in PR to develop
3. Ensure reasonable duration
4. Add to required status checks

---

## Quick Reference

### Installation Commands

```bash
# Production (stable)
npm install @gabriel-sisjr/react-native-background-location

# Beta (develop)
npm install @gabriel-sisjr/react-native-background-location@beta

# Specific version
npm install @gabriel-sisjr/react-native-background-location@0.9.0
```

### Workflow Triggers

| Event | Branch | Workflow | Result |
|-------|--------|----------|--------|
| Push | `develop` | CI only | Validation (beta via manual trigger) |
| Push | `main` | CI + Publish | Production publish |
| PR | `develop` | CI only | Validation |
| PR | `main` | CI only | Validation |

### Version Commands

```bash
# Bump version
npm version patch|minor|major

# View package info
npm view @gabriel-sisjr/react-native-background-location

# List versions
npm view @gabriel-sisjr/react-native-background-location versions

# Create token
npm token create --type automation

# List tokens
npm token list
```

---

## Support

### Documentation

- [Publishing Guide](PUBLISHING.md) - Complete publishing process
- [Testing Guide](TESTING.md) - Testing procedures
- [Implementation Summary](IMPLEMENTATION_SUMMARY.md) - Technical details

### External Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [npm Publishing Guide](https://docs.npmjs.com/packages-and-modules/contributing-packages-to-the-registry)
- [Semantic Versioning](https://semver.org/)
- [Conventional Commits](https://www.conventionalcommits.org/)

### Getting Help

1. Check workflow logs in Actions tab
2. Review this documentation
3. Search GitHub Issues
4. Open new issue with:
   - What you tried
   - What went wrong
   - Relevant logs/screenshots

---

**Last Updated**: October 26, 2025  
**Version**: 0.9.0

