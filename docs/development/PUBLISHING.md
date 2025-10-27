# Publishing Guide

This guide explains how to publish the `@gabriel-sisjr/react-native-background-location` library to npm.

## Automated CI/CD Pipeline

The library uses GitHub Actions for automated publishing. For complete details on CI/CD workflows, setup, and troubleshooting, see the **[CI/CD Guide](CICD.md)**.

### Quick Overview

**Three automated workflows:**

1. **CI** - Validates code on every PR (lint, test, build)
2. **Publish** - Publishes production versions from `main` branch
3. **Pre-release** - Publishes beta versions from `develop` branch

**Branch Strategy:**
- `main` → Production releases (npm `latest` tag)
- `develop` → Beta releases (npm `@beta` tag)

### Required Setup

Before using automated publishing, configure:

1. **NPM Token** - Create automation token on npmjs.com
2. **GitHub Secret** - Add `NPM_TOKEN` to repository secrets
3. **Branch Protection** - Protect `main` and `develop` branches

**For detailed setup instructions, see [CI/CD Guide → Setup](CICD.md#setup-guide)**

## Prerequisites

1. **NPM Account**: You need an npm account with publish permissions
2. **GitHub Access**: Write access to the repository
3. **Clean State**: Ensure all changes are committed to git

## Publishing Steps

### Automated Publishing (Recommended)

#### Production Release (to `main`)

1. **Prepare your changes in `develop`**:
   ```bash
   git checkout develop
   # Make your changes, commit them
   git add .
   git commit -m "feat: your feature description"
   git push origin develop
   ```
   
   This will trigger:
   - CI checks
   - Beta version publish to npm with `@beta` tag

2. **Update version for production** (when ready):
   ```bash
   # Update version following semantic versioning
   npm version patch  # or minor, or major
   git push origin develop
   ```

3. **Create PR from `develop` to `main`**:
   - Create a PR on GitHub
   - Wait for CI checks to pass
   - Get approval and merge

4. **Automatic production release**:
   - After merge to `main`, the publish workflow automatically:
     - Checks if version changed
     - Builds the package
     - Runs tests
     - Publishes to npm (production tag)
     - Creates GitHub release with tag
     - Generates release notes

#### Beta Release (to `develop`)

Simply push to `develop` branch:
```bash
git checkout develop
git add .
git commit -m "feat: new feature"
git push origin develop
```

The pre-release workflow will:
- Generate a beta version (`X.Y.Z-beta.TIMESTAMP.SHA`)
- Publish to npm with `@beta` tag
- Create a pre-release on GitHub
- Comment on recent PRs with install instructions

Users can test beta versions with:
```bash
npm install @gabriel-sisjr/react-native-background-location@beta
# or
yarn add @gabriel-sisjr/react-native-background-location@beta
```

### Manual Publishing (Alternative)

If you need to publish manually (not recommended):

#### 1. Build the Library

```bash
# Install dependencies
yarn install

# Build the library
yarn prepare
```

This will:
- Compile TypeScript files
- Generate type definitions
- Create the distributable files in the `lib/` directory

#### 2. Verify the Build

```bash
# Check that types are generated correctly
yarn typecheck

# Run linter
yarn lint

# Ensure example still works
cd example
yarn install
yarn android  # Test on Android
```

#### 3. Version Bump

```bash
# For a patch release (0.1.0 -> 0.1.1)
npm version patch

# For a minor release (0.1.0 -> 0.2.0)
npm version minor

# For a major release (0.1.0 -> 1.0.0)
npm version major
```

#### 4. Publish to npm

```bash
npm publish --access public
```

## What Gets Published

The `files` field in `package.json` controls what gets published:

```json
{
  "files": [
    "src",
    "lib",
    "android",
    "ios",
    "cpp",
    "*.podspec",
    "react-native.config.js"
  ]
}
```

This includes:
- Source TypeScript files (`src/`)
- Compiled JavaScript and type definitions (`lib/`)
- Native Android code (`android/`)
- Native iOS code (`ios/`)
- Configuration files

## Pre-publish Checklist

Before publishing, ensure:

- [ ] All tests pass
- [ ] TypeScript types are correct
- [ ] Example app builds and runs on Android
- [ ] README is up to date
- [ ] CHANGELOG is updated with latest changes
- [ ] Version number follows semantic versioning
- [ ] No uncommitted changes in git
- [ ] All native code compiles without warnings

## Post-publish Steps

After publishing:

1. **Verify the package on npm**:
   ```bash
   npm view @gabriel-sisjr/react-native-background-location
   ```

2. **Test installation in a fresh project**:
   ```bash
   npx react-native init TestApp
   cd TestApp
   npm install @gabriel-sisjr/react-native-background-location
   ```

3. **Update GitHub release notes** with:
   - New features
   - Breaking changes
   - Bug fixes
   - Migration guide (if needed)

## Troubleshooting

### "Package already exists"

You're trying to publish a version that already exists. Bump the version first.

### "You do not have permission to publish"

Ensure you're logged into the correct npm account with publish permissions.

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

## Development Workflow

### Feature Development

1. **Create a feature branch from `develop`**:
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/your-feature-name
   ```

2. **Develop and test your feature**:
   ```bash
   # Make changes
   git add .
   git commit -m "feat: add new feature"
   
   # Run tests locally
   yarn test
   yarn lint
   yarn typecheck
   ```

3. **Push and create PR to `develop`**:
   ```bash
   git push origin feature/your-feature-name
   # Create PR on GitHub targeting develop branch
   ```

4. **After PR is merged**:
   - CI runs automatically
   - Beta version is published to npm
   - Team can test with `@beta` tag

### Bug Fixes

For critical production bugs:

1. **Create hotfix branch from `main`**:
   ```bash
   git checkout main
   git pull origin main
   git checkout -b hotfix/your-fix-name
   ```

2. **Fix the bug and test**:
   ```bash
   # Make fixes
   git add .
   git commit -m "fix: critical bug description"
   ```

3. **Create PR to `main`**:
   - PR must target `main` branch
   - After merge, production release is automatic

4. **Backport to `develop`**:
   ```bash
   git checkout develop
   git merge main
   git push origin develop
   ```

### Release Process

#### Minor/Major Releases

1. Ensure all features are merged into `develop`
2. Update version in `package.json`:
   ```bash
   git checkout develop
   npm version minor  # or major
   git push origin develop
   ```
3. Create PR from `develop` to `main`
4. After merge, GitHub Actions will:
   - Publish to npm
   - Create GitHub release
   - Generate changelog

#### Patch Releases

1. Fix bugs in `develop` or hotfix branches
2. Update patch version:
   ```bash
   npm version patch
   ```
3. Create PR to `main`
4. Automatic release after merge

## Versioning Guidelines

Follow [Semantic Versioning](https://semver.org/):

- **Patch** (0.1.0 -> 0.1.1): Bug fixes, no API changes
- **Minor** (0.1.0 -> 0.2.0): New features, backward compatible
- **Major** (0.1.0 -> 1.0.0): Breaking changes

### Conventional Commits

Use [Conventional Commits](https://www.conventionalcommits.org/) for commit messages:

- `feat:` - New feature (triggers minor version)
- `fix:` - Bug fix (triggers patch version)
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks
- `BREAKING CHANGE:` - Breaking changes (triggers major version)

Examples:
```bash
git commit -m "feat: add location accuracy configuration"
git commit -m "fix: resolve memory leak in location tracking"
git commit -m "docs: update installation instructions"
git commit -m "feat!: redesign location API

BREAKING CHANGE: Location API has been completely redesigned"
```

## Scripts Reference

```bash
# Build the library
yarn prepare

# Type check
yarn typecheck

# Lint code
yarn lint

# Clean build artifacts
yarn clean

# Publish (with versioning)
yarn release

# Run example app
yarn example android
```

## Support

For issues with publishing, contact the maintainer or open an issue on GitHub.

