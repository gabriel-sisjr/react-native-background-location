# Background Location Example App

Example React Native application demonstrating `@gabriel-sisjr/react-native-background-location`.

## What It Demonstrates

- **Permission flow** -- Two-step Android 11+ permission request (foreground, then background)
- **Background location tracking** -- Start/stop trips with foreground service
- **Real-time updates** -- Live location display via `useLocationUpdates` hook
- **Notification customization** -- Custom icons, colors, action buttons, and subtext
- **Stored location management** -- View, refresh, and clear collected coordinates
- **Crash recovery** -- Resume tracking after app restart or process death

## Running the Example

From the repository root:

```bash
# Install dependencies
yarn

# Start Metro bundler
yarn example start

# Run on Android device/emulator
yarn example android
```

## Configuration Presets

The example app includes several tracking presets:

| Preset | Interval | Distance Filter | Accuracy | Use Case |
|--------|----------|-----------------|----------|----------|
| High Accuracy | 5s | 0m | HIGH_ACCURACY | Real-time tracking |
| Balanced | 15s | 25m | BALANCED | General purpose |
| Low Power | 60s | 100m | LOW_POWER | Long-duration trips |

## Project Structure

```
example/
  src/
    App.tsx           # Main app with tracking controls and live map
  android/            # Android-specific configuration
  ios/                # iOS configuration (stub)
```

## Requirements

- Android device or emulator (API 24+)
- Google Play Services installed on the device
- Location services enabled

## See Also

- [Quick Start Guide](../docs/getting-started/QUICKSTART.md)
- [Hooks API Guide](../docs/getting-started/hooks.md)
- [Integration Guide](../docs/getting-started/INTEGRATION_GUIDE.md)
