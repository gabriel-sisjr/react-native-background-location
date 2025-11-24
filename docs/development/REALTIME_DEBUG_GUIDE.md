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

## Next Steps

If the problem persists even after these fixes, please share:

1. Complete Logcat logs
2. Screenshots of the app showing the problem
3. The tracking configuration you're using
4. Whether you're using a physical device or emulator

## File Changes

### `BackgroundLocationModule.kt`
- Added `initialize()` method to re-configure React Context
- React context is set before starting the service
- React context is set when recovering sessions

### `LocationService.kt`
- Added debug logs at key points
- Improved React Context validation before emitting events
- Added React instance active check

