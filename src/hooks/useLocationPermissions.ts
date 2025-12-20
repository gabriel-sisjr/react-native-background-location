import { useState, useCallback } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
import { LocationPermissionStatus } from '../types';
import type { UseLocationPermissionsResult, PermissionState } from '../types';

/**
 * Hook to manage location permissions for background tracking
 *
 * Handles requesting and checking location permissions on Android.
 * Includes foreground (FINE, COARSE) and background permissions.
 *
 * @example
 * ```tsx
 * function App() {
 *   const { permissionStatus, requestPermissions, isRequesting } = useLocationPermissions();
 *
 *   if (!permissionStatus.hasPermission) {
 *     return <Button onPress={requestPermissions}>Grant Permissions</Button>;
 *   }
 *
 *   return <TrackingScreen />;
 * }
 * ```
 */
export function useLocationPermissions(): UseLocationPermissionsResult {
  const [isRequesting, setIsRequesting] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<PermissionState>({
    hasPermission: false,
    status: LocationPermissionStatus.UNDETERMINED,
    canRequestAgain: true,
  });

  /**
   * Check current permission status without requesting
   */
  const checkPermissions = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== 'android') {
      // iOS to be implemented
      setPermissionStatus({
        hasPermission: false,
        status: LocationPermissionStatus.UNDETERMINED,
        canRequestAgain: true,
      });
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

      // Check notification permission for Android 13+
      let notificationPermission = true;
      if (Platform.Version >= 33) {
        notificationPermission = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
        );
      }

      const allGranted =
        fineLocation &&
        coarseLocation &&
        backgroundLocation &&
        notificationPermission;

      setPermissionStatus({
        hasPermission: allGranted,
        status: allGranted
          ? LocationPermissionStatus.GRANTED
          : LocationPermissionStatus.DENIED,
        canRequestAgain: true,
      });

      return allGranted;
    } catch (error) {
      console.error('Error checking permissions:', error);
      return false;
    }
  }, []);

  /**
   * Request all required location permissions
   */
  const requestPermissions = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== 'android') {
      // iOS to be implemented
      console.warn('iOS permissions not yet implemented');
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

        setPermissionStatus({
          hasPermission: false,
          status: canRequestAgain
            ? LocationPermissionStatus.DENIED
            : LocationPermissionStatus.BLOCKED,
          canRequestAgain,
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

          setPermissionStatus({
            hasPermission: false,
            status: canRequestAgain
              ? LocationPermissionStatus.DENIED
              : LocationPermissionStatus.BLOCKED,
            canRequestAgain,
          });

          return false;
        }
      }

      // Step 3: Request notification permission for Android 13+
      let notificationGranted = true;
      if (Platform.Version >= 33) {
        const notificationResult = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
          {
            title: 'Notification Permission',
            message:
              'This app needs notification permission to show location tracking status.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );

        notificationGranted =
          notificationResult === PermissionsAndroid.RESULTS.GRANTED;

        if (!notificationGranted) {
          const canRequestAgain =
            notificationResult !== PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN;

          setPermissionStatus({
            hasPermission: false,
            status: canRequestAgain
              ? LocationPermissionStatus.DENIED
              : LocationPermissionStatus.BLOCKED,
            canRequestAgain,
          });

          return false;
        }
      }

      // All permissions granted
      setPermissionStatus({
        hasPermission: true,
        status: LocationPermissionStatus.GRANTED,
        canRequestAgain: true,
      });

      return true;
    } catch (error) {
      console.error('Error requesting permissions:', error);
      setPermissionStatus({
        hasPermission: false,
        status: LocationPermissionStatus.DENIED,
        canRequestAgain: true,
      });
      return false;
    } finally {
      setIsRequesting(false);
    }
  }, []);

  return {
    permissionStatus,
    requestPermissions,
    checkPermissions,
    isRequesting,
  };
}
