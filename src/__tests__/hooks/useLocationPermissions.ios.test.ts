import { act, renderHook } from '@testing-library/react-native';
import { Platform, PermissionsAndroid } from 'react-native';
import { useLocationPermissions } from '../../hooks/useLocationPermissions';
import {
  LocationPermissionStatus,
  NotificationPermissionStatus,
} from '../../types';
import BackgroundLocationModule from '../../NativeBackgroundLocation';

describe('useLocationPermissions - iOS Specific Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'ios';
    (
      BackgroundLocationModule.checkNotificationPermission as jest.Mock
    ).mockResolvedValue('granted');
    (
      BackgroundLocationModule.requestNotificationPermission as jest.Mock
    ).mockResolvedValue('granted');
  });

  describe('WhenInUse status mapping', () => {
    it('should map whenInUse status to WHEN_IN_USE enum', async () => {
      (
        BackgroundLocationModule.checkLocationPermission as jest.Mock
      ).mockResolvedValueOnce({
        status: 'whenInUse',
        canRequestAgain: true,
      });

      const { result } = renderHook(() => useLocationPermissions());

      await act(async () => {
        await result.current.checkPermissions();
      });

      expect(result.current.permissionStatus.location.status).toBe(
        LocationPermissionStatus.WHEN_IN_USE
      );
    });

    it('should treat whenInUse as having permission (hasPermission = true)', async () => {
      (
        BackgroundLocationModule.checkLocationPermission as jest.Mock
      ).mockResolvedValueOnce({
        status: 'whenInUse',
        canRequestAgain: true,
      });

      const { result } = renderHook(() => useLocationPermissions());

      await act(async () => {
        const hasPermission = await result.current.checkPermissions();
        expect(hasPermission).toBe(true);
      });

      expect(result.current.permissionStatus.location.hasPermission).toBe(true);
    });

    it('should return true from requestPermissions when result is whenInUse', async () => {
      (
        BackgroundLocationModule.requestLocationPermission as jest.Mock
      ).mockResolvedValueOnce({
        status: 'whenInUse',
        canRequestAgain: true,
      });

      const { result } = renderHook(() => useLocationPermissions());

      await act(async () => {
        const granted = await result.current.requestPermissions();
        expect(granted).toBe(true);
      });

      expect(result.current.permissionStatus.location.hasPermission).toBe(true);
      expect(result.current.permissionStatus.location.status).toBe(
        LocationPermissionStatus.WHEN_IN_USE
      );
    });

    it('should preserve canRequestAgain from native result with whenInUse', async () => {
      (
        BackgroundLocationModule.checkLocationPermission as jest.Mock
      ).mockResolvedValueOnce({
        status: 'whenInUse',
        canRequestAgain: false,
      });

      const { result } = renderHook(() => useLocationPermissions());

      await act(async () => {
        await result.current.checkPermissions();
      });

      expect(result.current.permissionStatus.location.canRequestAgain).toBe(
        false
      );
    });
  });

  describe('Foreground-only permission request', () => {
    it('should call requestLocationPermission with false for Always authorization', async () => {
      (
        BackgroundLocationModule.requestLocationPermission as jest.Mock
      ).mockResolvedValueOnce({
        status: 'granted',
        canRequestAgain: false,
      });

      const { result } = renderHook(() => useLocationPermissions());

      await act(async () => {
        await result.current.requestPermissions();
      });

      expect(
        BackgroundLocationModule.requestLocationPermission
      ).toHaveBeenCalledWith(false);
      expect(
        BackgroundLocationModule.requestLocationPermission
      ).toHaveBeenCalledTimes(1);
    });

    it('should not call requestLocationPermission with true', async () => {
      (
        BackgroundLocationModule.requestLocationPermission as jest.Mock
      ).mockResolvedValueOnce({
        status: 'granted',
        canRequestAgain: false,
      });

      const { result } = renderHook(() => useLocationPermissions());

      await act(async () => {
        await result.current.requestPermissions();
      });

      expect(
        BackgroundLocationModule.requestLocationPermission
      ).not.toHaveBeenCalledWith(true);
    });
  });

  describe('Permission escalation flow (WhenInUse to Always)', () => {
    it('should reflect upgrade from whenInUse to granted after request', async () => {
      (
        BackgroundLocationModule.checkLocationPermission as jest.Mock
      ).mockResolvedValueOnce({
        status: 'whenInUse',
        canRequestAgain: true,
      });

      (
        BackgroundLocationModule.requestLocationPermission as jest.Mock
      ).mockResolvedValueOnce({
        status: 'granted',
        canRequestAgain: false,
      });

      const { result } = renderHook(() => useLocationPermissions());

      // Step 1: Check returns whenInUse
      await act(async () => {
        const hasPermission = await result.current.checkPermissions();
        expect(hasPermission).toBe(true);
      });

      expect(result.current.permissionStatus.location.status).toBe(
        LocationPermissionStatus.WHEN_IN_USE
      );

      // Step 2: Request upgrades to Always (granted)
      await act(async () => {
        const granted = await result.current.requestPermissions();
        expect(granted).toBe(true);
      });

      expect(result.current.permissionStatus.location.status).toBe(
        LocationPermissionStatus.GRANTED
      );
      expect(result.current.permissionStatus.location.hasPermission).toBe(true);
      expect(result.current.permissionStatus.location.canRequestAgain).toBe(
        false
      );
    });

    it('should remain whenInUse if user denies Always upgrade', async () => {
      (
        BackgroundLocationModule.checkLocationPermission as jest.Mock
      ).mockResolvedValueOnce({
        status: 'whenInUse',
        canRequestAgain: true,
      });

      (
        BackgroundLocationModule.requestLocationPermission as jest.Mock
      ).mockResolvedValueOnce({
        status: 'whenInUse',
        canRequestAgain: false,
      });

      const { result } = renderHook(() => useLocationPermissions());

      await act(async () => {
        await result.current.checkPermissions();
      });

      expect(result.current.permissionStatus.location.status).toBe(
        LocationPermissionStatus.WHEN_IN_USE
      );

      await act(async () => {
        const granted = await result.current.requestPermissions();
        expect(granted).toBe(true); // whenInUse still counts as having permission
      });

      expect(result.current.permissionStatus.location.status).toBe(
        LocationPermissionStatus.WHEN_IN_USE
      );
      expect(result.current.permissionStatus.location.canRequestAgain).toBe(
        false
      );
    });
  });

  describe('Permission downgrade detection', () => {
    it('should detect downgrade from granted to whenInUse via Settings', async () => {
      (
        BackgroundLocationModule.checkLocationPermission as jest.Mock
      ).mockResolvedValueOnce({
        status: 'granted',
        canRequestAgain: false,
      });

      const { result } = renderHook(() => useLocationPermissions());

      // First check: granted (Always)
      await act(async () => {
        const hasPermission = await result.current.checkPermissions();
        expect(hasPermission).toBe(true);
      });

      expect(result.current.permissionStatus.location.status).toBe(
        LocationPermissionStatus.GRANTED
      );

      // User changes to WhenInUse in Settings
      (
        BackgroundLocationModule.checkLocationPermission as jest.Mock
      ).mockResolvedValueOnce({
        status: 'whenInUse',
        canRequestAgain: false,
      });

      // Second check: whenInUse (downgraded)
      await act(async () => {
        const hasPermission = await result.current.checkPermissions();
        expect(hasPermission).toBe(true); // still has partial permission
      });

      expect(result.current.permissionStatus.location.status).toBe(
        LocationPermissionStatus.WHEN_IN_USE
      );
    });

    it('should detect downgrade from granted to denied via Settings', async () => {
      (
        BackgroundLocationModule.checkLocationPermission as jest.Mock
      ).mockResolvedValueOnce({
        status: 'granted',
        canRequestAgain: false,
      });

      const { result } = renderHook(() => useLocationPermissions());

      await act(async () => {
        await result.current.checkPermissions();
      });

      expect(result.current.permissionStatus.location.status).toBe(
        LocationPermissionStatus.GRANTED
      );
      expect(result.current.permissionStatus.location.hasPermission).toBe(true);

      // User revokes all location access in Settings
      (
        BackgroundLocationModule.checkLocationPermission as jest.Mock
      ).mockResolvedValueOnce({
        status: 'denied',
        canRequestAgain: false,
      });

      await act(async () => {
        const hasPermission = await result.current.checkPermissions();
        expect(hasPermission).toBe(false);
      });

      expect(result.current.permissionStatus.location.status).toBe(
        LocationPermissionStatus.DENIED
      );
      expect(result.current.permissionStatus.location.hasPermission).toBe(
        false
      );
    });

    it('should detect downgrade from whenInUse to denied via Settings', async () => {
      (
        BackgroundLocationModule.checkLocationPermission as jest.Mock
      ).mockResolvedValueOnce({
        status: 'whenInUse',
        canRequestAgain: true,
      });

      const { result } = renderHook(() => useLocationPermissions());

      await act(async () => {
        await result.current.checkPermissions();
      });

      expect(result.current.permissionStatus.location.hasPermission).toBe(true);

      (
        BackgroundLocationModule.checkLocationPermission as jest.Mock
      ).mockResolvedValueOnce({
        status: 'denied',
        canRequestAgain: false,
      });

      await act(async () => {
        const hasPermission = await result.current.checkPermissions();
        expect(hasPermission).toBe(false);
      });

      expect(result.current.permissionStatus.location.status).toBe(
        LocationPermissionStatus.DENIED
      );
    });
  });

  describe('Restricted vs Denied distinction', () => {
    it('should map restricted (blocked) status with canRequestAgain false', async () => {
      (
        BackgroundLocationModule.checkLocationPermission as jest.Mock
      ).mockResolvedValueOnce({
        status: 'blocked',
        canRequestAgain: false,
      });

      const { result } = renderHook(() => useLocationPermissions());

      await act(async () => {
        const hasPermission = await result.current.checkPermissions();
        expect(hasPermission).toBe(false);
      });

      expect(result.current.permissionStatus.location.status).toBe(
        LocationPermissionStatus.BLOCKED
      );
      expect(result.current.permissionStatus.location.canRequestAgain).toBe(
        false
      );
      expect(result.current.permissionStatus.location.hasPermission).toBe(
        false
      );
    });

    it('should map denied status with canRequestAgain false', async () => {
      (
        BackgroundLocationModule.checkLocationPermission as jest.Mock
      ).mockResolvedValueOnce({
        status: 'denied',
        canRequestAgain: false,
      });

      const { result } = renderHook(() => useLocationPermissions());

      await act(async () => {
        const hasPermission = await result.current.checkPermissions();
        expect(hasPermission).toBe(false);
      });

      expect(result.current.permissionStatus.location.status).toBe(
        LocationPermissionStatus.DENIED
      );
      expect(result.current.permissionStatus.location.canRequestAgain).toBe(
        false
      );
      expect(result.current.permissionStatus.location.hasPermission).toBe(
        false
      );
    });

    it('should distinguish blocked from denied as different statuses', async () => {
      // First: check blocked
      (
        BackgroundLocationModule.checkLocationPermission as jest.Mock
      ).mockResolvedValueOnce({
        status: 'blocked',
        canRequestAgain: false,
      });

      const { result } = renderHook(() => useLocationPermissions());

      await act(async () => {
        await result.current.checkPermissions();
      });

      const blockedStatus = result.current.permissionStatus.location.status;

      // Second: check denied
      (
        BackgroundLocationModule.checkLocationPermission as jest.Mock
      ).mockResolvedValueOnce({
        status: 'denied',
        canRequestAgain: false,
      });

      await act(async () => {
        await result.current.checkPermissions();
      });

      const deniedStatus = result.current.permissionStatus.location.status;

      expect(blockedStatus).toBe(LocationPermissionStatus.BLOCKED);
      expect(deniedStatus).toBe(LocationPermissionStatus.DENIED);
      expect(blockedStatus).not.toBe(deniedStatus);
    });

    it('should handle restricted (blocked) status from requestPermissions', async () => {
      (
        BackgroundLocationModule.requestLocationPermission as jest.Mock
      ).mockResolvedValueOnce({
        status: 'blocked',
        canRequestAgain: false,
      });

      const { result } = renderHook(() => useLocationPermissions());

      await act(async () => {
        const granted = await result.current.requestPermissions();
        expect(granted).toBe(false);
      });

      expect(result.current.permissionStatus.location.status).toBe(
        LocationPermissionStatus.BLOCKED
      );
      expect(result.current.permissionStatus.location.canRequestAgain).toBe(
        false
      );
    });
  });

  describe('Sequential check then request flow', () => {
    it('should transition state correctly from check to request', async () => {
      (
        BackgroundLocationModule.checkLocationPermission as jest.Mock
      ).mockResolvedValueOnce({
        status: 'undetermined',
        canRequestAgain: true,
      });

      (
        BackgroundLocationModule.requestLocationPermission as jest.Mock
      ).mockResolvedValueOnce({
        status: 'granted',
        canRequestAgain: false,
      });

      const { result } = renderHook(() => useLocationPermissions());

      // Step 1: Check - undetermined
      await act(async () => {
        const hasPermission = await result.current.checkPermissions();
        expect(hasPermission).toBe(false);
      });

      expect(result.current.permissionStatus.location.status).toBe(
        LocationPermissionStatus.UNDETERMINED
      );
      expect(result.current.permissionStatus.location.canRequestAgain).toBe(
        true
      );
      expect(result.current.isRequesting).toBe(false);

      // Step 2: Request - granted
      await act(async () => {
        const granted = await result.current.requestPermissions();
        expect(granted).toBe(true);
      });

      expect(result.current.permissionStatus.location.status).toBe(
        LocationPermissionStatus.GRANTED
      );
      expect(result.current.permissionStatus.location.hasPermission).toBe(true);
      expect(result.current.permissionStatus.location.canRequestAgain).toBe(
        false
      );
      expect(result.current.isRequesting).toBe(false);
    });

    it('should call the correct native methods for check then request', async () => {
      (
        BackgroundLocationModule.checkLocationPermission as jest.Mock
      ).mockResolvedValueOnce({
        status: 'undetermined',
        canRequestAgain: true,
      });

      (
        BackgroundLocationModule.requestLocationPermission as jest.Mock
      ).mockResolvedValueOnce({
        status: 'whenInUse',
        canRequestAgain: true,
      });

      const { result } = renderHook(() => useLocationPermissions());

      await act(async () => {
        await result.current.checkPermissions();
      });

      expect(
        BackgroundLocationModule.checkLocationPermission
      ).toHaveBeenCalledTimes(1);

      await act(async () => {
        await result.current.requestPermissions();
      });

      expect(
        BackgroundLocationModule.requestLocationPermission
      ).toHaveBeenCalledWith(false);
      expect(
        BackgroundLocationModule.requestLocationPermission
      ).toHaveBeenCalledTimes(1);
    });
  });

  describe('Multiple rapid requests prevention', () => {
    it('should set isRequesting to true during an active request', async () => {
      let resolvePermission: (value: any) => void;
      const permissionPromise = new Promise((resolve) => {
        resolvePermission = resolve;
      });

      (
        BackgroundLocationModule.requestLocationPermission as jest.Mock
      ).mockReturnValueOnce(permissionPromise);

      const { result } = renderHook(() => useLocationPermissions());

      // Start the request but don't resolve yet
      act(() => {
        result.current.requestPermissions();
      });

      // isRequesting should be true while waiting
      expect(result.current.isRequesting).toBe(true);

      // Resolve the request
      await act(async () => {
        resolvePermission!({
          status: 'granted',
          canRequestAgain: false,
        });
        await permissionPromise;
      });

      expect(result.current.isRequesting).toBe(false);
    });

    it('should reset isRequesting to false even when request fails', async () => {
      (
        BackgroundLocationModule.requestLocationPermission as jest.Mock
      ).mockRejectedValueOnce(new Error('System dialog dismissed'));

      const { result } = renderHook(() => useLocationPermissions());

      await act(async () => {
        await result.current.requestPermissions();
      });

      expect(result.current.isRequesting).toBe(false);
    });

    it('should handle consecutive completed requests correctly', async () => {
      (BackgroundLocationModule.requestLocationPermission as jest.Mock)
        .mockResolvedValueOnce({
          status: 'whenInUse',
          canRequestAgain: true,
        })
        .mockResolvedValueOnce({
          status: 'granted',
          canRequestAgain: false,
        });

      const { result } = renderHook(() => useLocationPermissions());

      // First request
      await act(async () => {
        const granted = await result.current.requestPermissions();
        expect(granted).toBe(true);
      });

      expect(result.current.permissionStatus.location.status).toBe(
        LocationPermissionStatus.WHEN_IN_USE
      );
      expect(result.current.isRequesting).toBe(false);

      // Second request
      await act(async () => {
        const granted = await result.current.requestPermissions();
        expect(granted).toBe(true);
      });

      expect(result.current.permissionStatus.location.status).toBe(
        LocationPermissionStatus.GRANTED
      );
      expect(result.current.isRequesting).toBe(false);
    });
  });

  describe('PermissionsAndroid isolation', () => {
    it('should never call PermissionsAndroid.check on iOS during checkPermissions', async () => {
      (
        BackgroundLocationModule.checkLocationPermission as jest.Mock
      ).mockResolvedValueOnce({
        status: 'granted',
        canRequestAgain: false,
      });

      const { result } = renderHook(() => useLocationPermissions());

      await act(async () => {
        await result.current.checkPermissions();
      });

      expect(PermissionsAndroid.check).not.toHaveBeenCalled();
    });

    it('should never call PermissionsAndroid.request on iOS during requestPermissions', async () => {
      (
        BackgroundLocationModule.requestLocationPermission as jest.Mock
      ).mockResolvedValueOnce({
        status: 'granted',
        canRequestAgain: false,
      });

      const { result } = renderHook(() => useLocationPermissions());

      await act(async () => {
        await result.current.requestPermissions();
      });

      expect(PermissionsAndroid.request).not.toHaveBeenCalled();
    });

    it('should never call PermissionsAndroid.requestMultiple on iOS during requestPermissions', async () => {
      (
        BackgroundLocationModule.requestLocationPermission as jest.Mock
      ).mockResolvedValueOnce({
        status: 'granted',
        canRequestAgain: false,
      });

      const { result } = renderHook(() => useLocationPermissions());

      await act(async () => {
        await result.current.requestPermissions();
      });

      expect(PermissionsAndroid.requestMultiple).not.toHaveBeenCalled();
    });

    it('should never call any PermissionsAndroid methods across full check and request flow', async () => {
      (
        BackgroundLocationModule.checkLocationPermission as jest.Mock
      ).mockResolvedValueOnce({
        status: 'undetermined',
        canRequestAgain: true,
      });

      (
        BackgroundLocationModule.requestLocationPermission as jest.Mock
      ).mockResolvedValueOnce({
        status: 'whenInUse',
        canRequestAgain: true,
      });

      const { result } = renderHook(() => useLocationPermissions());

      await act(async () => {
        await result.current.checkPermissions();
      });

      await act(async () => {
        await result.current.requestPermissions();
      });

      expect(PermissionsAndroid.check).not.toHaveBeenCalled();
      expect(PermissionsAndroid.request).not.toHaveBeenCalled();
      expect(PermissionsAndroid.requestMultiple).not.toHaveBeenCalled();
    });

    it('should never call PermissionsAndroid methods even when native errors occur', async () => {
      (
        BackgroundLocationModule.checkLocationPermission as jest.Mock
      ).mockRejectedValueOnce(new Error('Native crash'));

      (
        BackgroundLocationModule.requestLocationPermission as jest.Mock
      ).mockRejectedValueOnce(new Error('Native crash'));

      const { result } = renderHook(() => useLocationPermissions());

      await act(async () => {
        await result.current.checkPermissions();
      });

      await act(async () => {
        await result.current.requestPermissions();
      });

      expect(PermissionsAndroid.check).not.toHaveBeenCalled();
      expect(PermissionsAndroid.request).not.toHaveBeenCalled();
      expect(PermissionsAndroid.requestMultiple).not.toHaveBeenCalled();
    });
  });

  describe('Error recovery', () => {
    it('should recover from failed request and allow subsequent check', async () => {
      // First: request fails
      (
        BackgroundLocationModule.requestLocationPermission as jest.Mock
      ).mockRejectedValueOnce(new Error('CLLocationManager error'));

      const { result } = renderHook(() => useLocationPermissions());

      await act(async () => {
        const granted = await result.current.requestPermissions();
        expect(granted).toBe(false);
      });

      expect(result.current.permissionStatus.location.status).toBe(
        LocationPermissionStatus.DENIED
      );
      expect(result.current.permissionStatus.location.canRequestAgain).toBe(
        false
      );
      expect(result.current.isRequesting).toBe(false);

      // Second: check works normally
      (
        BackgroundLocationModule.checkLocationPermission as jest.Mock
      ).mockResolvedValueOnce({
        status: 'whenInUse',
        canRequestAgain: true,
      });

      await act(async () => {
        const hasPermission = await result.current.checkPermissions();
        expect(hasPermission).toBe(true);
      });

      expect(result.current.permissionStatus.location.status).toBe(
        LocationPermissionStatus.WHEN_IN_USE
      );
      expect(result.current.permissionStatus.location.canRequestAgain).toBe(
        true
      );
      expect(result.current.permissionStatus.location.hasPermission).toBe(true);
    });

    it('should recover from failed request and allow subsequent request', async () => {
      // First: request fails
      (
        BackgroundLocationModule.requestLocationPermission as jest.Mock
      ).mockRejectedValueOnce(new Error('Timeout'));

      const { result } = renderHook(() => useLocationPermissions());

      await act(async () => {
        const granted = await result.current.requestPermissions();
        expect(granted).toBe(false);
      });

      expect(result.current.permissionStatus.location.status).toBe(
        LocationPermissionStatus.DENIED
      );
      expect(result.current.isRequesting).toBe(false);

      // Second: request succeeds
      (
        BackgroundLocationModule.requestLocationPermission as jest.Mock
      ).mockResolvedValueOnce({
        status: 'granted',
        canRequestAgain: false,
      });

      await act(async () => {
        const granted = await result.current.requestPermissions();
        expect(granted).toBe(true);
      });

      expect(result.current.permissionStatus.location.status).toBe(
        LocationPermissionStatus.GRANTED
      );
      expect(result.current.permissionStatus.location.hasPermission).toBe(true);
      expect(result.current.isRequesting).toBe(false);
    });

    it('should recover from failed check and allow subsequent check', async () => {
      // First: check fails
      (
        BackgroundLocationModule.checkLocationPermission as jest.Mock
      ).mockRejectedValueOnce(new Error('Native module not ready'));

      const { result } = renderHook(() => useLocationPermissions());

      await act(async () => {
        const hasPermission = await result.current.checkPermissions();
        expect(hasPermission).toBe(false);
      });

      // State should remain at initial (error path does not update state)
      expect(result.current.permissionStatus.location.status).toBe(
        LocationPermissionStatus.UNDETERMINED
      );

      // Second: check succeeds
      (
        BackgroundLocationModule.checkLocationPermission as jest.Mock
      ).mockResolvedValueOnce({
        status: 'granted',
        canRequestAgain: false,
      });

      await act(async () => {
        const hasPermission = await result.current.checkPermissions();
        expect(hasPermission).toBe(true);
      });

      expect(result.current.permissionStatus.location.status).toBe(
        LocationPermissionStatus.GRANTED
      );
    });
  });

  describe('Undetermined to all transitions', () => {
    it('should transition from undetermined to granted', async () => {
      const { result } = renderHook(() => useLocationPermissions());

      // Initial state is undetermined
      expect(result.current.permissionStatus.location.status).toBe(
        LocationPermissionStatus.UNDETERMINED
      );

      (
        BackgroundLocationModule.requestLocationPermission as jest.Mock
      ).mockResolvedValueOnce({
        status: 'granted',
        canRequestAgain: false,
      });

      await act(async () => {
        const granted = await result.current.requestPermissions();
        expect(granted).toBe(true);
      });

      expect(result.current.permissionStatus.location.status).toBe(
        LocationPermissionStatus.GRANTED
      );
      expect(result.current.permissionStatus.location.hasPermission).toBe(true);
    });

    it('should transition from undetermined to whenInUse', async () => {
      const { result } = renderHook(() => useLocationPermissions());

      expect(result.current.permissionStatus.location.status).toBe(
        LocationPermissionStatus.UNDETERMINED
      );

      (
        BackgroundLocationModule.requestLocationPermission as jest.Mock
      ).mockResolvedValueOnce({
        status: 'whenInUse',
        canRequestAgain: true,
      });

      await act(async () => {
        const granted = await result.current.requestPermissions();
        expect(granted).toBe(true);
      });

      expect(result.current.permissionStatus.location.status).toBe(
        LocationPermissionStatus.WHEN_IN_USE
      );
      expect(result.current.permissionStatus.location.hasPermission).toBe(true);
    });

    it('should transition from undetermined to denied', async () => {
      const { result } = renderHook(() => useLocationPermissions());

      expect(result.current.permissionStatus.location.status).toBe(
        LocationPermissionStatus.UNDETERMINED
      );

      (
        BackgroundLocationModule.requestLocationPermission as jest.Mock
      ).mockResolvedValueOnce({
        status: 'denied',
        canRequestAgain: false,
      });

      await act(async () => {
        const granted = await result.current.requestPermissions();
        expect(granted).toBe(false);
      });

      expect(result.current.permissionStatus.location.status).toBe(
        LocationPermissionStatus.DENIED
      );
      expect(result.current.permissionStatus.location.hasPermission).toBe(
        false
      );
      expect(result.current.permissionStatus.location.canRequestAgain).toBe(
        false
      );
    });

    it('should transition from undetermined to blocked (restricted)', async () => {
      const { result } = renderHook(() => useLocationPermissions());

      expect(result.current.permissionStatus.location.status).toBe(
        LocationPermissionStatus.UNDETERMINED
      );

      (
        BackgroundLocationModule.requestLocationPermission as jest.Mock
      ).mockResolvedValueOnce({
        status: 'blocked',
        canRequestAgain: false,
      });

      await act(async () => {
        const granted = await result.current.requestPermissions();
        expect(granted).toBe(false);
      });

      expect(result.current.permissionStatus.location.status).toBe(
        LocationPermissionStatus.BLOCKED
      );
      expect(result.current.permissionStatus.location.hasPermission).toBe(
        false
      );
      expect(result.current.permissionStatus.location.canRequestAgain).toBe(
        false
      );
    });

    it('should remain undetermined when check returns undetermined', async () => {
      (
        BackgroundLocationModule.checkLocationPermission as jest.Mock
      ).mockResolvedValueOnce({
        status: 'undetermined',
        canRequestAgain: true,
      });

      const { result } = renderHook(() => useLocationPermissions());

      expect(result.current.permissionStatus.location.status).toBe(
        LocationPermissionStatus.UNDETERMINED
      );

      await act(async () => {
        const hasPermission = await result.current.checkPermissions();
        expect(hasPermission).toBe(false);
      });

      expect(result.current.permissionStatus.location.status).toBe(
        LocationPermissionStatus.UNDETERMINED
      );
      expect(result.current.permissionStatus.location.canRequestAgain).toBe(
        true
      );
    });

    it('should transition from undetermined to denied on error during request', async () => {
      const { result } = renderHook(() => useLocationPermissions());

      expect(result.current.permissionStatus.location.status).toBe(
        LocationPermissionStatus.UNDETERMINED
      );

      (
        BackgroundLocationModule.requestLocationPermission as jest.Mock
      ).mockRejectedValueOnce(new Error('Native error'));

      await act(async () => {
        const granted = await result.current.requestPermissions();
        expect(granted).toBe(false);
      });

      expect(result.current.permissionStatus.location.status).toBe(
        LocationPermissionStatus.DENIED
      );
      expect(result.current.permissionStatus.location.canRequestAgain).toBe(
        false
      );
    });
  });

  describe('iOS notification permission', () => {
    it('should call checkNotificationPermission alongside checkLocationPermission', async () => {
      (
        BackgroundLocationModule.checkLocationPermission as jest.Mock
      ).mockResolvedValueOnce({
        status: 'granted',
        canRequestAgain: false,
      });
      (
        BackgroundLocationModule.checkNotificationPermission as jest.Mock
      ).mockResolvedValueOnce('granted');

      const { result } = renderHook(() => useLocationPermissions());

      await act(async () => {
        await result.current.checkPermissions();
      });

      expect(
        BackgroundLocationModule.checkLocationPermission
      ).toHaveBeenCalledTimes(1);
      expect(
        BackgroundLocationModule.checkNotificationPermission
      ).toHaveBeenCalledTimes(1);
    });

    it('should call requestNotificationPermission as step 2 after location', async () => {
      const callOrder: string[] = [];
      (
        BackgroundLocationModule.requestLocationPermission as jest.Mock
      ).mockImplementationOnce(() => {
        callOrder.push('location');
        return Promise.resolve({ status: 'granted', canRequestAgain: false });
      });
      (
        BackgroundLocationModule.requestNotificationPermission as jest.Mock
      ).mockImplementationOnce(() => {
        callOrder.push('notification');
        return Promise.resolve('granted');
      });

      const { result } = renderHook(() => useLocationPermissions());

      await act(async () => {
        await result.current.requestPermissions();
      });

      expect(callOrder).toEqual(['location', 'notification']);
    });

    it('should return true from requestPermissions even when notification denied', async () => {
      (
        BackgroundLocationModule.requestLocationPermission as jest.Mock
      ).mockResolvedValueOnce({
        status: 'granted',
        canRequestAgain: false,
      });
      (
        BackgroundLocationModule.requestNotificationPermission as jest.Mock
      ).mockResolvedValueOnce('denied');

      const { result } = renderHook(() => useLocationPermissions());

      await act(async () => {
        const granted = await result.current.requestPermissions();
        expect(granted).toBe(true);
      });

      expect(result.current.permissionStatus.location.hasPermission).toBe(true);
      expect(result.current.permissionStatus.notification.hasPermission).toBe(
        false
      );
      expect(result.current.permissionStatus.notification.status).toBe(
        NotificationPermissionStatus.DENIED
      );
      expect(result.current.permissionStatus.hasAllPermissions).toBe(false);
    });

    it('should update notification state after checkPermissions', async () => {
      (
        BackgroundLocationModule.checkLocationPermission as jest.Mock
      ).mockResolvedValueOnce({
        status: 'granted',
        canRequestAgain: false,
      });
      (
        BackgroundLocationModule.checkNotificationPermission as jest.Mock
      ).mockResolvedValueOnce('denied');

      const { result } = renderHook(() => useLocationPermissions());

      await act(async () => {
        await result.current.checkPermissions();
      });

      expect(result.current.permissionStatus.notification.hasPermission).toBe(
        false
      );
      expect(result.current.permissionStatus.notification.status).toBe(
        NotificationPermissionStatus.DENIED
      );
      expect(result.current.permissionStatus.notification.canRequestAgain).toBe(
        false
      );
      expect(result.current.permissionStatus.hasAllPermissions).toBe(false);
    });

    it('should update notification state after requestPermissions', async () => {
      (
        BackgroundLocationModule.requestLocationPermission as jest.Mock
      ).mockResolvedValueOnce({
        status: 'granted',
        canRequestAgain: false,
      });
      (
        BackgroundLocationModule.requestNotificationPermission as jest.Mock
      ).mockResolvedValueOnce('granted');

      const { result } = renderHook(() => useLocationPermissions());

      await act(async () => {
        await result.current.requestPermissions();
      });

      expect(result.current.permissionStatus.notification.hasPermission).toBe(
        true
      );
      expect(result.current.permissionStatus.notification.status).toBe(
        NotificationPermissionStatus.GRANTED
      );
      expect(result.current.permissionStatus.hasAllPermissions).toBe(true);
    });

    it('should have correct initial notification state', () => {
      const { result } = renderHook(() => useLocationPermissions());

      expect(result.current.permissionStatus.notification.hasPermission).toBe(
        false
      );
      expect(result.current.permissionStatus.notification.status).toBe(
        NotificationPermissionStatus.UNDETERMINED
      );
      expect(result.current.permissionStatus.notification.canRequestAgain).toBe(
        true
      );
      expect(result.current.permissionStatus.hasAllPermissions).toBe(false);
    });
  });
});
