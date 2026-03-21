# Real-Time Location Updates Debug Guide

## Problem Identified

During testing, location was not being updated in real-time in the example app.

## Applied Fixes

### 1. **Ensure React Context is Always Set**

- Added `initialize()` method in `BackgroundLocationModule` to re-configure React context
- React context is now set before starting the location service
- Context is re-set when recovering tracking sessions

### 2. **Debug Logs Added**

Logs were added at key points in the flow:

- `LocationService`: When locations are received
- `LocationService`: When React context is set
- `LocationService`: When events are emitted to React Native
- `LocationService`: When the service is started

### 3. **Improved React Context Validation**

`LocationService` now checks:

- If React context is available
- If React instance is active before emitting events

## How to Test

### 1. **Check Logs in Logcat**

Open terminal and run:

```bash
# Filter only LocationService logs
adb logcat | grep LocationService
```

Or to see all relevant logs:

```bash
adb logcat | grep -E "(LocationService|BackgroundLocation)"
```

### 2. **Test Steps**

1. **Start the example app**
2. **Grant location permissions** (including "Allow all the time")
3. **Keep Auto-Update Mode enabled** (switch should be ON)
4. **Tap "Start Tracking"**
5. **Observe the logs** to see:

   ```
   D/LocationService: Setting React context: true
   D/LocationService: Starting location tracking for tripId: <ID>
   D/LocationService: Received X location(s)
   D/LocationService: Handling location: lat=..., lng=..., tripId=...
   D/LocationService: Location update event emitted for tripId: <ID>
   ```

6. **In the app**, verify that:
   - The "Last Location (Live)" section appears and updates
   - The "Locations (X)" counter increases automatically
   - You see logs in console: `New location received: ...`

### 3. **Test Location in Emulator**

To simulate location movement in Android emulator:

1. Open **Extended Controls** panel (three dots `...` on emulator side)
2. Go to **Location**
3. Choose one of the options:
   - **Single points**: Set a specific location
   - **Routes**: Simulate a route (e.g., City bicycle ride)
   - **GPX/KML file**: Import a file with a route

4. Click "Play Route" to simulate movement

### 4. **What to Check in Logs**

#### ✅ **Expected Logs (Working)**

```
D/LocationService: Setting React context: true
D/LocationService: Starting location tracking for tripId: abc-123
D/LocationService: Received 1 location(s)
D/LocationService: Handling location: lat=37.422, lng=-122.084, tripId=abc-123
D/LocationService: Location update event emitted for tripId: abc-123
```

#### ❌ **Problem Logs**

If you see:

```
W/LocationService: React context not available - cannot emit location update event
```

**Solution**: Reload the app (Cmd+M or Shake -> Reload)

If you see:

```
W/LocationService: React instance not active - skipping location update event
```

**Solution**: Wait a few seconds after opening the app before starting tracking

If you don't see location logs:

```
D/LocationService: Received 0 location(s)
```

**Problem**: GPS/Location in emulator is not configured correctly

### 5. **Common Problems and Solutions**

#### **Problem 1: No locations received**

- **Cause**: GPS disabled or no simulated location
- **Solution**: Configure a location in emulator (see item 3)

#### **Problem 2: Locations received but don't appear in app**

- **Cause**: React Context is not active or event is not being listened to
- **Solution**:
  1. Reload the app
  2. Verify that "Auto-Update Mode" is enabled
  3. Check logs for `Setting React context: true`

#### **Problem 3: Updates but takes too long**

- **Cause**: Configuration with updateInterval too high
- **Solution**: Use "High Accuracy" preset which updates every 2 seconds

#### **Problem 4: Permission error**

- **Cause**: Location permissions not granted or revoked
- **Solution**:
  1. Go to Settings > Apps > BackgroundLocationExample
  2. Permissions > Location > "Allow all the time"

## Configuration Presets

The example app has 4 presets:

1. **Default**: 5s interval (balanced)
2. **High Accuracy**: 2s interval (best for testing)
3. **Balanced**: 10s interval (battery saving)
4. **Low Power**: 30s interval (maximum battery saving)

For real-time testing, I recommend using **High Accuracy**.

## Final Verification

To confirm everything is working:

1. ✅ App compiles without errors
2. ✅ Permissions were granted
3. ✅ Logs show "React context: true"
4. ✅ Logs show "Received X location(s)"
5. ✅ Logs show "Location update event emitted"
6. ✅ App shows "Last Location (Live)" and updates
7. ✅ Location counter increases automatically

## iOS Debugging

### Xcode Console

To view native iOS logs for the location module:

1. Open the project in Xcode (`example/ios/BackgroundLocationExample.xcworkspace`)
2. Run the app on a simulator or device
3. Open the **Debug Area** console (View > Debug Area > Activate Console)
4. Filter logs by searching for `BackgroundLocation` or `LocationManager`

```
// Expected iOS logs when tracking is working:
BackgroundLocation: Starting location updates for tripId: abc-123
BackgroundLocation: CLLocationManager authorized: authorizedAlways
BackgroundLocation: Received location update: lat=37.422, lng=-122.084
BackgroundLocation: Location stored in Core Data, batch count: 5
BackgroundLocation: Event emitted to JS: onLocationUpdate
```

### Simulating Location in Xcode

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

For more realistic and repeatable testing:

1. Create a `.gpx` file with your test route:

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

2. Add the GPX file to your Xcode project
3. Edit your scheme: **Product > Scheme > Edit Scheme > Run > Options**
4. Under **Default Location**, select your GPX file

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

### Core Data Debugging

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

- `ZLOCATIONENTITY` -- All stored location points
- `ZTRACKINGSTATEENTITY` -- Current tracking state and options

### Common iOS Problems

#### Problem: No locations received on simulator

- **Cause:** No simulated location configured
- **Solution:** Use Features > Location in the Simulator menu

#### Problem: Background tracking stops on real device

- **Cause:** Missing Background Mode capability or Info.plist entries
- **Solution:**
  1. Verify "Location updates" is checked in Background Modes
  2. Verify both `NSLocationWhenInUseUsageDescription` and `NSLocationAlwaysAndWhenInUseUsageDescription` are in Info.plist
  3. Verify the user granted "Always" permission (not just "While Using")

#### Problem: Permission stuck at "WhenInUse"

- **Cause:** iOS only shows the Always prompt once. If the user dismisses it, they must go to Settings.
- **Solution:** Guide the user to Settings > Privacy > Location Services > [Your App] > Always

#### Problem: Locations have poor accuracy

- **Cause:** Simulator provides approximated locations
- **Solution:** Test on a real device for accurate GPS data

## Next Steps

If the problem persists even after these fixes, please share:

1. Complete Logcat logs (Android) or Console.app logs (iOS)
2. Screenshots of the app showing the problem
3. The tracking configuration you're using
4. Whether you're using a physical device, Android emulator, or iOS simulator
5. The platform and OS version

## File Changes

### `BackgroundLocationModule.kt`

- Added `initialize()` method to re-configure React Context
- React context is set before starting the service
- React context is set when recovering sessions

### `LocationService.kt`

- Added debug logs at key points
- Improved React Context validation before emitting events
- Added React instance active check
