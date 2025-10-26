# Documentation Structure

This document describes the organization of documentation for `react-native-background-location`.

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
│   │
│   ├── getting-started/                # 🚀 New users start here
│   │   ├── QUICKSTART.md               # 5-minute quick start guide
│   │   └── INTEGRATION_GUIDE.md        # Detailed integration steps
│   │
│   └── development/                    # 🛠 For maintainers/contributors
│       ├── PUBLISHING.md               # Publishing to npm
│       └── IMPLEMENTATION_SUMMARY.md   # Technical implementation details
│
├── src/                                # Library source code
├── android/                            # Android native code
├── ios/                                # iOS native code (coming soon)
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

| File | Purpose | Audience |
|------|---------|----------|
| **QUICKSTART.md** | Get running in 5 minutes | New users |
| **INTEGRATION_GUIDE.md** | Step-by-step integration | Developers adding to existing app |

### docs/development/
Documentation for **maintainers** and **contributors**:

| File | Purpose | Audience |
|------|---------|----------|
| **PUBLISHING.md** | How to publish to npm | Maintainers |
| **IMPLEMENTATION_SUMMARY.md** | Technical details | Contributors, advanced users |

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
docs/development/PUBLISHING.md
   ↓
CHANGELOG.md (update)
   ↓
Release
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

## 📊 Current Documentation Stats

- **Total docs:** 9 files
- **Getting Started:** 2 guides
- **Development:** 2 guides
- **Root level:** 5 files (README, CHANGELOG, CONTRIBUTING, etc.)

---

**Last Updated:** October 26, 2025  
**Version:** 0.1.0

