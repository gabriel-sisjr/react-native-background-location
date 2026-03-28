import { act, renderHook } from '@testing-library/react-native';
import { Platform, PermissionsAndroid } from 'react-native';
import { useLocationPermissions } from '../../hooks/useLocationPermissions';
import {
  LocationPermissionStatus,
  NotificationPermissionStatus,
} from '../../types';
import BackgroundLocationModule from '../../NativeBackgroundLocation';

describe('useLocationPermissions - Complete Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'android';
    Object.defineProperty(Platform, 'Version', {
      get: () => 30,
      configurable: true,
    });
    // Default notification mocks for all Android tests
    (
      BackgroundLocationModule.checkNotificationPermission as jest.Mock
    ).mockResolvedValue('granted');
    (
      BackgroundLocationModule.requestNotificationPermission as jest.Mock
    ).mockResolvedValue('granted');
  });

  describe('Initialization', () => {
    it('should initialize with undetermined status', () => {
      const { result } = renderHook(() => useLocationPermissions());

      expect(result.current.permissionStatus.location.hasPermission).toBe(
        false
      );
      expect(result.current.permissionStatus.location.status).toBe(
        LocationPermissionStatus.UNDETERMINED
      );
      expect(result.current.permissionStatus.location.canRequestAgain).toBe(
        true
      );
      expect(result.current.isRequesting).toBe(false);
    });

    it('should have correct initial granular notification state', () => {
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
    });
  });

  describe('checkPermissions', () => {
    it('should return true when all permissions are granted on Android 10+', async () => {
      Object.defineProperty(Platform, 'Version', {
        get: () => 30,
        configurable: true,
      });
      (PermissionsAndroid.check as jest.Mock)
        .mockResolvedValueOnce(true) // ACCESS_FINE_LOCATION
        .mockResolvedValueOnce(true) // ACCESS_COARSE_LOCATION
        .mockResolvedValueOnce(true); // ACCESS_BACKGROUND_LOCATION

      const { result } = renderHook(() => useLocationPermissions());

      await act(async () => {
        const hasPermission = await result.current.checkPermissions();
        expect(hasPermission).toBe(true);
      });

      expect(result.current.permissionStatus.location.hasPermission).toBe(true);
      expect(result.current.permissionStatus.location.status).toBe(
        LocationPermissionStatus.GRANTED
      );
    });

    it('should return false when foreground permissions are denied', async () => {
      (PermissionsAndroid.check as jest.Mock)
        .mockResolvedValueOnce(false) // ACCESS_FINE_LOCATION
        .mockResolvedValueOnce(true); // ACCESS_COARSE_LOCATION

      const { result } = renderHook(() => useLocationPermissions());

      await act(async () => {
        const hasPermission = await result.current.checkPermissions();
        expect(hasPermission).toBe(false);
      });

      expect(result.current.permissionStatus.location.hasPermission).toBe(
        false
      );
      expect(result.current.permissionStatus.location.status).toBe(
        LocationPermissionStatus.DENIED
      );
    });

    it('should return false when background permission is denied on Android 10+', async () => {
      Object.defineProperty(Platform, 'Version', {
        get: () => 30,
        configurable: true,
      });
      (PermissionsAndroid.check as jest.Mock)
        .mockResolvedValueOnce(true) // ACCESS_FINE_LOCATION
        .mockResolvedValueOnce(true) // ACCESS_COARSE_LOCATION
        .mockResolvedValueOnce(false); // ACCESS_BACKGROUND_LOCATION

      const { result } = renderHook(() => useLocationPermissions());

      await act(async () => {
        const hasPermission = await result.current.checkPermissions();
        expect(hasPermission).toBe(false);
      });

      expect(result.current.permissionStatus.location.status).toBe(
        LocationPermissionStatus.DENIED
      );
    });

    it('should skip background permission check on Android 9 and below', async () => {
      Object.defineProperty(Platform, 'Version', {
        get: () => 28,
        configurable: true,
      });
      (PermissionsAndroid.check as jest.Mock)
        .mockResolvedValueOnce(true) // ACCESS_FINE_LOCATION
        .mockResolvedValueOnce(true); // ACCESS_COARSE_LOCATION

      const { result } = renderHook(() => useLocationPermissions());

      await act(async () => {
        const hasPermission = await result.current.checkPermissions();
        expect(hasPermission).toBe(true);
      });

      expect(PermissionsAndroid.check).toHaveBeenCalledTimes(2);
    });

    it('should handle errors gracefully', async () => {
      (PermissionsAndroid.check as jest.Mock).mockRejectedValue(
        new Error('Check failed')
      );

      const { result } = renderHook(() => useLocationPermissions());

      await act(async () => {
        const hasPermission = await result.current.checkPermissions();
        expect(hasPermission).toBe(false);
      });
    });

    it('should check notification permission via native module on Android', async () => {
      Object.defineProperty(Platform, 'Version', {
        get: () => 33,
        configurable: true,
      });
      (PermissionsAndroid.check as jest.Mock)
        .mockResolvedValueOnce(true) // ACCESS_FINE_LOCATION
        .mockResolvedValueOnce(true) // ACCESS_COARSE_LOCATION
        .mockResolvedValueOnce(true); // ACCESS_BACKGROUND_LOCATION
      (
        BackgroundLocationModule.checkNotificationPermission as jest.Mock
      ).mockResolvedValueOnce('granted');

      const { result } = renderHook(() => useLocationPermissions());

      await act(async () => {
        const hasPermission = await result.current.checkPermissions();
        expect(hasPermission).toBe(true);
      });

      expect(
        BackgroundLocationModule.checkNotificationPermission
      ).toHaveBeenCalled();
      expect(result.current.permissionStatus.location.hasPermission).toBe(true);
      expect(result.current.permissionStatus.notification.hasPermission).toBe(
        true
      );
      expect(result.current.permissionStatus.hasAllPermissions).toBe(true);
    });

    it('should return true for location when notification permission is denied', async () => {
      Object.defineProperty(Platform, 'Version', {
        get: () => 33,
        configurable: true,
      });
      (PermissionsAndroid.check as jest.Mock)
        .mockResolvedValueOnce(true) // ACCESS_FINE_LOCATION
        .mockResolvedValueOnce(true) // ACCESS_COARSE_LOCATION
        .mockResolvedValueOnce(true); // ACCESS_BACKGROUND_LOCATION
      (
        BackgroundLocationModule.checkNotificationPermission as jest.Mock
      ).mockResolvedValueOnce('denied');

      const { result } = renderHook(() => useLocationPermissions());

      await act(async () => {
        const hasPermission = await result.current.checkPermissions();
        // checkPermissions returns location-based result
        expect(hasPermission).toBe(true);
      });

      expect(result.current.permissionStatus.location.hasPermission).toBe(true);
      expect(result.current.permissionStatus.location.status).toBe(
        LocationPermissionStatus.GRANTED
      );
      expect(result.current.permissionStatus.notification.hasPermission).toBe(
        false
      );
      expect(result.current.permissionStatus.notification.status).toBe(
        NotificationPermissionStatus.DENIED
      );
      expect(result.current.permissionStatus.hasAllPermissions).toBe(false);
    });

    it('should call checkNotificationPermission on Android checkPermissions', async () => {
      Object.defineProperty(Platform, 'Version', {
        get: () => 30,
        configurable: true,
      });
      (PermissionsAndroid.check as jest.Mock)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);
      (
        BackgroundLocationModule.checkNotificationPermission as jest.Mock
      ).mockResolvedValueOnce('granted');

      const { result } = renderHook(() => useLocationPermissions());

      await act(async () => {
        await result.current.checkPermissions();
      });

      expect(
        BackgroundLocationModule.checkNotificationPermission
      ).toHaveBeenCalledTimes(1);
    });

    it('should compute hasAllPermissions as true when both location and notification are granted', async () => {
      Object.defineProperty(Platform, 'Version', {
        get: () => 30,
        configurable: true,
      });
      (PermissionsAndroid.check as jest.Mock)
        .mockResolvedValueOnce(true) // FINE
        .mockResolvedValueOnce(true) // COARSE
        .mockResolvedValueOnce(true); // BACKGROUND
      (
        BackgroundLocationModule.checkNotificationPermission as jest.Mock
      ).mockResolvedValueOnce('granted');

      const { result } = renderHook(() => useLocationPermissions());

      await act(async () => {
        await result.current.checkPermissions();
      });

      expect(result.current.permissionStatus.hasAllPermissions).toBe(true);
    });

    it('should compute hasAllPermissions as false when location granted but notification denied', async () => {
      Object.defineProperty(Platform, 'Version', {
        get: () => 30,
        configurable: true,
      });
      (PermissionsAndroid.check as jest.Mock)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);
      (
        BackgroundLocationModule.checkNotificationPermission as jest.Mock
      ).mockResolvedValueOnce('denied');

      const { result } = renderHook(() => useLocationPermissions());

      await act(async () => {
        const hasPermission = await result.current.checkPermissions();
        expect(hasPermission).toBe(true); // return is location-based
      });

      expect(result.current.permissionStatus.hasAllPermissions).toBe(false);
      expect(result.current.permissionStatus.location.hasPermission).toBe(true);
      expect(result.current.permissionStatus.notification.hasPermission).toBe(
        false
      );
    });
  });

  describe('requestPermissions', () => {
    it('should successfully request and grant all permissions', async () => {
      Object.defineProperty(Platform, 'Version', {
        get: () => 30,
        configurable: true,
      });
      (PermissionsAndroid.requestMultiple as jest.Mock).mockResolvedValue({
        'android.permission.ACCESS_FINE_LOCATION':
          PermissionsAndroid.RESULTS.GRANTED,
        'android.permission.ACCESS_COARSE_LOCATION':
          PermissionsAndroid.RESULTS.GRANTED,
      });
      (PermissionsAndroid.request as jest.Mock).mockResolvedValue(
        PermissionsAndroid.RESULTS.GRANTED
      );

      const { result } = renderHook(() => useLocationPermissions());

      await act(async () => {
        const granted = await result.current.requestPermissions();
        expect(granted).toBe(true);
      });

      expect(result.current.permissionStatus.location.hasPermission).toBe(true);
      expect(result.current.permissionStatus.location.status).toBe(
        LocationPermissionStatus.GRANTED
      );
      expect(result.current.isRequesting).toBe(false);
    });

    it('should handle foreground permission denial', async () => {
      (PermissionsAndroid.requestMultiple as jest.Mock).mockResolvedValue({
        'android.permission.ACCESS_FINE_LOCATION':
          PermissionsAndroid.RESULTS.DENIED,
        'android.permission.ACCESS_COARSE_LOCATION':
          PermissionsAndroid.RESULTS.GRANTED,
      });

      const { result } = renderHook(() => useLocationPermissions());

      await act(async () => {
        const granted = await result.current.requestPermissions();
        expect(granted).toBe(false);
      });

      expect(result.current.permissionStatus.location.hasPermission).toBe(
        false
      );
      expect(result.current.permissionStatus.location.status).toBe(
        LocationPermissionStatus.DENIED
      );
      expect(result.current.permissionStatus.location.canRequestAgain).toBe(
        true
      );
    });

    it('should handle background permission denial', async () => {
      Object.defineProperty(Platform, 'Version', {
        get: () => 30,
        configurable: true,
      });
      (PermissionsAndroid.requestMultiple as jest.Mock).mockResolvedValue({
        'android.permission.ACCESS_FINE_LOCATION':
          PermissionsAndroid.RESULTS.GRANTED,
        'android.permission.ACCESS_COARSE_LOCATION':
          PermissionsAndroid.RESULTS.GRANTED,
      });
      (PermissionsAndroid.request as jest.Mock).mockResolvedValue(
        PermissionsAndroid.RESULTS.DENIED
      );

      const { result } = renderHook(() => useLocationPermissions());

      await act(async () => {
        const granted = await result.current.requestPermissions();
        expect(granted).toBe(false);
      });

      expect(result.current.permissionStatus.location.status).toBe(
        LocationPermissionStatus.DENIED
      );
    });

    it('should handle never ask again for foreground permissions', async () => {
      (PermissionsAndroid.requestMultiple as jest.Mock).mockResolvedValue({
        'android.permission.ACCESS_FINE_LOCATION':
          PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN,
        'android.permission.ACCESS_COARSE_LOCATION':
          PermissionsAndroid.RESULTS.GRANTED,
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

    it('should handle never ask again for background permission', async () => {
      Object.defineProperty(Platform, 'Version', {
        get: () => 30,
        configurable: true,
      });
      (PermissionsAndroid.requestMultiple as jest.Mock).mockResolvedValue({
        'android.permission.ACCESS_FINE_LOCATION':
          PermissionsAndroid.RESULTS.GRANTED,
        'android.permission.ACCESS_COARSE_LOCATION':
          PermissionsAndroid.RESULTS.GRANTED,
      });
      (PermissionsAndroid.request as jest.Mock).mockResolvedValue(
        PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN
      );

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

    it('should skip background permission on Android 9 and below', async () => {
      Object.defineProperty(Platform, 'Version', {
        get: () => 28,
        configurable: true,
      });
      (PermissionsAndroid.requestMultiple as jest.Mock).mockResolvedValue({
        'android.permission.ACCESS_FINE_LOCATION':
          PermissionsAndroid.RESULTS.GRANTED,
        'android.permission.ACCESS_COARSE_LOCATION':
          PermissionsAndroid.RESULTS.GRANTED,
      });

      const { result } = renderHook(() => useLocationPermissions());

      await act(async () => {
        const granted = await result.current.requestPermissions();
        expect(granted).toBe(true);
      });

      expect(PermissionsAndroid.request).not.toHaveBeenCalled();
    });

    it('should request notification permission via native module on Android', async () => {
      Object.defineProperty(Platform, 'Version', {
        get: () => 33,
        configurable: true,
      });
      (PermissionsAndroid.requestMultiple as jest.Mock).mockResolvedValue({
        'android.permission.ACCESS_FINE_LOCATION':
          PermissionsAndroid.RESULTS.GRANTED,
        'android.permission.ACCESS_COARSE_LOCATION':
          PermissionsAndroid.RESULTS.GRANTED,
      });
      (PermissionsAndroid.request as jest.Mock).mockResolvedValueOnce(
        PermissionsAndroid.RESULTS.GRANTED
      ); // background
      (
        BackgroundLocationModule.requestNotificationPermission as jest.Mock
      ).mockResolvedValueOnce('granted');

      const { result } = renderHook(() => useLocationPermissions());

      await act(async () => {
        const granted = await result.current.requestPermissions();
        expect(granted).toBe(true);
      });

      expect(
        BackgroundLocationModule.requestNotificationPermission
      ).toHaveBeenCalled();
      expect(result.current.permissionStatus.location.hasPermission).toBe(true);
      expect(result.current.permissionStatus.location.status).toBe(
        LocationPermissionStatus.GRANTED
      );
      expect(result.current.permissionStatus.notification.hasPermission).toBe(
        true
      );
    });

    it('should handle notification permission denial on Android', async () => {
      Object.defineProperty(Platform, 'Version', {
        get: () => 33,
        configurable: true,
      });
      (PermissionsAndroid.requestMultiple as jest.Mock).mockResolvedValue({
        'android.permission.ACCESS_FINE_LOCATION':
          PermissionsAndroid.RESULTS.GRANTED,
        'android.permission.ACCESS_COARSE_LOCATION':
          PermissionsAndroid.RESULTS.GRANTED,
      });
      (PermissionsAndroid.request as jest.Mock).mockResolvedValueOnce(
        PermissionsAndroid.RESULTS.GRANTED
      ); // background
      (
        BackgroundLocationModule.requestNotificationPermission as jest.Mock
      ).mockResolvedValueOnce('denied');

      const { result } = renderHook(() => useLocationPermissions());

      await act(async () => {
        const granted = await result.current.requestPermissions();
        // requestPermissions returns true when location is granted, even if notification is denied
        expect(granted).toBe(true);
      });

      expect(result.current.permissionStatus.location.hasPermission).toBe(true);
      expect(result.current.permissionStatus.location.status).toBe(
        LocationPermissionStatus.GRANTED
      );
      expect(result.current.permissionStatus.notification.hasPermission).toBe(
        false
      );
      expect(result.current.permissionStatus.notification.status).toBe(
        NotificationPermissionStatus.DENIED
      );
      expect(result.current.permissionStatus.hasAllPermissions).toBe(false);
    });

    it('should handle notification permission never ask again on Android', async () => {
      Object.defineProperty(Platform, 'Version', {
        get: () => 33,
        configurable: true,
      });
      (PermissionsAndroid.requestMultiple as jest.Mock).mockResolvedValue({
        'android.permission.ACCESS_FINE_LOCATION':
          PermissionsAndroid.RESULTS.GRANTED,
        'android.permission.ACCESS_COARSE_LOCATION':
          PermissionsAndroid.RESULTS.GRANTED,
      });
      (PermissionsAndroid.request as jest.Mock).mockResolvedValueOnce(
        PermissionsAndroid.RESULTS.GRANTED
      ); // background
      (
        BackgroundLocationModule.requestNotificationPermission as jest.Mock
      ).mockResolvedValueOnce('denied');

      const { result } = renderHook(() => useLocationPermissions());

      await act(async () => {
        const granted = await result.current.requestPermissions();
        // requestPermissions returns true when location is granted, even if notification is denied
        expect(granted).toBe(true);
      });

      expect(result.current.permissionStatus.location.hasPermission).toBe(true);
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

    it('should set isRequesting to true during request', async () => {
      let resolvePromise: (value: any) => void;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      (PermissionsAndroid.requestMultiple as jest.Mock).mockReturnValue(
        promise
      );

      const { result } = renderHook(() => useLocationPermissions());

      act(() => {
        result.current.requestPermissions();
      });

      expect(result.current.isRequesting).toBe(true);

      await act(async () => {
        resolvePromise!({
          'android.permission.ACCESS_FINE_LOCATION':
            PermissionsAndroid.RESULTS.GRANTED,
          'android.permission.ACCESS_COARSE_LOCATION':
            PermissionsAndroid.RESULTS.GRANTED,
        });
        await promise;
      });

      expect(result.current.isRequesting).toBe(false);
    });

    it('should handle errors during request', async () => {
      (PermissionsAndroid.requestMultiple as jest.Mock).mockRejectedValue(
        new Error('Request failed')
      );

      const { result } = renderHook(() => useLocationPermissions());

      await act(async () => {
        const granted = await result.current.requestPermissions();
        expect(granted).toBe(false);
      });

      expect(result.current.isRequesting).toBe(false);
      expect(result.current.permissionStatus.location.status).toBe(
        LocationPermissionStatus.DENIED
      );
    });

    it('should return true from requestPermissions when location granted and notification denied on Android', async () => {
      Object.defineProperty(Platform, 'Version', {
        get: () => 30,
        configurable: true,
      });
      (PermissionsAndroid.requestMultiple as jest.Mock).mockResolvedValue({
        'android.permission.ACCESS_FINE_LOCATION':
          PermissionsAndroid.RESULTS.GRANTED,
        'android.permission.ACCESS_COARSE_LOCATION':
          PermissionsAndroid.RESULTS.GRANTED,
      });
      (PermissionsAndroid.request as jest.Mock).mockResolvedValue(
        PermissionsAndroid.RESULTS.GRANTED
      );
      (
        BackgroundLocationModule.requestNotificationPermission as jest.Mock
      ).mockResolvedValueOnce('denied');

      const { result } = renderHook(() => useLocationPermissions());

      await act(async () => {
        const granted = await result.current.requestPermissions();
        expect(granted).toBe(true); // location-based return
      });

      expect(result.current.permissionStatus.location.hasPermission).toBe(true);
      expect(result.current.permissionStatus.notification.hasPermission).toBe(
        false
      );
      expect(result.current.permissionStatus.hasAllPermissions).toBe(false);
    });
  });

  describe('Platform handling', () => {
    it('should handle Android platform correctly', async () => {
      Platform.OS = 'android';
      Object.defineProperty(Platform, 'Version', {
        get: () => 28, // Android 9, no background permission needed
        configurable: true,
      });
      (PermissionsAndroid.requestMultiple as jest.Mock).mockResolvedValue({
        'android.permission.ACCESS_FINE_LOCATION':
          PermissionsAndroid.RESULTS.GRANTED,
        'android.permission.ACCESS_COARSE_LOCATION':
          PermissionsAndroid.RESULTS.GRANTED,
      });

      const { result } = renderHook(() => useLocationPermissions());

      await act(async () => {
        const granted = await result.current.requestPermissions();
        expect(granted).toBe(true);
      });
    });
  });

  describe('iOS permissions', () => {
    beforeEach(() => {
      Platform.OS = 'ios';
      jest.clearAllMocks();
      // Default notification mocks for all iOS tests
      (
        BackgroundLocationModule.checkNotificationPermission as jest.Mock
      ).mockResolvedValue('granted');
      (
        BackgroundLocationModule.requestNotificationPermission as jest.Mock
      ).mockResolvedValue('granted');
    });

    describe('checkPermissions on iOS', () => {
      it('should call native checkLocationPermission and return granted', async () => {
        (
          BackgroundLocationModule.checkLocationPermission as jest.Mock
        ).mockResolvedValueOnce({
          status: 'granted',
          canRequestAgain: false,
        });

        const { result } = renderHook(() => useLocationPermissions());

        await act(async () => {
          const hasPermission = await result.current.checkPermissions();
          expect(hasPermission).toBe(true);
        });

        expect(
          BackgroundLocationModule.checkLocationPermission
        ).toHaveBeenCalledTimes(1);
        expect(result.current.permissionStatus.location.hasPermission).toBe(
          true
        );
        expect(result.current.permissionStatus.location.status).toBe(
          LocationPermissionStatus.GRANTED
        );
        expect(result.current.permissionStatus.location.canRequestAgain).toBe(
          false
        );
        expect(PermissionsAndroid.check).not.toHaveBeenCalled();
      });

      it('should map undetermined status correctly', async () => {
        (
          BackgroundLocationModule.checkLocationPermission as jest.Mock
        ).mockResolvedValueOnce({
          status: 'undetermined',
          canRequestAgain: true,
        });

        const { result } = renderHook(() => useLocationPermissions());

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

      it('should map denied status correctly', async () => {
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
      });

      it('should map blocked status correctly (restricted on iOS)', async () => {
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
      });

      it('should handle errors gracefully', async () => {
        (
          BackgroundLocationModule.checkLocationPermission as jest.Mock
        ).mockRejectedValueOnce(new Error('Native error'));

        const { result } = renderHook(() => useLocationPermissions());

        await act(async () => {
          const hasPermission = await result.current.checkPermissions();
          expect(hasPermission).toBe(false);
        });
      });
    });

    describe('requestPermissions on iOS', () => {
      it('should call native requestLocationPermission and return granted', async () => {
        (
          BackgroundLocationModule.requestLocationPermission as jest.Mock
        ).mockResolvedValueOnce({
          status: 'granted',
          canRequestAgain: false,
        });

        const { result } = renderHook(() => useLocationPermissions());

        await act(async () => {
          const granted = await result.current.requestPermissions();
          expect(granted).toBe(true);
        });

        expect(
          BackgroundLocationModule.requestLocationPermission
        ).toHaveBeenCalledWith(false);
        expect(result.current.permissionStatus.location.hasPermission).toBe(
          true
        );
        expect(result.current.permissionStatus.location.status).toBe(
          LocationPermissionStatus.GRANTED
        );
        expect(result.current.isRequesting).toBe(false);
      });

      it('should handle permission denied', async () => {
        (
          BackgroundLocationModule.requestLocationPermission as jest.Mock
        ).mockResolvedValueOnce({
          status: 'denied',
          canRequestAgain: false,
        });

        const { result } = renderHook(() => useLocationPermissions());

        await act(async () => {
          const granted = await result.current.requestPermissions();
          expect(granted).toBe(false);
        });

        expect(result.current.permissionStatus.location.hasPermission).toBe(
          false
        );
        expect(result.current.permissionStatus.location.status).toBe(
          LocationPermissionStatus.DENIED
        );
        expect(result.current.permissionStatus.location.canRequestAgain).toBe(
          false
        );
      });

      it('should handle blocked (restricted) status', async () => {
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
      });

      it('should set isRequesting during the request', async () => {
        let resolvePermission: (value: any) => void;
        const permissionPromise = new Promise((resolve) => {
          resolvePermission = resolve;
        });

        (
          BackgroundLocationModule.requestLocationPermission as jest.Mock
        ).mockReturnValueOnce(permissionPromise);

        const { result } = renderHook(() => useLocationPermissions());

        act(() => {
          result.current.requestPermissions();
        });

        expect(result.current.isRequesting).toBe(true);

        await act(async () => {
          resolvePermission!({
            status: 'granted',
            canRequestAgain: false,
          });
          await permissionPromise;
        });

        expect(result.current.isRequesting).toBe(false);
      });

      it('should handle native errors gracefully', async () => {
        (
          BackgroundLocationModule.requestLocationPermission as jest.Mock
        ).mockRejectedValueOnce(new Error('Native error'));

        const { result } = renderHook(() => useLocationPermissions());

        await act(async () => {
          const granted = await result.current.requestPermissions();
          expect(granted).toBe(false);
        });

        expect(result.current.isRequesting).toBe(false);
        expect(result.current.permissionStatus.location.status).toBe(
          LocationPermissionStatus.DENIED
        );
        expect(result.current.permissionStatus.location.canRequestAgain).toBe(
          false
        );
      });

      it('should not call PermissionsAndroid on iOS', async () => {
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
        expect(PermissionsAndroid.request).not.toHaveBeenCalled();
      });
    });
  });
});
