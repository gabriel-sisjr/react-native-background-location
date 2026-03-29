# Documentation Structure

This document describes the organization of documentation for `@gabriel-sisjr/react-native-background-location`.

## 📁 Folder Organization

The documentation is organized by **functional context** to make it easy to find relevant information:

```
react-native-background-location/
├── README.md                           # Main documentation (API reference, installation)
├── CHANGELOG.md                        # Version history
├── CONTRIBUTING.md                     # Contribution guidelines
├── CODE_OF_CONDUCT.md                  # Code of conduct
├── LICENSE                             # MIT License
│
├── docs/                               # All documentation
│   ├── README.md                       # Documentation index
│   ├── STRUCTURE.md                    # This file
│   │
│   ├── getting-started/                # New users start here
│   │   ├── QUICKSTART.md               # 5-minute quick start guide
│   │   ├── INTEGRATION_GUIDE.md        # Detailed integration steps
│   │   ├── IOS_SETUP.md                # iOS-specific setup guide
│   │   ├── hooks.md                    # React Hooks API guide (6 hooks)
│   │   ├── geofencing.md               # Geofencing guide (API, hooks, types)
│   │   └── REAL_TIME_UPDATES.md        # useLocationUpdates guide
│   │
│   ├── production/                     # Before publishing your app
│   │   ├── GOOGLE_PLAY_COMPLIANCE.md   # Play Store requirements
│   │   ├── APP_STORE_COMPLIANCE.md     # App Store requirements (iOS)
│   │   ├── BATTERY_OPTIMIZATION.md     # Platform-specific battery management
│   │   ├── CRASH_RECOVERY.md           # Session persistence
│   │   └── PLATFORM_COMPARISON.md      # Android vs iOS differences
│   │
│   ├── development/                    # For maintainers/contributors
│   │   ├── CICD.md                     # CI/CD workflows
│   │   ├── PUBLISHING.md               # Publishing to npm
│   │   ├── TESTING.md                  # Testing procedures
│   │   ├── IMPLEMENTATION_SUMMARY.md   # Technical implementation
│   │   └── REALTIME_DEBUG_GUIDE.md     # Real-time debugging
│   │
│   ├── geofencing/                     # Geofencing planning & analysis
│   │   ├── ADVANCED_USAGE.md           # Server-driven geofencing, callbacks, examples
│   │   ├── BUSINESS_CASE.md            # Geofencing business case & justification
│   │   └── TECHNICAL_PLAN.md           # Geofencing technical implementation plan
│   │
│   └── ios/                            # iOS planning & analysis
│       ├── BUSINESS_REQUIREMENTS.md    # iOS requirements analysis
│       └── IOS_IMPLEMENTATION_PLAN.md  # Implementation plan
│
├── .github/                            # GitHub configuration
│   ├── workflows/                      # GitHub Actions workflows
│   │   ├── ci.yml                      # CI workflow
│   │   ├── publish.yml                 # Production publish
│   │   └── prerelease.yml              # Beta publish
│   └── actions/                        # Reusable actions
│       └── setup/                      # Setup action
│
├── src/                                # Library source code
├── android/                            # Android native code
├── ios/                                # iOS native code (Swift + Objective-C++)
└── example/                            # Example app
```

## 📖 Documentation Categories

### Root Level

Files that should be immediately accessible:

- **README.md** - Main entry point, API reference, installation instructions
- **CHANGELOG.md** - Version history and release notes
- **CONTRIBUTING.md** - How to contribute to the project
- **LICENSE** - MIT license

### docs/getting-started/

Documentation for **new users** and **integration**:

| File                     | Purpose                     | Audience                              |
| ------------------------ | --------------------------- | ------------------------------------- |
| **QUICKSTART.md**        | Get running in 5 minutes    | New users                             |
| **INTEGRATION_GUIDE.md** | Step-by-step integration    | Developers adding to existing app     |
| **IOS_SETUP.md**         | iOS-specific configuration  | Developers building for iOS           |
| **hooks.md**             | React Hooks API guide       | Developers using React Hooks          |
| **geofencing.md**        | Geofencing guide            | Developers implementing geofencing    |
| **REAL_TIME_UPDATES.md** | Real-time location watching | Developers using useLocationUpdates   |

### docs/production/

Documentation for **production readiness**:

| File                          | Purpose                              | Audience                            |
| ----------------------------- | ------------------------------------ | ----------------------------------- |
| **GOOGLE_PLAY_COMPLIANCE.md** | Play Store approval requirements     | Developers publishing to Play Store |
| **APP_STORE_COMPLIANCE.md**   | App Store approval requirements      | Developers publishing to App Store  |
| **BATTERY_OPTIMIZATION.md**   | Platform-specific battery management | Developers, QA                      |
| **CRASH_RECOVERY.md**         | Session persistence and recovery     | Developers                          |
| **PLATFORM_COMPARISON.md**    | Android vs iOS differences           | Developers targeting both platforms |
### docs/geofencing/

Documentation for **geofencing planning and analysis**:

| File                  | Purpose                              | Audience                              |
| --------------------- | ------------------------------------ | ------------------------------------- |
| **ADVANCED_USAGE.md** | Server-driven geofencing, callbacks, full examples | Developers building production apps   |
| **BUSINESS_CASE.md**  | Business justification for geofencing | Product managers, stakeholders        |
| **TECHNICAL_PLAN.md** | Technical implementation plan         | Contributors, maintainers             |

### docs/development/

Documentation for **maintainers** and **contributors**:

| File                          | Purpose                        | Audience                     |
| ----------------------------- | ------------------------------ | ---------------------------- |
| **CICD.md**                   | CI/CD workflows and automation | Maintainers, DevOps          |
| **PUBLISHING.md**             | How to publish to npm          | Maintainers                  |
| **TESTING.md**                | Testing procedures             | Contributors                 |
| **IMPLEMENTATION_SUMMARY.md** | Technical details              | Contributors, advanced users |
| **REALTIME_DEBUG_GUIDE.md**   | Real-time debugging tools      | Contributors, maintainers    |

## 🔗 Navigation Flow

### For New Users

```
README.md
   ↓
docs/getting-started/QUICKSTART.md
   ↓
docs/getting-started/INTEGRATION_GUIDE.md
   ↓
example/src/App.tsx (reference implementation)
```

### For Contributors

```
CONTRIBUTING.md
   ↓
docs/development/IMPLEMENTATION_SUMMARY.md
   ↓
docs/development/PUBLISHING.md
```

### For Maintainers

```
docs/development/CICD.md (setup)
   ↓
docs/development/PUBLISHING.md
   ↓
CHANGELOG.md (update)
   ↓
Automated Release (GitHub Actions)
```

## 📝 Documentation Guidelines

### When to Create New Documentation

Create new documentation files in:

1. **docs/getting-started/** when:
   - Adding new installation methods
   - Creating platform-specific setup guides
   - Adding usage tutorials

2. **docs/development/** when:
   - Documenting internal architecture
   - Adding contribution workflows
   - Documenting testing procedures

### Naming Conventions

- Use **SCREAMING_SNAKE_CASE.md** for standalone important docs
- Use **lowercase-with-dashes.md** for contextual/nested docs
- Always include a clear, descriptive name

### File Organization Rules

1. **Root level** = High-priority, frequently accessed docs
2. **docs/getting-started/** = User-facing documentation
3. **docs/development/** = Internal/contributor documentation
4. **Keep it DRY** = Don't duplicate, link instead

## 🔄 Cross-References

### From README.md

Links to detailed guides in `docs/`:

- Quick Start → `docs/getting-started/QUICKSTART.md`
- Integration → `docs/getting-started/INTEGRATION_GUIDE.md`
- Publishing → `docs/development/PUBLISHING.md`

### From docs/README.md

Central hub linking to all documentation categories

### Within docs/

Use relative paths:

- Same level: `[Link](FILENAME.md)`
- Up one level: `[Link](../FILENAME.md)`
- Different category: `[Link](../other-category/FILENAME.md)`

## 🎯 Future Structure

As the library grows, consider adding:

```
docs/
├── getting-started/
├── development/
├── api/                    # Detailed API documentation
│   ├── methods.md
│   ├── types.md
│   └── errors.md
├── guides/                 # How-to guides
│   ├── battery-optimization.md
│   ├── testing.md
│   └── troubleshooting.md
├── platforms/              # Platform-specific docs
│   ├── android/
│   │   ├── setup.md
│   │   └── permissions.md
│   └── ios/
│       ├── setup.md
│       └── permissions.md
└── examples/               # Additional examples
    ├── basic-tracking.md
    ├── advanced-features.md
    └── server-integration.md
```

## ✅ Checklist for New Documentation

When adding new documentation:

- [ ] Choose the correct category folder
- [ ] Use appropriate naming convention
- [ ] Add entry to `docs/README.md` index
- [ ] Update main `README.md` if needed
- [ ] Include code examples where relevant
- [ ] Add cross-references to related docs
- [ ] Update this STRUCTURE.md if adding new categories

## Current Documentation Stats

- **Total docs:** 27 files
- **Getting Started:** 6 guides (Quick Start, Integration, iOS Setup, Hooks, Geofencing, Real-Time Updates)
- **Production:** 6 guides (Google Play Compliance, App Store Compliance, Battery Optimization, Crash Recovery, Platform Comparison, Migration)
- **Development:** 5 guides (CI/CD, Publishing, Testing, Implementation, Real-Time Debug)
- **Geofencing:** 3 files (Advanced Usage, Business Case, Technical Plan)
- **iOS Planning:** 2 files (Business Requirements, Implementation Plan)
- **Root level:** 5 files (README, CHANGELOG, CONTRIBUTING, etc.)
- **Workflows:** 3 automated workflows (CI, Publish, Pre-release)

---

**Last Updated:** March 24, 2026
**Version:** 0.12.0
