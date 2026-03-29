import { useState, useCallback, useMemo } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
import {
  LocationPermissionStatus,
  NotificationPermissionStatus,
} from '../types';
import type {
  UseLocationPermissionsResult,
  PermissionState,
  LocationPermissionState,
  NotificationPermissionState,
} from '../types';
import BackgroundLocationModule from '../NativeBackgroundLocation';
import type { PermissionStatusResult } from '../NativeBackgroundLocation';

/**
 * Module-level flag to prevent repeated notification denial warnings in __DEV__.
 * Intentionally module-scoped (not useRef) for once-per-app-session behavior.
 */
let notificationWarned = false;

/**
 * Emits a console.warn once per session when notification permission is denied in __DEV__
 */
function warnNotificationDenied(status: string): void {
  if (status !== 'granted' && __DEV__ && !notificationWarned) {
    console.warn(
      '[BackgroundLocation] Notification permission was denied. Geofence visual notifications will not appear. Background tracking is unaffected.'
    );
    notificationWarned = true;
  }
}

/**
 * Maps native permission status string to LocationPermissionStatus enum
 */
function mapNativeStatus(status: string): LocationPermissionStatus {
  switch (status) {
    case 'granted':
      return LocationPermissionStatus.GRANTED;
    case 'whenInUse':
      return LocationPermissionStatus.WHEN_IN_USE;
    case 'denied':
      return LocationPermissionStatus.DENIED;
    case 'blocked':
      return LocationPermissionStatus.BLOCKED;
    default:
      return LocationPermissionStatus.UNDETERMINED;
  }
}

/**
 * Converts a native PermissionStatusResult to a LocationPermissionState
 */
function toLocationPermissionState(
  result: PermissionStatusResult
): LocationPermissionState {
  const status = mapNativeStatus(result.status);
  return {
    hasPermission:
      status === LocationPermissionStatus.GRANTED ||
      status === LocationPermissionStatus.WHEN_IN_USE,
    status,
    canRequestAgain: result.canRequestAgain,
  };
}

/**
 * Requests Android notification permission using PermissionsAndroid on API 33+,
 * falling back to the native module on older versions where the permission is auto-granted.
 */
async function requestAndroidNotificationPermission(): Promise<string> {
  if (Number(Platform.Version) >= 33) {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
    );
    return result === PermissionsAndroid.RESULTS.GRANTED ? 'granted' : 'denied';
  }
  return BackgroundLocationModule.requestNotificationPermission();
}

/**
 * Checks Android notification permission using PermissionsAndroid on API 33+,
 * falling back to the native module on older versions where the permission is auto-granted.
 */
async function checkAndroidNotificationPermission(): Promise<string> {
  if (Number(Platform.Version) >= 33) {
    const granted = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
    );
    return granted ? 'granted' : 'denied';
  }
  return BackgroundLocationModule.checkNotificationPermission();
}

/**
 * Maps a native notification permission status string to NotificationPermissionState
 */
function toNotificationPermissionState(
  status: string
): NotificationPermissionState {
  let mappedStatus: NotificationPermissionStatus;
  switch (status) {
    case 'granted':
      mappedStatus = NotificationPermissionStatus.GRANTED;
      break;
    case 'denied':
      mappedStatus = NotificationPermissionStatus.DENIED;
      break;
    default:
      mappedStatus = NotificationPermissionStatus.UNDETERMINED;
      break;
  }

  return {
    hasPermission: mappedStatus === NotificationPermissionStatus.GRANTED,
    status: mappedStatus,
    canRequestAgain: mappedStatus === NotificationPermissionStatus.UNDETERMINED,
  };
}

/**
 * Hook to manage location and notification permissions for background tracking
 *
 * Provides granular permission state separating location and notification permissions.
 * Notification permission denial is non-blocking — background tracking only requires
 * location permissions. Notification denial only affects geofence visual notifications.
 *
 * Android: Uses PermissionsAndroid for location and notification permissions (API 33+), falling back to native module for notifications on older SDKs.
 * iOS: Uses CLLocationManager authorization (WhenInUse -> Always two-step flow) + native module for notifications.
 *
 * @example
 * ```tsx
 * function App() {
 *   const { permissionStatus, requestPermissions, isRequesting } = useLocationPermissions();
 *
 *   if (!permissionStatus.location.hasPermission) {
 *     return <Button onPress={requestPermissions}>Grant Location Permissions</Button>;
 *   }
 *
 *   if (!permissionStatus.notification.hasPermission) {
 *     return <Text>Notifications disabled - geofence alerts won't appear</Text>;
 *   }
 *
 *   return <TrackingScreen />;
 * }
 * ```
 */
export function useLocationPermissions(): UseLocationPermissionsResult {
  const [isRequesting, setIsRequesting] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<PermissionState>({
    hasAllPermissions: false,
    location: {
      hasPermission: false,
      status: LocationPermissionStatus.UNDETERMINED,
      canRequestAgain: true,
    },
    notification: {
      hasPermission: false,
      status: NotificationPermissionStatus.UNDETERMINED,
      canRequestAgain: true,
    },
  });

  /**
   * Check current permission status without requesting
   * @returns true if location permissions are granted
   */
  const checkPermissions = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'ios') {
      try {
        const [locationResult, notificationStatus] = await Promise.all([
          BackgroundLocationModule.checkLocationPermission(),
          BackgroundLocationModule.checkNotificationPermission(),
        ]);

        const location = toLocationPermissionState(locationResult);
        const notification = toNotificationPermissionState(notificationStatus);

        setPermissionStatus({
          hasAllPermissions:
            location.hasPermission && notification.hasPermission,
          location,
          notification,
        });

        return location.hasPermission;
      } catch (error) {
        console.error('Error checking iOS permissions:', error);
        return false;
      }
    }

    if (Platform.OS !== 'android') {
      return false;
    }

    try {
      const fineLocation = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      );
      const coarseLocation = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION
      );

      // Check background location for Android 10+
      let backgroundLocation = true;
      if (Platform.Version >= 29) {
        backgroundLocation = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION
        );
      }

      const locationGranted =
        fineLocation && coarseLocation && backgroundLocation;

      const location: LocationPermissionState = {
        hasPermission: locationGranted,
        status: locationGranted
          ? LocationPermissionStatus.GRANTED
          : LocationPermissionStatus.DENIED,
        canRequestAgain: true,
      };

      // Check notification permission (PermissionsAndroid on API 33+, native module on older)
      const notificationStatus = await checkAndroidNotificationPermission();
      const notification = toNotificationPermissionState(notificationStatus);

      setPermissionStatus({
        hasAllPermissions: location.hasPermission && notification.hasPermission,
        location,
        notification,
      });

      return location.hasPermission;
    } catch (error) {
      console.error('Error checking permissions:', error);
      return false;
    }
  }, []);

  /**
   * Request all required permissions (location + notification).
   *
   * Returns true if location permissions are granted.
   * Notification permission is requested but its denial does not
   * affect the return value — check `permissionStatus.notification`
   * for notification-specific state.
   */
  const requestPermissions = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'ios') {
      setIsRequesting(true);
      try {
        // Step 1: Request location permission (WhenInUse → Always escalation)
        const locationResult =
          await BackgroundLocationModule.requestLocationPermission(false);
        const location = toLocationPermissionState(locationResult);

        // Step 2: Request notification permission (non-blocking)
        const notificationStatus =
          await BackgroundLocationModule.requestNotificationPermission();
        const notification = toNotificationPermissionState(notificationStatus);

        warnNotificationDenied(notificationStatus);

        setPermissionStatus({
          hasAllPermissions:
            location.hasPermission && notification.hasPermission,
          location,
          notification,
        });

        return location.hasPermission;
      } catch (error) {
        console.error('Error requesting iOS permissions:', error);
        setPermissionStatus({
          hasAllPermissions: false,
          location: {
            hasPermission: false,
            status: LocationPermissionStatus.DENIED,
            canRequestAgain: false,
          },
          notification: {
            hasPermission: false,
            status: NotificationPermissionStatus.UNDETERMINED,
            canRequestAgain: true,
          },
        });
        return false;
      } finally {
        setIsRequesting(false);
      }
    }

    if (Platform.OS !== 'android') {
      return false;
    }

    setIsRequesting(true);

    try {
      // Step 1: Request foreground permissions first
      const foregroundPermissions = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
      ]);

      const foregroundGranted =
        foregroundPermissions['android.permission.ACCESS_FINE_LOCATION'] ===
          PermissionsAndroid.RESULTS.GRANTED &&
        foregroundPermissions['android.permission.ACCESS_COARSE_LOCATION'] ===
          PermissionsAndroid.RESULTS.GRANTED;

      if (!foregroundGranted) {
        const canRequestAgain =
          foregroundPermissions['android.permission.ACCESS_FINE_LOCATION'] !==
            PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN &&
          foregroundPermissions['android.permission.ACCESS_COARSE_LOCATION'] !==
            PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN;

        const location: LocationPermissionState = {
          hasPermission: false,
          status: canRequestAgain
            ? LocationPermissionStatus.DENIED
            : LocationPermissionStatus.BLOCKED,
          canRequestAgain,
        };

        // Still request notification even if location denied
        const notificationStatus = await requestAndroidNotificationPermission();
        const notification = toNotificationPermissionState(notificationStatus);
        warnNotificationDenied(notificationStatus);

        setPermissionStatus({
          hasAllPermissions: false,
          location,
          notification,
        });

        return false;
      }

      // Step 2: Request background permission for Android 10+
      let backgroundGranted = true;
      if (Platform.Version >= 29) {
        const backgroundResult = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
          {
            title: 'Background Location Permission',
            message:
              'This app needs access to your location in the background to track your trips.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );

        backgroundGranted =
          backgroundResult === PermissionsAndroid.RESULTS.GRANTED;

        if (!backgroundGranted) {
          const canRequestAgain =
            backgroundResult !== PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN;

          const location: LocationPermissionState = {
            hasPermission: false,
            status: canRequestAgain
              ? LocationPermissionStatus.DENIED
              : LocationPermissionStatus.BLOCKED,
            canRequestAgain,
          };

          // Still request notification even if background location denied
          const notificationStatus =
            await requestAndroidNotificationPermission();
          const notification =
            toNotificationPermissionState(notificationStatus);
          warnNotificationDenied(notificationStatus);

          setPermissionStatus({
            hasAllPermissions: false,
            location,
            notification,
          });

          return false;
        }
      }

      // Step 3: Request notification permission (PermissionsAndroid on API 33+, native module on older)
      const notificationStatus = await requestAndroidNotificationPermission();
      const notification = toNotificationPermissionState(notificationStatus);
      warnNotificationDenied(notificationStatus);

      const location: LocationPermissionState = {
        hasPermission: true,
        status: LocationPermissionStatus.GRANTED,
        canRequestAgain: true,
      };

      setPermissionStatus({
        hasAllPermissions: location.hasPermission && notification.hasPermission,
        location,
        notification,
      });

      return true;
    } catch (error) {
      console.error('Error requesting permissions:', error);
      setPermissionStatus({
        hasAllPermissions: false,
        location: {
          hasPermission: false,
          status: LocationPermissionStatus.DENIED,
          canRequestAgain: true,
        },
        notification: {
          hasPermission: false,
          status: NotificationPermissionStatus.UNDETERMINED,
          canRequestAgain: true,
        },
      });
      return false;
    } finally {
      setIsRequesting(false);
    }
  }, []);

  return useMemo(
    () => ({
      permissionStatus,
      requestPermissions,
      checkPermissions,
      isRequesting,
    }),
    [permissionStatus, requestPermissions, checkPermissions, isRequesting]
  );
}
