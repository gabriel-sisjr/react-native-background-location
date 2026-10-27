---
sidebar_position: 1
title: Google Play Compliance
description: Google Play Store requirements for apps using background location — in-app disclosure, privacy policy, Play Console declarations, manifest entries, the health-related motion activity permission, and common rejection reasons.
keywords:
  - google play
  - background location
  - compliance
  - privacy policy
  - data safety
  - disclosure
  - ACCESS_BACKGROUND_LOCATION
  - ACTIVITY_RECOGNITION
  - health apps declaration
  - foreground service
  - android
---

# Google Play Compliance

Apps using background location must comply with Google Play's policies. **Non-compliance will result in app rejection or removal from the store.**

This guide covers all requirements for publishing an app that uses `@gabriel-sisjr/react-native-background-location`.

## Overview of Requirements

| Requirement | Description | Consequence of Missing |
|---|---|---|
| In-App Disclosure | Prominent dialog explaining background usage | Rejection |
| Privacy Policy | Explicit mention of location collection | Rejection |
| Data Safety Form | Declare location in Play Console | Rejection |
| Permissions Declaration | Submit justification form | Rejection |
| Core Functionality | Background location must be essential | Rejection |

## Step 1: In-App Disclosure (Required)

Google requires a **prominent disclosure** shown **before** requesting background location permission.

### Requirements

The disclosure must:

- Be shown **before** the permission request
- Be a **blocking dialog** (not a toast, snackbar, or inline text)
- Clearly explain **what data** is collected
- Explain **why** background access is needed
- Explain **how** the data is used
- Allow the user to **decline**

### Implementation

```typescript
import { Alert } from 'react-native';

/**
 * Shows required disclosure before requesting background location.
 * Returns true if user accepts, false if they decline.
 */
async function showLocationDisclosure(): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      'Background Location Access',

      'This app collects your location data even when the app is closed or not in use.\n\n' +
        'WHY WE NEED THIS:\n' +
        'To track your trips and routes accurately, we need to collect your location in the background.\n\n' +
        'WHAT WE COLLECT:\n' +
        '• GPS coordinates\n' +
        '• Timestamps\n' +
        '• Movement speed\n\n' +
        'HOW WE USE IT:\n' +
        '• Record your travel routes\n' +
        '• Calculate trip distances and duration\n' +
        '• Provide real-time fleet management updates\n' +
        '• Track delivery routes and estimated arrival times\n' +
        '• Record fitness activities such as running and cycling\n\n' +
        'You can stop tracking at any time from within the app.',

      [
        {
          text: 'Decline',
          onPress: () => resolve(false),
          style: 'cancel',
        },
        {
          text: 'Accept & Continue',
          onPress: () => resolve(true),
        },
      ],
      { cancelable: false }
    );
  });
}

// Usage - MUST be called before permission request
async function handleEnableTracking() {
  // Step 1: Show disclosure
  const accepted = await showLocationDisclosure();

  if (!accepted) {
    Alert.alert(
      'Permission Required',
      'Background location is required for trip tracking. You can enable it later in Settings.'
    );
    return;
  }

  // Step 2: Request permissions (after disclosure accepted)
  const granted = await requestLocationPermissions();

  if (granted) {
    // Step 3: Start tracking
    await startTracking();
  }
}
```

> Make sure you have `import { startTracking } from '@gabriel-sisjr/react-native-background-location';` at the top of the file.

### Custom Disclosure Screen (Recommended)

For a better user experience, create a dedicated disclosure screen instead of a simple alert:

```typescript
import React from 'react';
import { View, Text, Button, ScrollView, StyleSheet } from 'react-native';

interface LocationDisclosureScreenProps {
  onAccept: () => void;
  onDecline: () => void;
}

function LocationDisclosureScreen({ onAccept, onDecline }: LocationDisclosureScreenProps) {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Location Access Required</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>What We Collect</Text>
        <Text style={styles.bullet}>• Your GPS location coordinates</Text>
        <Text style={styles.bullet}>• Timestamps of each location</Text>
        <Text style={styles.bullet}>• Speed and direction of movement</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>When We Collect</Text>
        <Text style={styles.body}>
          We collect your location even when the app is closed or running in the
          background. This is necessary for accurate trip tracking.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>How We Use Your Data</Text>
        <Text style={styles.bullet}>• Record your travel routes</Text>
        <Text style={styles.bullet}>• Calculate trip distances</Text>
        <Text style={styles.bullet}>• Generate trip statistics</Text>
        <Text style={styles.bullet}>• [Your specific uses]</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your Control</Text>
        <Text style={styles.body}>
          You can stop tracking at any time from the app. You can also revoke
          location permission in your device settings.
        </Text>
      </View>

      <View style={styles.buttonContainer}>
        <Button title="Decline" onPress={onDecline} color="#888" />
        <View style={styles.buttonSpacer} />
        <Button title="Accept & Continue" onPress={onAccept} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  body: { fontSize: 16, lineHeight: 22 },
  bullet: { fontSize: 16, marginLeft: 10, marginBottom: 4 },
  buttonContainer: { flexDirection: 'row', marginTop: 20 },
  buttonSpacer: { width: 20 },
});
```

## Step 2: Privacy Policy (Required)

Your privacy policy **must** explicitly address location data collection.

### Required Elements

Your privacy policy must include:

1. **What data is collected** -- GPS coordinates, timestamps, any derived data (speed, distance)
2. **When it's collected** -- While in foreground, while in background, when app is closed
3. **How it's used** -- Primary purpose (trip tracking), any secondary uses, whether shared with third parties
4. **Retention period** -- How long data is stored locally, how long on servers, when it's deleted
5. **User rights** -- How to view their data, how to request deletion, how to stop collection

### Sample Privacy Policy Section

```markdown
## Location Data

### What We Collect

We collect precise location data (GPS coordinates) from your device, including:

- Latitude and longitude coordinates
- Timestamps of each location point
- Speed and direction of movement
- Altitude (when available)

### When We Collect

Location data is collected:

- While the app is open and in use
- While the app is running in the background
- Even when the app is closed (if tracking is enabled)

### Why We Collect

We collect location data to:

- Track and record your trips
- Calculate trip distances and duration
- Generate route maps and statistics

### How Long We Keep It

- Local device: Until you delete the trip or clear app data
- Our servers: [Your retention period, e.g., "90 days" or "Until you request deletion"]

### Your Rights

You can:

- Stop location collection at any time by stopping tracking in the app
- Delete individual trips and their location data
- Request complete deletion of your data by contacting [your email]
- Revoke location permission in your device settings
```

## Step 3: Play Console -- Data Safety Form

In the Google Play Console, navigate to **App content > Data safety**.

### Location Data Declaration

Declare the following:

| Question | Answer |
|---|---|
| Does your app collect location data? | **Yes** |
| Is this data collected, shared, or both? | **Collected** (and Shared if applicable) |
| Is this data processed ephemerally? | **No** (it's stored) |
| Is this data required for your app? | **Yes** |
| Why is this data collected? | App functionality |

### Data Types to Declare

- **Approximate location**: Yes (if using `BALANCED_POWER_ACCURACY` or lower)
- **Precise location**: Yes (if using `HIGH_ACCURACY`)

### Data Handling

| Question | Answer |
|---|---|
| Is data encrypted in transit? | Yes (if using HTTPS) |
| Can users request data deletion? | Yes (provide mechanism) |

## Step 4: Play Console -- Permissions Declaration

For `ACCESS_BACKGROUND_LOCATION`, you must submit a declaration form.

### Navigation

1. Go to Play Console
2. Select your app
3. Navigate to **App content > Sensitive app permissions**
4. Find **Background location access**
5. Click **Manage**

### Form Fields

#### Core Functionality Description

Explain why background location is essential:

```text
Trip tracking is the core functionality of our app. Users start a trip and
expect their route to be recorded continuously, even when:
- The phone screen is off
- The app is minimized
- The user is using other apps

Without background location access, trips would have large gaps in the route,
making the tracking feature unusable and defeating the primary purpose of the app.
```

#### User-Facing Feature Description

```text
Users can:
1. Start a trip from the app
2. Put their phone away (screen off, app minimized)
3. Travel to their destination
4. Open the app to see their complete route

The continuous background tracking ensures no part of the journey is missed.
```

#### Video Demonstration

Record a video showing:

1. Opening the app
2. The disclosure dialog being shown
3. Granting permissions
4. Starting a trip
5. Minimizing the app / turning off screen
6. Moving around (can simulate with emulator)
7. Reopening the app
8. Showing the recorded route

**Tips:**

- Keep it under 2 minutes
- Show the notification is visible
- Show the route being recorded accurately
- Demonstrate this is a core feature, not optional

## Step 5: Foreground-Only Alternative

If background location is not essential to your app, use foreground-only mode:

```typescript
import { startTracking } from '@gabriel-sisjr/react-native-background-location';

// No background permission required
const tripId = await startTracking(undefined, {
  foregroundOnly: true,
});
```

**Benefits:**

- Simpler permission flow
- No permissions declaration form
- Easier Play Store approval

**Limitations:**

- Tracking stops when app is backgrounded
- Gaps in route when user switches apps

## Motion Activity (Optional)

Motion activity is opt-in and off by default. If your app enables it on Android, the app declares and requests the activity recognition permission itself; the library manifest adds none.

Google Play lists `ACTIVITY_RECOGNITION` among the permissions it considers in scope of **health-related sensitive data**, and its Health apps policy also covers apps that are not primarily health apps but have health-related features and access health data. Treat the permission that way even if your app uses motion activity only to save battery. On Google Play, an app that enables motion activity therefore also needs:

1. A [prominent disclosure with affirmative consent](#prominent-disclosure-and-consent) before `requestMotionPermission()`
2. An accurate [Health apps declaration](#health-apps-declaration) in Play Console
3. A [Data safety](#data-safety-for-motion-data) entry when motion-derived data leaves the device

### Manifest Entries

Add both entries to your app's `AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.ACTIVITY_RECOGNITION" />
<uses-permission
    android:name="com.google.android.gms.permission.ACTIVITY_RECOGNITION"
    android:maxSdkVersion="28" />
```

- `ACTIVITY_RECOGNITION` is a runtime permission on Android 10+ (API 29+). Request it with `requestMotionPermission()` before `startTracking()`; `startTracking()` never prompts.
- On Android 9 (API 28) and lower, the Google Play services permission, limited by `android:maxSdkVersion="28"`, is granted at install time when declared.
- With Expo, the `motionActivity` config plugin prop adds both entries (see [Expo Setup](../guides/motion-activity.md#expo-setup)).
- If you stop using motion activity, remove both entries; otherwise the app keeps declaring a health-related permission. With Expo, delete the prop and run `npx expo prebuild --clean`, because an incremental prebuild keeps the permissions it added.

See [Android Setup](../guides/motion-activity.md#android-setup) and [Requesting the Permission](../guides/motion-activity.md#requesting-the-permission) for details.

### Prominent Disclosure and Consent

For the permissions in scope of health-related sensitive data, Google Play states that an app that requires any of them "must prominently disclose how user data will be used, describe the type of data being accessed, and have the user provide affirmative consent for such use". Before you call `requestMotionPermission()`:

- Show a prominent in-app disclosure, like the [background location disclosure](#step-1-in-app-disclosure-required), that says **what** is detected (stationary, walking, running, cycling or in a vehicle), **why** (for example, to reduce location updates while the vehicle is parked) and **whether** any of it leaves the device.
- Request the permission only after the user explicitly accepts. If the user declines, start the trip without `motionActivity`: tracking continues at full accuracy.

```typescript
import { Alert } from 'react-native';
import {
  requestMotionPermission,
  startTracking,
} from '@gabriel-sisjr/react-native-background-location';

/**
 * Disclosure for the health-related ACTIVITY_RECOGNITION permission.
 * Resolves true only when the user accepts.
 */
async function showMotionDisclosure(): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      'Motion Activity',

      'This app uses physical activity data (stationary, walking, running, cycling or in a vehicle) ' +
        'to reduce location updates while your vehicle is parked, which saves battery.\n\n' +
        'The activity data is processed on this device and is not sent anywhere.',

      [
        {
          text: 'Decline',
          onPress: () => resolve(false),
          style: 'cancel',
        },
        {
          text: 'Accept & Continue',
          onPress: () => resolve(true),
        },
      ],
      { cancelable: false }
    );
  });
}

// After the location disclosure and the location permissions
async function startTripWithMotion(tripId: string) {
  const accepted = await showMotionDisclosure();

  if (!accepted) {
    // No consent: do not request the permission, track at full accuracy
    return startTracking(tripId);
  }

  await requestMotionPermission();

  // Without the permission the session warns once and tracks at full accuracy
  return startTracking(tripId, {
    motionActivity: { reduceWhenStationary: true },
  });
}
```

Adapt the text to your app: state your own reason, and say so if your app sends activity data, or data derived from it, off the device.

### Health Apps Declaration

Google Play requires every developer with an app published on Google Play to complete the **Health apps** declaration, on the **App content** page (**Policy > App content**) in Play Console. The form asks apps that provide health features, or that access health data to support non-health features, to declare one or more of its listed features. Read its guidance before you select "My app doesn't provide any health features" for an app that requests `ACTIVITY_RECOGNITION`, and keep your answers consistent with how the app uses motion activity.

### Data Safety for Motion Data

The Data safety form covers data that your app collects, and Google defines collecting as transmitting data off the user's device. The library processes motion activity on the device and never sends it anywhere. If your app sends motion-derived data (for example detected activities or stationary periods) off the device, declare it in the Data safety form (**App content > Data safety**) under **Health and fitness > Fitness info**, which Google describes as "Information about a user's fitness, such as exercise or other physical activity."

### Foreground Service Notification While Reduced

While the stationary reduction is active, the foreground-service notification shows `reduceWhenStationary.notificationText` as its content text. The default is the English `'Location updates reduced while stationary'`. The title, icon, actions and channel stay the same, and your own text returns when full accuracy is restored. If your app is not in English, localize this text with `notificationText` (see [Android Notification Text](../guides/motion-activity.md#android-notification-text)).

## Common Rejection Reasons

| Reason | Solution |
|---|---|
| "Disclosure not prominent" | Use blocking Alert/Modal, not inline text |
| "Disclosure shown after permission" | Show disclosure BEFORE calling `requestPermissions` |
| "Background location not essential" | Better explain core functionality or use `foregroundOnly` |
| "Missing privacy policy disclosure" | Update privacy policy with location section |
| "Video doesn't show feature" | Re-record showing complete user flow |
| "Explanation too vague" | Be specific about what, when, why for location |

## Checklist Before Submission

### In-App

- [ ] Disclosure dialog shown before permission request
- [ ] Disclosure explains what, when, why
- [ ] User can decline disclosure
- [ ] Permission requested in two steps (Android 11+)
- [ ] Foreground service notification is clear

### Privacy Policy

- [ ] Location collection mentioned
- [ ] Background collection mentioned
- [ ] Usage purposes listed
- [ ] Retention period stated
- [ ] Deletion mechanism described

### Play Console

- [ ] Data safety form completed
- [ ] Location data declared
- [ ] Permissions declaration form submitted
- [ ] Demonstration video uploaded
- [ ] Core functionality explanation provided

### Motion Activity (If Enabled)

- [ ] `ACTIVITY_RECOGNITION` declared in the app manifest and requested at runtime on Android 10+
- [ ] Google Play services permission declared with `android:maxSdkVersion="28"` for Android 9 and lower
- [ ] Prominent disclosure of the motion data use shown before `requestMotionPermission()`, and the permission requested only after the user accepts
- [ ] Health apps declaration completed (**Policy > App content**) and consistent with how the app uses motion activity
- [ ] Motion-derived data that leaves the device declared in the Data safety form under **Health and fitness > Fitness info**
- [ ] Reduced notification text localized with `notificationText` for non-English apps

## Testing Before Submission

1. **Fresh install test**: Uninstall app, install from Play Console internal testing
2. **Permission flow test**: Verify disclosure > permission > tracking flow
3. **Background test**: Verify tracking works when app is backgrounded
4. **Kill test**: Verify data persists when app is killed

## See Also

- [Background Location Tracking](../guides/background-tracking.md) -- Implementation guide
- [Permissions](../getting-started/permissions.md) -- Permission setup and hooks
- [App Store Compliance](./app-store-compliance.md) -- iOS equivalent requirements
- [Motion Activity](../guides/motion-activity.md) -- Opt-in motion activity setup and permissions
- [Android Background Location Policy](https://support.google.com/googleplay/android-developer/answer/9799150) -- Official Google documentation
- [Health app categories and additional information](https://support.google.com/googleplay/android-developer/answer/13996367) -- Permissions in scope of health-related sensitive data, disclosure and consent
- [Health apps declaration form](https://support.google.com/googleplay/android-developer/answer/14738291) -- The Play Console declaration
- [Health Content and Services](https://support.google.com/googleplay/android-developer/answer/16555673) -- The Health apps policy
- [Data safety section](https://support.google.com/googleplay/android-developer/answer/10787469) -- Data types, including Fitness info
