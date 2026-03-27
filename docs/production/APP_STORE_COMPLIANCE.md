# App Store Compliance Guide

Apps using background location must comply with Apple's App Store Review Guidelines. This guide covers all requirements for publishing an iOS app that uses `@gabriel-sisjr/react-native-background-location`.

## Overview of Requirements

| Requirement                              | Guideline | Consequence of Missing        |
| ---------------------------------------- | --------- | ----------------------------- |
| Background location justification        | 2.5.4     | Rejection                     |
| Usage description strings                | 2.5.4     | Rejection                     |
| Privacy Nutrition Labels                 | 5.1.1     | Rejection                     |
| Data use and sharing disclosure          | 5.1.2     | Rejection                     |
| Privacy manifest (PrivacyInfo.xcprivacy) | 5.1.1     | Rejection (as of Spring 2024) |
| Minimum necessary data collection        | 5.1.1     | Rejection                     |

## Guideline 2.5.4: Background Location

Apple's guideline states:

> Apps that use background location services must provide a reason that is directly related to the app's core functionality. An app must not use background location for advertising, analytics, or to send to third-party data brokers.

### What Apple Looks For

1. **Clear justification** -- Background location must be essential to a core feature
2. **No alternatives** -- The feature cannot work with foreground-only location
3. **User benefit** -- The user directly benefits from background location
4. **Transparency** -- The user understands when and why location is being collected

### Acceptable Use Cases

- Fleet management and vehicle tracking
- Delivery route recording
- Fitness activity tracking (running, cycling)
- Navigation and turn-by-turn directions
- Geozone/geofence monitoring for safety

### Unacceptable Use Cases

- Analytics or advertising
- Collecting location without clear user benefit
- Sending location to third parties without explicit consent
- Features that work fine with foreground-only location

## Required Usage Description Strings

Your `Info.plist` must contain these keys with clear, specific descriptions:

### NSLocationWhenInUseUsageDescription

Shown when requesting "When In Use" permission.

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>We use your location to show your position on the map and record your trip route while you are using the app.</string>
```

### NSLocationAlwaysAndWhenInUseUsageDescription

Shown when escalating from "When In Use" to "Always" permission.

```xml
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>We need continuous access to your location to record your complete trip route, even when the app is in the background. This ensures no part of your journey is missed.</string>
```

### NSLocationAlwaysUsageDescription

Required for backwards compatibility.

```xml
<key>NSLocationAlwaysUsageDescription</key>
<string>We need continuous access to your location to record your complete trip route in the background.</string>
```

### Writing Effective Descriptions

**Do:**

- Explain the specific feature that needs location
- Use simple, non-technical language
- Tell the user what benefit they get
- Be honest about when data is collected

**Do not:**

- Use generic text like "This app uses your location"
- Include technical implementation details
- Reference APIs or frameworks
- Make the text too long (Apple reviewers scan these quickly)

### Examples by App Type

**Fleet management:**

```
We track your location continuously to record your driving routes, calculate mileage, and provide real-time fleet management updates to your organization. Location tracking continues in the background to ensure complete route records.
```

**Delivery app:**

```
We use your location in the background to track your delivery route, provide customers with live delivery updates, and calculate accurate trip distances. Background tracking ensures no delivery stops are missed.
```

**Fitness app:**

```
We track your location in the background to record your running or cycling routes, calculate distance and pace, and generate route maps. Background access ensures your entire workout is captured even when your phone is locked.
```

## Guideline 5.1.1: Data Collection and Storage

### Privacy Nutrition Labels

In App Store Connect, navigate to **App Privacy** and declare the following:

#### Location Data Types

| Data Type        | Collected | Linked to Identity  | Used for Tracking     |
| ---------------- | --------- | ------------------- | --------------------- |
| Precise Location | Yes       | Depends on your app | No (unless you track) |
| Coarse Location  | Yes       | Depends on your app | No (unless you track) |

#### Declaration Details

For each location data type, specify:

**Collection purposes:**

- App Functionality (primary)
- Analytics (if you analyze routes)
- Other purposes as applicable

**Linked to user?**

- If you associate location data with a user account: **Yes**
- If location data is anonymous: **No**

**Used for tracking?**

- If you share location data with third-party advertisers or data brokers: **Yes**
- If location data stays within your app/backend: **No**

### Steps in App Store Connect

1. Go to **App Store Connect** > Your App > **App Privacy**
2. Click **Get Started** or **Edit**
3. Select **Yes** for "Do you or your third-party partners collect data from this app?"
4. Click **Location** data type
5. Check **Precise Location** and **Coarse Location**
6. For each, specify:
   - Collection purposes
   - Whether linked to user identity
   - Whether used for tracking
7. Save and submit

## Guideline 5.1.2: Data Use and Sharing

If you send location data to your backend or share it with third parties:

- Your privacy policy must explicitly describe this
- Users must be able to understand what happens with their data
- You must obtain consent before sharing with third parties
- Data minimization: only collect what you actually need

### Privacy Policy Requirements

Your privacy policy must address:

1. **What location data is collected** -- GPS coordinates, timestamps, speed, altitude
2. **When it is collected** -- While app is in use, while in background
3. **How it is used** -- Trip recording, fleet management, route analysis
4. **Who it is shared with** -- Your backend, third parties (if any)
5. **How long it is stored** -- Local device storage duration, server retention period
6. **How users can control it** -- Stop tracking, delete data, revoke permission
7. **How it is protected** -- Encryption, secure transmission

## Privacy Manifest (PrivacyInfo.xcprivacy)

Starting Spring 2024, Apple requires privacy manifests for all SDKs and apps that access user data.

### Library-Level Manifest

The library includes `PrivacyInfo.xcprivacy` with these declarations:

```xml
<key>NSPrivacyCollectedDataTypes</key>
<array>
    <dict>
        <key>NSPrivacyCollectedDataType</key>
        <string>NSPrivacyCollectedDataTypePreciseLocation</string>
        <key>NSPrivacyCollectedDataTypeLinked</key>
        <false/>
        <key>NSPrivacyCollectedDataTypeTracking</key>
        <false/>
        <key>NSPrivacyCollectedDataTypePurposes</key>
        <array>
            <string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string>
        </array>
    </dict>
    <dict>
        <key>NSPrivacyCollectedDataType</key>
        <string>NSPrivacyCollectedDataTypeCoarseLocation</string>
        <key>NSPrivacyCollectedDataTypeLinked</key>
        <false/>
        <key>NSPrivacyCollectedDataTypeTracking</key>
        <false/>
        <key>NSPrivacyCollectedDataTypePurposes</key>
        <array>
            <string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string>
        </array>
    </dict>
</array>
```

### App-Level Manifest

Your app must also have its own `PrivacyInfo.xcprivacy`. If your app links location to user identity or uses it for additional purposes, update the app-level manifest accordingly:

```xml
<!-- Example: Location linked to user identity for fleet management -->
<dict>
    <key>NSPrivacyCollectedDataType</key>
    <string>NSPrivacyCollectedDataTypePreciseLocation</string>
    <key>NSPrivacyCollectedDataTypeLinked</key>
    <true/>  <!-- Linked to driver account -->
    <key>NSPrivacyCollectedDataTypeTracking</key>
    <false/>
    <key>NSPrivacyCollectedDataTypePurposes</key>
    <array>
        <string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string>
        <string>NSPrivacyCollectedDataTypePurposeAnalytics</string>
    </array>
</dict>
```

## Common Rejection Reasons and How to Avoid Them

### 1. "Insufficient justification for background location"

**Problem:** Apple does not believe your app needs background location.

**Solution:**

- In the review notes, clearly explain the feature that requires background location
- Include a demo video showing the feature in action
- Explain why foreground-only location is insufficient
- If possible, offer a `foregroundOnly` mode as a fallback

**Review notes template:**

```
Our app is a fleet management tool for commercial drivers. Background
location is used to record complete driving routes for mileage tracking
and compliance. Without background location, routes would have gaps
whenever the driver locks their screen or switches apps, making the
records unreliable and unusable for regulatory compliance.

To test: Log in with the test account, start a trip, lock the screen,
wait 30 seconds, unlock and verify the route was recorded continuously.
```

### 2. "Usage description strings are too vague"

**Problem:** Your `NSLocation*` descriptions do not adequately explain why location is needed.

**Solution:** Rewrite descriptions to be specific to your app's features. See the examples in the "Required Usage Description Strings" section above.

### 3. "Background location indicator not visible"

**Problem:** Apple expects the blue status bar indicator to be visible during background tracking.

**Solution:** This library sets `showsBackgroundLocationIndicator = true` automatically when `foregroundOnly` is `false`. Verify this works by starting background tracking and observing the blue bar. Do not disable this indicator.

### 4. "Privacy manifest missing or incomplete"

**Problem:** Required since Spring 2024.

**Solution:** Ensure both the library's `PrivacyInfo.xcprivacy` (bundled automatically via CocoaPods) and your app-level manifest are present and accurate.

### 5. "App collects more data than necessary"

**Problem:** You are collecting precise location when coarse would suffice.

**Solution:**

- Use `LocationAccuracy.BALANCED_POWER_ACCURACY` or lower if you don't need precise GPS
- Document why precise location is needed if you do use it
- Only collect the minimum data fields required

### 6. "No way for user to stop tracking"

**Problem:** Apple requires users to have control over data collection.

**Solution:**

- Provide a clear "Stop Tracking" button in your app
- Stop tracking immediately when the button is pressed
- Do not restart tracking without explicit user action
- Handle the case where the user revokes permission in Settings

## Background Location Justification Text

When submitting your app, Apple may ask you to justify background location usage in the review notes or in a separate form. Prepare this text:

### Template

```
BACKGROUND LOCATION JUSTIFICATION

Feature: [Your feature name]

How it works:
1. The user explicitly starts [feature] by tapping [button/action]
2. The app records GPS coordinates at [interval] intervals
3. Data is stored locally on-device in a Core Data database
4. The user can stop [feature] at any time
5. [Describe what happens with the data]

Why background location is required:
[Your feature] requires continuous location recording. If location
tracking stopped when the user locks their screen or switches to
another app, [explain the negative consequence - gaps in routes,
inaccurate data, etc.].

User controls:
- Users must explicitly start [feature]
- A blue status bar indicator is shown during background tracking
- Users can stop at any time via [describe mechanism]
- Users can revoke location permission in iOS Settings
- All data can be deleted by [describe mechanism]

Data handling:
- Location data is stored locally in Core Data
- [Describe if/how data is sent to your backend]
- [Describe data retention and deletion policies]
```

## Testing Checklist Before Submission

### Permissions

- [ ] `NSLocationWhenInUseUsageDescription` is present and descriptive
- [ ] `NSLocationAlwaysAndWhenInUseUsageDescription` is present and descriptive
- [ ] `NSLocationAlwaysUsageDescription` is present and descriptive
- [ ] Permission dialog appears with correct description text
- [ ] App works correctly with "When In Use" permission only
- [ ] App correctly handles denied permission (no crash, graceful fallback)
- [ ] `requestPermissions()` from the hook triggers the system escalation prompt from "When In Use" to "Always"
- [ ] Geofence registration works correctly after permissions are granted via `requestPermissions()`

### Background Behavior

- [ ] Blue status bar indicator appears during background tracking
- [ ] Location updates continue when app is backgrounded
- [ ] Location updates continue when screen is locked
- [ ] Tracking stops cleanly when user presses stop
- [ ] App does not restart tracking without user action

### Privacy

- [ ] `PrivacyInfo.xcprivacy` is bundled (library-level)
- [ ] App-level `PrivacyInfo.xcprivacy` is present if required
- [ ] Privacy Nutrition Labels are configured in App Store Connect
- [ ] Privacy policy is updated and linked in App Store Connect
- [ ] Privacy policy is accessible from within the app

### Data Handling

- [ ] Location data is stored securely
- [ ] User can view their collected data
- [ ] User can delete their collected data
- [ ] Data is not sent to unauthorized third parties

### Edge Cases

- [ ] App handles permission revocation mid-session gracefully
- [ ] App handles location services disabled at system level
- [ ] App handles restricted location (parental controls)
- [ ] App works correctly after device reboot

## Foreground-Only Alternative

If your app does not need background location, use foreground-only mode to simplify compliance:

```typescript
const tripId = await BackgroundLocation.startTracking({
  foregroundOnly: true,
});
```

**Benefits:**

- No "Always" permission required
- Simpler App Store review
- No background location justification needed
- No blue status bar indicator

**Limitations:**

- Tracking pauses when app is backgrounded
- Gaps in route data when user switches apps

## See Also

- [iOS Setup Guide](../getting-started/IOS_SETUP.md) -- Initial setup and configuration
- [iOS Background Behavior](./IOS_BACKGROUND_BEHAVIOR.md) -- How iOS handles background location
- [Google Play Compliance](./GOOGLE_PLAY_COMPLIANCE.md) -- Android equivalent requirements
- [Platform Comparison](./PLATFORM_COMPARISON.md) -- Android vs iOS differences
- [Apple App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) -- Official Apple documentation
