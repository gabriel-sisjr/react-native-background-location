# Publishing Guide

This guide explains how to publish the `react-native-background-location` library to npm.

## Prerequisites

1. **NPM Account**: You need an npm account with publish permissions
2. **Authentication**: Run `npm login` to authenticate
3. **Clean State**: Ensure all changes are committed to git

## Publishing Steps

### 1. Build the Library

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

### 2. Verify the Build

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

### 3. Version Bump

The library uses [release-it](https://github.com/release-it/release-it) for versioning:

```bash
# For a patch release (0.1.0 -> 0.1.1)
yarn release patch

# For a minor release (0.1.0 -> 0.2.0)
yarn release minor

# For a major release (0.1.0 -> 1.0.0)
yarn release major
```

This will:
- Update version in `package.json`
- Create a git tag
- Generate a changelog
- Push to GitHub
- **Publish to npm**

### 4. Manual Publishing (Alternative)

If you prefer to publish manually:

```bash
# Update version in package.json manually
# Then run:
yarn prepare
npm publish
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
   npm view react-native-background-location
   ```

2. **Test installation in a fresh project**:
   ```bash
   npx react-native init TestApp
   cd TestApp
   npm install react-native-background-location
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

## Versioning Guidelines

Follow [Semantic Versioning](https://semver.org/):

- **Patch** (0.1.0 -> 0.1.1): Bug fixes, no API changes
- **Minor** (0.1.0 -> 0.2.0): New features, backward compatible
- **Major** (0.1.0 -> 1.0.0): Breaking changes

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

