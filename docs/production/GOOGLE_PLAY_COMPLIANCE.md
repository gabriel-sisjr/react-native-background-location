# Google Play Store Compliance

Apps using background location must comply with Google Play's policies. **Non-compliance will result in app rejection or removal from the store.**

This guide covers all requirements for publishing an app that uses `@gabriel-sisjr/react-native-background-location`.

## Overview of Requirements

| Requirement | Description | Consequence of Missing |
|-------------|-------------|----------------------|
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
 * Shows required disclosure before requesting background location
 * Returns true if user accepts, false if they decline
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
      '• [Add your specific use cases]\n\n' +

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
    // User declined - don't request permission
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
    await BackgroundLocation.startTracking();
  }
}
```

### Custom Disclosure Screen (Recommended for Better UX)

For a better user experience, create a dedicated disclosure screen:

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

1. **What data is collected**
   - GPS coordinates
   - Timestamps
   - Any derived data (speed, distance, etc.)

2. **When it's collected**
   - While app is in foreground
   - While app is in background
   - When app is closed

3. **How it's used**
   - Primary purpose (trip tracking)
   - Any secondary uses
   - Whether shared with third parties

4. **Retention period**
   - How long data is stored locally
   - How long data is stored on servers
   - When it's deleted

5. **User rights**
   - How to view their data
   - How to request deletion
   - How to stop collection

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

## Step 3: Play Console - Data Safety Form

In the Google Play Console, navigate to **App content → Data safety**.

### Location Data Declaration

Declare the following:

| Question | Answer |
|----------|--------|
| Does your app collect location data? | **Yes** |
| Is this data collected, shared, or both? | **Collected** (and Shared if applicable) |
| Is this data processed ephemerally? | **No** (it's stored) |
| Is this data required for your app? | **Yes** |
| Why is this data collected? | App functionality |

### Data Types to Declare

- **Approximate location**: Yes (if using BALANCED_POWER_ACCURACY or lower)
- **Precise location**: Yes (if using HIGH_ACCURACY)

### Data Handling

| Question | Answer |
|----------|--------|
| Is data encrypted in transit? | Yes (if using HTTPS) |
| Can users request data deletion? | Yes (provide mechanism) |

## Step 4: Play Console - Permissions Declaration

For `ACCESS_BACKGROUND_LOCATION`, you must submit a declaration form.

### Navigation

1. Go to Play Console
2. Select your app
3. Navigate to **App content → Sensitive app permissions**
4. Find **Background location access**
5. Click **Manage**

### Form Fields

#### 1. Core Functionality Description

Explain why background location is essential:

```
Trip tracking is the core functionality of our app. Users start a trip and
expect their route to be recorded continuously, even when:
- The phone screen is off
- The app is minimized
- The user is using other apps

Without background location access, trips would have large gaps in the route,
making the tracking feature unusable and defeating the primary purpose of the app.
```

#### 2. User-Facing Feature Description

```
Users can:
1. Start a trip from the app
2. Put their phone away (screen off, app minimized)
3. Travel to their destination
4. Open the app to see their complete route

The continuous background tracking ensures no part of the journey is missed.
```

#### 3. Video Demonstration

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

If background location isn't essential, use foreground-only mode:

```typescript
// No background permission required
const tripId = await BackgroundLocation.startTracking(undefined, {
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

## Common Rejection Reasons

| Reason | Solution |
|--------|----------|
| "Disclosure not prominent" | Use blocking Alert/Modal, not inline text |
| "Disclosure shown after permission" | Show disclosure BEFORE calling requestPermissions |
| "Background location not essential" | Better explain core functionality or use foregroundOnly |
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

## Testing Before Submission

1. **Fresh install test**: Uninstall app, install from Play Console internal testing
2. **Permission flow test**: Verify disclosure → permission → tracking flow
3. **Background test**: Verify tracking works when app is backgrounded
4. **Kill test**: Verify data persists when app is killed

## See Also

- [Integration Guide](../getting-started/INTEGRATION_GUIDE.md) - Implementation steps
- [Battery Optimization](./BATTERY_OPTIMIZATION.md) - Related compliance topic
- [Android Background Location Policy](https://support.google.com/googleplay/android-developer/answer/9799150) - Official Google documentation
