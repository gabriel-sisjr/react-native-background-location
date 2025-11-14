import { act, renderHook } from '@testing-library/react-native';
import { Platform, PermissionsAndroid } from 'react-native';
import { useLocationPermissions } from '../../hooks/useLocationPermissions';
import { LocationPermissionStatus } from '../../types';

describe('useLocationPermissions - Complete Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'android';
    Object.defineProperty(Platform, 'Version', {
      get: () => 30,
      configurable: true,
    });
  });

  describe('Initialization', () => {
    it('should initialize with undetermined status', () => {
      const { result } = renderHook(() => useLocationPermissions());

      expect(result.current.permissionStatus.hasPermission).toBe(false);
      expect(result.current.permissionStatus.status).toBe(
        LocationPermissionStatus.UNDETERMINED
      );
      expect(result.current.permissionStatus.canRequestAgain).toBe(true);
      expect(result.current.isRequesting).toBe(false);
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

      expect(result.current.permissionStatus.hasPermission).toBe(true);
      expect(result.current.permissionStatus.status).toBe(
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

      expect(result.current.permissionStatus.hasPermission).toBe(false);
      expect(result.current.permissionStatus.status).toBe(
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

      expect(result.current.permissionStatus.status).toBe(
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

      expect(result.current.permissionStatus.hasPermission).toBe(true);
      expect(result.current.permissionStatus.status).toBe(
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

      expect(result.current.permissionStatus.hasPermission).toBe(false);
      expect(result.current.permissionStatus.status).toBe(
        LocationPermissionStatus.DENIED
      );
      expect(result.current.permissionStatus.canRequestAgain).toBe(true);
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

      expect(result.current.permissionStatus.status).toBe(
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

      expect(result.current.permissionStatus.status).toBe(
        LocationPermissionStatus.BLOCKED
      );
      expect(result.current.permissionStatus.canRequestAgain).toBe(false);
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

      expect(result.current.permissionStatus.status).toBe(
        LocationPermissionStatus.BLOCKED
      );
      expect(result.current.permissionStatus.canRequestAgain).toBe(false);
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
      expect(result.current.permissionStatus.status).toBe(
        LocationPermissionStatus.DENIED
      );
    });
  });

  describe('Platform handling', () => {
    it('should return false for iOS platform', async () => {
      Platform.OS = 'ios';

      const { result } = renderHook(() => useLocationPermissions());

      await act(async () => {
        const granted = await result.current.requestPermissions();
        expect(granted).toBe(false);
      });

      expect(result.current.permissionStatus.status).toBe(
        LocationPermissionStatus.UNDETERMINED
      );
    });

    it('should handle iOS platform in checkPermissions (lines 39-44)', async () => {
      Platform.OS = 'ios';

      const { result } = renderHook(() => useLocationPermissions());

      await act(async () => {
        const hasPermission = await result.current.checkPermissions();
        expect(hasPermission).toBe(false);
      });

      expect(result.current.permissionStatus.hasPermission).toBe(false);
      expect(result.current.permissionStatus.status).toBe(
        LocationPermissionStatus.UNDETERMINED
      );
      expect(result.current.permissionStatus.canRequestAgain).toBe(true);
      expect(PermissionsAndroid.check).not.toHaveBeenCalled();
    });

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
});
