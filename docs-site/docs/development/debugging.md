---
sidebar_position: 5
title: Debugging
description: Debugging real-time location events on Android and iOS. Log filtering, emulator location simulation, common problems and solutions, and platform-specific debugging tools.
keywords:
  - debugging
  - logcat
  - xcode
  - location-simulation
  - troubleshooting
  - android
  - ios
  - react-native
  - background-location
---

# Debugging Guide

This guide covers debugging real-time location events, platform-specific debugging tools, and common patterns for diagnosing issues with `@gabriel-sisjr/react-native-background-location`.

---

## Android Debugging

### Viewing Logs with Logcat

Open a terminal and filter for location-related logs:

```bash
# Filter only LocationService logs
adb logcat | grep LocationService
```

Or to see all relevant logs:

```bash
adb logcat | grep -E "(LocationService|BackgroundLocation)"
```

### Testing Steps

1. Start the example app
2. Grant location permissions (including "Allow all the time")
3. Keep Auto-Update Mode enabled (switch should be ON)
4. Tap "Start Tracking"
5. Observe the logs:

```text
D/LocationService: Setting React context: true
D/LocationService: Starting location tracking for tripId: <ID>
D/LocationService: Received X location(s)
D/LocationService: Handling location: lat=..., lng=..., tripId=...
D/LocationService: Location update event emitted for tripId: <ID>
```

6. In the app, verify that:
   - The "Last Location (Live)" section appears and updates
   - The "Locations (X)" counter increases automatically

### Simulating Location in Android Emulator

To simulate location movement in the Android emulator:

1. Open **Extended Controls** panel (three dots `...` on the emulator side)
2. Go to **Location**
3. Choose an option:
   - **Single points:** Set a specific location
   - **Routes:** Simulate a route (e.g., City bicycle ride)
   - **GPX/KML file:** Import a file with a route
4. Click "Play Route" to simulate movement

### Expected Logs (Working Correctly)

```text
D/LocationService: Setting React context: true
D/LocationService: Starting location tracking for tripId: abc-123
D/LocationService: Received 1 location(s)
D/LocationService: Handling location: lat=37.422, lng=-122.084, tripId=abc-123
D/LocationService: Location update event emitted for tripId: abc-123
```

### Problem Logs and Solutions

**"React context not available"**

```text
W/LocationService: React context not available - cannot emit location update event
```

Solution: Reload the app (Cmd+M or Shake > Reload).

**"React instance not active"**

```text
W/LocationService: React instance not active - skipping location update event
```

Solution: Wait a few seconds after opening the app before starting tracking.

**"Received 0 location(s)"**

```text
D/LocationService: Received 0 location(s)
```

Problem: GPS/Location in emulator is not configured correctly. See [Simulating Location in Android Emulator](#simulating-location-in-android-emulator).

---

## iOS Debugging

### Xcode Console

To view native iOS logs for the location module:

1. Open the project in Xcode (`example/ios/BackgroundLocationExample.xcworkspace`)
2. Run the app on a simulator or device
3. Open the **Debug Area** console (View > Debug Area > Activate Console)
4. Filter logs by searching for `BackgroundLocation` or `LocationManager`

Expected logs when tracking is working:

```text
BackgroundLocation: Starting location updates for tripId: abc-123
BackgroundLocation: CLLocationManager authorized: authorizedAlways
BackgroundLocation: Received location update: lat=37.422, lng=-122.084
BackgroundLocation: Location stored in Core Data, batch count: 5
BackgroundLocation: Event emitted to JS: onLocationUpdate
```

### Simulating Location in iOS Simulator

#### Using the Simulator Menu

1. Run the app on the iOS Simulator
2. Go to **Features > Location** in the Simulator menu
3. Choose from:
   - **None** -- No location
   - **Custom Location...** -- Set specific coordinates
   - **City Bicycle Ride** -- Simulates cycling movement
   - **City Run** -- Simulates running movement
   - **Freeway Drive** -- Simulates highway driving

#### Using GPX Files

For more realistic and repeatable testing, create a `.gpx` file:

```xml
<?xml version="1.0"?>
<gpx version="1.1" creator="Test">
  <wpt lat="37.7749" lon="-122.4194">
    <time>2026-01-01T00:00:00Z</time>
  </wpt>
  <wpt lat="37.7750" lon="-122.4195">
    <time>2026-01-01T00:00:05Z</time>
  </wpt>
</gpx>
```

Then:
1. Add the GPX file to your Xcode project
2. Edit your scheme: **Product > Scheme > Edit Scheme > Run > Options**
3. Under **Default Location**, select your GPX file

#### Using Xcode Scheme Location

1. **Product > Scheme > Edit Scheme**
2. Go to **Run > Options**
3. Check **Allow Location Simulation**
4. Select a **Default Location** or add a custom GPX file

### Debugging Background Location on iOS

Background location on iOS requires special debugging techniques:

1. **Do NOT attach the Xcode debugger** when testing background behavior -- the debugger keeps the app alive artificially
2. Instead, use `os_log` or `NSLog` statements and view them in **Console.app** (Applications > Utilities > Console)
3. Filter Console.app by your app's process name

To test true background behavior:

1. Start tracking in the app
2. Press Home to background the app
3. Move around (or use GPX simulation)
4. Return to the app and verify locations were collected
5. Check Console.app for background location delivery logs

### Inspecting Core Data

To inspect the Core Data SQLite database on the iOS Simulator:

1. Find the app's data directory:

   ```bash
   # List simulators
   xcrun simctl list devices

   # Find the app container
   xcrun simctl get_app_container <DEVICE_ID> <BUNDLE_ID> data
   ```

2. Navigate to `Library/Application Support/` in the container
3. Open the `.sqlite` file with any SQLite browser (e.g., DB Browser for SQLite)

The database contains:

| Table | Contents |
| --- | --- |
| `ZLOCATIONENTITY` | All stored location points |
| `ZTRACKINGSTATEENTITY` | Current tracking state and options |

---

## Common Problems and Solutions

### No Locations Received

**Cause:** GPS disabled or no simulated location configured.

**Solution:**
- **Android:** Configure a location in the emulator's Extended Controls
- **iOS:** Use Features > Location in the Simulator menu

### Locations Received but Not Appearing in App

**Cause:** React Context is not active or event is not being listened to.

**Solution:**
1. Reload the app
2. Verify that "Auto-Update Mode" is enabled in the example app
3. Check logs for `Setting React context: true` (Android) or `Event emitted to JS` (iOS)

### Updates Are Slow

**Cause:** Configuration with `updateInterval` set too high.

**Solution:** Use the "High Accuracy" preset which updates every 2 seconds. The example app has 4 presets:

| Preset | Interval | Use Case |
| --- | --- | --- |
| Default | 5s | Balanced |
| High Accuracy | 2s | Best for testing |
| Balanced | 10s | Battery saving |
| Low Power | 30s | Maximum battery saving |

### Permission Error

**Cause:** Location permissions not granted or revoked.

**Solution:**
- **Android:** Go to Settings > Apps > BackgroundLocationExample > Permissions > Location > "Allow all the time"
- **iOS:** Go to Settings > Privacy > Location Services > [Your App] > Always

### No Locations on iOS Simulator

**Cause:** No simulated location configured.

**Solution:** Use Features > Location in the Simulator menu.

### Background Tracking Stops on iOS Device

**Cause:** Missing Background Mode capability or Info.plist entries.

**Solution:**
1. Verify "Location updates" is checked in Background Modes
2. Verify both `NSLocationWhenInUseUsageDescription` and `NSLocationAlwaysAndWhenInUseUsageDescription` are in Info.plist
3. Verify the user granted "Always" permission (not just "While Using")

### iOS Permission Stuck at "WhenInUse"

**Cause:** iOS only shows the Always prompt once. If the user dismisses it, they must go to Settings.

**Solution:** Guide the user to Settings > Privacy > Location Services > [Your App] > Always.

### iOS Locations Have Poor Accuracy

**Cause:** Simulator provides approximated locations.

**Solution:** Test on a real device for accurate GPS data.

---

## Verification Checklist

To confirm everything is working:

- [ ] App compiles without errors
- [ ] Permissions were granted
- [ ] Logs show React context is set (Android: `React context: true`)
- [ ] Logs show locations are being received
- [ ] Logs show events are being emitted to JS
- [ ] App shows live location updates
- [ ] Location counter increases automatically

---

## Reporting Issues

If the problem persists after following this guide, please provide:

1. Complete Logcat logs (Android) or Console.app logs (iOS)
2. Screenshots of the app showing the problem
3. The tracking configuration you are using
4. Whether you are using a physical device, Android emulator, or iOS simulator
5. The platform and OS version
6. Output of `npx react-native info`
