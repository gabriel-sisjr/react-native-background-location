# Documentation

Complete documentation for `@gabriel-sisjr/react-native-background-location` -- a cross-platform (Android and iOS) React Native library for background location tracking.

## 📚 Getting Started

Start here if you're new to the library:

- **[Quick Start Guide](getting-started/QUICKSTART.md)**
  Get up and running in 5 minutes with basic examples.

- **[Integration Guide](getting-started/INTEGRATION_GUIDE.md)**
  Step-by-step guide to integrate into your existing React Native app.

- **[React Hooks Guide](getting-started/hooks.md)**
  Complete guide to using React Hooks for easier integration and better DX.

- **[Geofencing Guide](getting-started/geofencing.md)**
  Complete guide to geofencing: API reference, hooks, types, platform differences, and troubleshooting.

- **[Geofencing Advanced Usage](geofencing/ADVANCED_USAGE.md)**
  Server-driven geofencing, programmatic callbacks, full combined example, and hook stability.

- **[Real-Time Updates Guide](getting-started/REAL_TIME_UPDATES.md)**
  Automatic location watching with `useLocationUpdates` hook.

- **[iOS Setup Guide](getting-started/IOS_SETUP.md)**
  iOS-specific configuration: Info.plist, Background Modes, CocoaPods, and privacy manifest.

- **[Real-Time Debug Guide](development/REALTIME_DEBUG_GUIDE.md)**
  Debugging tools and techniques for real-time location events.

## 🚀 Production

Essential guides before publishing your app:

- **[Google Play Compliance](production/GOOGLE_PLAY_COMPLIANCE.md)**
  Required steps for Play Store approval: disclosures, privacy policy, declarations.

- **[Battery Optimization](production/BATTERY_OPTIMIZATION.md)**
  Handling manufacturer-specific battery restrictions (Xiaomi, Huawei, Samsung, etc.).

- **[Crash Recovery](production/CRASH_RECOVERY.md)**
  Session persistence and recovery strategies for app restarts and crashes.

- **[App Store Compliance](production/APP_STORE_COMPLIANCE.md)**
  Required steps for Apple App Store approval with background location usage.

- **[Platform Comparison](production/PLATFORM_COMPARISON.md)**
  Detailed comparison of Android vs iOS behavior, features, and implementation differences.

## 🛠 Development

For maintainers and contributors:

- **[CI/CD Guide](development/CICD.md)**  
  Complete guide for automated testing, building, and publishing workflows.

- **[Publishing Guide](development/PUBLISHING.md)**  
  How to build and publish new versions to npm.

- **[Testing Guide](development/TESTING.md)**  
  Testing procedures and best practices.

- **[Implementation Summary](development/IMPLEMENTATION_SUMMARY.md)**  
  Technical overview of the architecture and implementation details.

## 🔗 Quick Links

- [Main README](../README.md) - Overview and API reference
- [Contributing Guide](../CONTRIBUTING.md) - How to contribute
- [Changelog](../CHANGELOG.md) - Version history
- [Example App](../example/) - Working example implementation

## 📱 Platform Documentation

### Android

- **Current Status:** Fully implemented
- **Features:**
  - Background location tracking via foreground service
  - Room Database storage
  - Dual provider (Fused + Android LocationManager)
  - Full notification customization
  - WorkManager crash recovery

### iOS

- **Current Status:** Fully implemented
- **Features:**
  - Background location tracking via CLLocationManager
  - Core Data persistence with batched writes
  - Two-step permission flow (WhenInUse → Always)
  - Significant location monitoring for crash recovery
  - System blue bar indicator (no custom notification)
- **iOS-Specific Docs:**
  - [iOS Setup Guide](getting-started/IOS_SETUP.md)
  - [App Store Compliance](production/APP_STORE_COMPLIANCE.md)
  - [iOS Background Behavior](ios/IOS_BACKGROUND_BEHAVIOR.md) (if available)

## 🆘 Need Help?

1. Check the [Troubleshooting section](../README.md#troubleshooting) in the main README
2. Review the [Example App](../example/src/App.tsx) for working code
3. Search [GitHub Issues](https://github.com/gabriel-sisjr/react-native-background-location/issues)
4. Create a new issue if you can't find a solution

## 📖 Documentation Structure

```
docs/
├── README.md                           # This file
├── STRUCTURE.md                        # Documentation organization
├── getting-started/                    # New users start here
│   ├── QUICKSTART.md                   # 5-minute setup guide
│   ├── INTEGRATION_GUIDE.md            # Detailed integration
│   ├── hooks.md                        # React Hooks API guide (6 hooks)
│   ├── geofencing.md                   # Geofencing guide (API, hooks, types)
│   └── REAL_TIME_UPDATES.md            # useLocationUpdates guide
├── production/                         # Before publishing
│   ├── GOOGLE_PLAY_COMPLIANCE.md       # Play Store requirements
│   ├── APP_STORE_COMPLIANCE.md         # App Store requirements (iOS)
│   ├── BATTERY_OPTIMIZATION.md         # Platform-specific battery management
│   ├── CRASH_RECOVERY.md               # Session persistence
│   └── PLATFORM_COMPARISON.md          # Android vs iOS differences
├── development/                        # For maintainers
│   ├── CICD.md                         # CI/CD and automation
│   ├── PUBLISHING.md                   # Release process
│   ├── TESTING.md                      # Testing guide
│   └── IMPLEMENTATION_SUMMARY.md       # Technical details
├── geofencing/                         # Geofencing planning & analysis
│   ├── ADVANCED_USAGE.md               # Server-driven geofencing, callbacks, examples
│   ├── BUSINESS_CASE.md                # Business case & justification
│   └── TECHNICAL_PLAN.md               # Technical implementation plan
└── ios/                                # iOS planning & analysis
    ├── BUSINESS_REQUIREMENTS.md        # iOS requirements analysis
    └── IOS_IMPLEMENTATION_PLAN.md      # Implementation plan
```

## Version

This documentation is for version **0.11.0** which includes:

- Android implementation (Kotlin, Room DB, WorkManager)
- iOS implementation (Swift, CLLocationManager, Core Data)
- Cross-platform React Hooks API (6 hooks)
- Real-time location updates via NativeEventEmitter
- Geofencing with ENTER, EXIT, and DWELL transitions (Android: GeofencingClient, iOS: CLLocationManager)
- Persistent storage (Room Database on Android, Core Data on iOS)
- Configurable notification appearance and action buttons (Android)
- Distance filtering and customizable update intervals
- Crash recovery (WorkManager on Android, significant location monitoring on iOS)
- Cross-platform permission management
- Automated CI/CD pipeline

---

**Need to add or update documentation?** See our [Contributing Guide](../CONTRIBUTING.md).
