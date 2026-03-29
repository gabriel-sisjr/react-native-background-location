import { act, renderHook, waitFor } from '@testing-library/react-native';
import { NativeModules, Platform } from 'react-native';
import { useLocationPermissions } from '../../hooks/useLocationPermissions';
import { useBackgroundLocation } from '../../hooks/useBackgroundLocation';
import { useLocationTracking } from '../../hooks/useLocationTracking';
import { useLocationUpdates } from '../../hooks/useLocationUpdates';
import { LocationPermissionStatus, LocationAccuracy } from '../../types';
import BackgroundLocationModule from '../../NativeBackgroundLocation';
import BackgroundLocation from '../../index';

jest.mock('../../NativeBackgroundLocation', () => ({
  __esModule: true,
  default: {
    startTracking: jest.fn(),
    stopTracking: jest.fn(),
    isTracking: jest.fn(),
    getLocations: jest.fn(),
    clearTrip: jest.fn(),
    updateNotification: jest.fn(),
    checkLocationPermission: jest.fn(),
    requestLocationPermission: jest.fn(),
    checkNotificationPermission: jest.fn(),
    requestNotificationPermission: jest.fn(),
  },
}));

describe('iOS Tracking Integration Tests', () => {
  const mockTripId = 'ios-trip-001';
  const mockLocations = [
    { latitude: '37.7749', longitude: '-122.4194', timestamp: 1640995200000 },
    { latitude: '37.7849', longitude: '-122.4094', timestamp: 1640995260000 },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'ios';
    NativeModules.BackgroundLocation = {
      startTracking: jest.fn(),
      stopTracking: jest.fn(),
      isTracking: jest.fn(),
      getLocations: jest.fn(),
      clearTrip: jest.fn(),
    } as any;

    console.warn = jest.fn();
    console.error = jest.fn();

    // Default mock behaviors
    (BackgroundLocationModule.startTracking as jest.Mock) = jest.fn();
    (BackgroundLocationModule.stopTracking as jest.Mock) = jest.fn();
    (BackgroundLocationModule.isTracking as jest.Mock) = jest.fn();
    (BackgroundLocationModule.getLocations as jest.Mock) = jest.fn();
    (BackgroundLocationModule.clearTrip as jest.Mock) = jest.fn();
    (BackgroundLocationModule.updateNotification as jest.Mock) = jest.fn();
    (BackgroundLocationModule.checkLocationPermission as jest.Mock) = jest.fn();
    (BackgroundLocationModule.requestLocationPermission as jest.Mock) =
      jest.fn();
    (BackgroundLocationModule.checkNotificationPermission as jest.Mock) =
      jest.fn();
    (BackgroundLocationModule.requestNotificationPermission as jest.Mock) =
      jest.fn();

    (
      BackgroundLocationModule.checkNotificationPermission as jest.Mock
    ).mockResolvedValue('granted');
    (
      BackgroundLocationModule.requestNotificationPermission as jest.Mock
    ).mockResolvedValue('granted');

    (BackgroundLocationModule.isTracking as jest.Mock).mockResolvedValue({
      active: false,
      tripId: undefined,
    });
  });

  afterEach(() => {
    (BackgroundLocationModule.startTracking as jest.Mock) = jest.fn();
    (BackgroundLocationModule.stopTracking as jest.Mock) = jest.fn();
    (BackgroundLocationModule.isTracking as jest.Mock) = jest.fn();
    (BackgroundLocationModule.getLocations as jest.Mock) = jest.fn();
    (BackgroundLocationModule.clearTrip as jest.Mock) = jest.fn();
    (BackgroundLocationModule.updateNotification as jest.Mock) = jest.fn();
    (BackgroundLocationModule.checkLocationPermission as jest.Mock) = jest.fn();
    (BackgroundLocationModule.requestLocationPermission as jest.Mock) =
      jest.fn();
    (BackgroundLocationModule.checkNotificationPermission as jest.Mock) =
      jest.fn();
    (BackgroundLocationModule.requestNotificationPermission as jest.Mock) =
      jest.fn();
  });

  describe('Complete iOS tracking lifecycle', () => {
    it('should handle full permission check -> request -> tracking -> stop flow', async () => {
      // Step 1: Check permissions - returns undetermined
      (
        BackgroundLocationModule.checkLocationPermission as jest.Mock
      ).mockResolvedValueOnce({
        status: 'undetermined',
        canRequestAgain: true,
      });

      const { result: permResult } = renderHook(() => useLocationPermissions());

      await act(async () => {
        const hasPermission = await permResult.current.checkPermissions();
        expect(hasPermission).toBe(false);
      });

      expect(permResult.current.permissionStatus.location.status).toBe(
        LocationPermissionStatus.UNDETERMINED
      );
      expect(permResult.current.permissionStatus.location.canRequestAgain).toBe(
        true
      );

      // Step 2: Request permissions - returns granted
      (
        BackgroundLocationModule.requestLocationPermission as jest.Mock
      ).mockResolvedValueOnce({
        status: 'granted',
        canRequestAgain: false,
      });

      await act(async () => {
        const granted = await permResult.current.requestPermissions();
        expect(granted).toBe(true);
      });

      expect(permResult.current.permissionStatus.location.status).toBe(
        LocationPermissionStatus.GRANTED
      );
      expect(permResult.current.permissionStatus.location.hasPermission).toBe(
        true
      );

      // Step 3: Start tracking with options
      (BackgroundLocationModule.startTracking as jest.Mock).mockResolvedValue(
        mockTripId
      );
      (BackgroundLocationModule.isTracking as jest.Mock).mockResolvedValue({
        active: false,
        tripId: undefined,
      });

      const { result: trackResult } = renderHook(() => useBackgroundLocation());

      await waitFor(() => {
        expect(result_isNotLoading(trackResult)).toBe(true);
      });

      await act(async () => {
        const tripId = await trackResult.current.startTracking(mockTripId, {
          accuracy: LocationAccuracy.HIGH_ACCURACY,
          updateInterval: 5000,
        });
        expect(tripId).toBe(mockTripId);
      });

      expect(trackResult.current.isTracking).toBe(true);
      expect(trackResult.current.tripId).toBe(mockTripId);

      // Step 4: Get locations
      (BackgroundLocationModule.getLocations as jest.Mock).mockResolvedValue(
        mockLocations
      );

      await act(async () => {
        await trackResult.current.refreshLocations();
      });

      expect(trackResult.current.locations).toEqual(mockLocations);
      expect(trackResult.current.locations).toHaveLength(2);

      // Step 5: Stop tracking
      (BackgroundLocationModule.stopTracking as jest.Mock).mockResolvedValue(
        undefined
      );

      await act(async () => {
        await trackResult.current.stopTracking();
      });

      expect(trackResult.current.isTracking).toBe(false);
    });

    it('should verify iOS uses native module for permissions, not PermissionsAndroid', async () => {
      const { PermissionsAndroid: MockPermissionsAndroid } =
        jest.requireMock('react-native');

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

      expect(
        BackgroundLocationModule.checkLocationPermission
      ).toHaveBeenCalledTimes(1);
      expect(MockPermissionsAndroid.check).not.toHaveBeenCalled();
      expect(MockPermissionsAndroid.request).not.toHaveBeenCalled();
      expect(MockPermissionsAndroid.requestMultiple).not.toHaveBeenCalled();
    });
  });

  describe('iOS permission -> tracking flow with WhenInUse', () => {
    it('should allow tracking when permission is whenInUse', async () => {
      // Request permissions - returns whenInUse
      (
        BackgroundLocationModule.requestLocationPermission as jest.Mock
      ).mockResolvedValueOnce({
        status: 'whenInUse',
        canRequestAgain: true,
      });

      const { result: permResult } = renderHook(() => useLocationPermissions());

      await act(async () => {
        const granted = await permResult.current.requestPermissions();
        expect(granted).toBe(true);
      });

      // WhenInUse should still mean hasPermission = true
      expect(permResult.current.permissionStatus.location.hasPermission).toBe(
        true
      );
      expect(permResult.current.permissionStatus.location.status).toBe(
        LocationPermissionStatus.WHEN_IN_USE
      );

      // Start tracking should succeed with whenInUse permission
      (BackgroundLocationModule.startTracking as jest.Mock).mockResolvedValue(
        mockTripId
      );
      (BackgroundLocationModule.isTracking as jest.Mock).mockResolvedValue({
        active: false,
        tripId: undefined,
      });

      const { result: trackResult } = renderHook(() => useBackgroundLocation());

      await waitFor(() => {
        expect(result_isNotLoading(trackResult)).toBe(true);
      });

      await act(async () => {
        const tripId = await trackResult.current.startTracking(mockTripId);
        expect(tripId).toBe(mockTripId);
      });

      expect(trackResult.current.isTracking).toBe(true);
      expect(trackResult.current.tripId).toBe(mockTripId);
    });

    it('should distinguish between granted and whenInUse statuses', async () => {
      // Check with whenInUse
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

      expect(result.current.permissionStatus.location.status).toBe(
        LocationPermissionStatus.WHEN_IN_USE
      );
      // WhenInUse is not GRANTED but still has permission
      expect(result.current.permissionStatus.location.status).not.toBe(
        LocationPermissionStatus.GRANTED
      );
      expect(result.current.permissionStatus.location.hasPermission).toBe(true);
    });
  });

  describe('iOS tracking with accuracy options', () => {
    it('should pass HIGH_ACCURACY to native module as string', async () => {
      (BackgroundLocationModule.startTracking as jest.Mock).mockResolvedValue(
        mockTripId
      );
      (BackgroundLocationModule.isTracking as jest.Mock).mockResolvedValue({
        active: false,
        tripId: undefined,
      });

      const { result } = renderHook(() => useBackgroundLocation());

      await waitFor(() => {
        expect(result_isNotLoading(result)).toBe(true);
      });

      await act(async () => {
        await result.current.startTracking(mockTripId, {
          accuracy: LocationAccuracy.HIGH_ACCURACY,
        });
      });

      expect(BackgroundLocationModule.startTracking).toHaveBeenCalledWith(
        mockTripId,
        expect.objectContaining({
          accuracy: 'HIGH_ACCURACY',
        })
      );
    });

    it('should pass distanceFilter option through to native module', async () => {
      (BackgroundLocationModule.startTracking as jest.Mock).mockResolvedValue(
        mockTripId
      );
      (BackgroundLocationModule.isTracking as jest.Mock).mockResolvedValue({
        active: false,
        tripId: undefined,
      });

      const { result } = renderHook(() => useBackgroundLocation());

      await waitFor(() => {
        expect(result_isNotLoading(result)).toBe(true);
      });

      await act(async () => {
        await result.current.startTracking(mockTripId, {
          accuracy: LocationAccuracy.BALANCED_POWER_ACCURACY,
          distanceFilter: 10,
          updateInterval: 3000,
        });
      });

      expect(BackgroundLocationModule.startTracking).toHaveBeenCalledWith(
        mockTripId,
        expect.objectContaining({
          accuracy: 'BALANCED_POWER_ACCURACY',
          distanceFilter: 10,
          updateInterval: 3000,
        })
      );
    });

    it('should handle all accuracy levels on iOS', async () => {
      (BackgroundLocationModule.isTracking as jest.Mock).mockResolvedValue({
        active: false,
        tripId: undefined,
      });

      const accuracyLevels = [
        LocationAccuracy.HIGH_ACCURACY,
        LocationAccuracy.BALANCED_POWER_ACCURACY,
        LocationAccuracy.LOW_POWER,
        LocationAccuracy.NO_POWER,
        LocationAccuracy.PASSIVE,
      ];

      for (const accuracy of accuracyLevels) {
        (BackgroundLocationModule.startTracking as jest.Mock).mockResolvedValue(
          `trip-${accuracy}`
        );

        const { result } = renderHook(() => useBackgroundLocation());

        await waitFor(() => {
          expect(result_isNotLoading(result)).toBe(true);
        });

        await act(async () => {
          await result.current.startTracking(`trip-${accuracy}`, {
            accuracy,
          });
        });

        expect(BackgroundLocationModule.startTracking).toHaveBeenCalledWith(
          `trip-${accuracy}`,
          expect.objectContaining({
            accuracy: String(accuracy),
          })
        );
      }
    });
  });

  describe('iOS real-time location updates', () => {
    it('should accumulate location updates from events on iOS', async () => {
      (BackgroundLocationModule.isTracking as jest.Mock).mockResolvedValue({
        active: true,
        tripId: mockTripId,
      });
      (BackgroundLocationModule.getLocations as jest.Mock).mockResolvedValue(
        []
      );

      const { result } = renderHook(() =>
        useLocationUpdates({ tripId: mockTripId })
      );

      await waitFor(() => {
        expect(result.current.isTracking).toBe(true);
      });

      // Simulate first location event
      act(() => {
        (global as any).simulateLocationEvent({
          tripId: mockTripId,
          latitude: '37.7750',
          longitude: '-122.4195',
          timestamp: 1640995300000,
        });
      });

      await waitFor(() => {
        expect(result.current.locations).toHaveLength(1);
        expect(result.current.lastLocation).toEqual(
          expect.objectContaining({
            latitude: '37.7750',
            longitude: '-122.4195',
          })
        );
      });

      // Simulate second location event
      act(() => {
        (global as any).simulateLocationEvent({
          tripId: mockTripId,
          latitude: '37.7760',
          longitude: '-122.4185',
          timestamp: 1640995360000,
        });
      });

      await waitFor(() => {
        expect(result.current.locations).toHaveLength(2);
        expect(result.current.lastLocation).toEqual(
          expect.objectContaining({
            latitude: '37.7760',
            longitude: '-122.4185',
          })
        );
      });
    });

    it('should update lastLocation on each new event', async () => {
      (BackgroundLocationModule.isTracking as jest.Mock).mockResolvedValue({
        active: true,
        tripId: mockTripId,
      });
      (BackgroundLocationModule.getLocations as jest.Mock).mockResolvedValue(
        []
      );

      const onLocationUpdate = jest.fn();
      const { result } = renderHook(() =>
        useLocationUpdates({ tripId: mockTripId, onLocationUpdate })
      );

      await waitFor(() => {
        expect(result.current.isTracking).toBe(true);
      });

      const locationData = {
        tripId: mockTripId,
        latitude: '37.7770',
        longitude: '-122.4175',
        timestamp: 1640995400000,
        accuracy: 5.0,
        altitude: 15.2,
        speed: 1.5,
      };

      act(() => {
        (global as any).simulateLocationEvent(locationData);
      });

      await waitFor(() => {
        expect(result.current.lastLocation).toEqual(
          expect.objectContaining({
            latitude: '37.7770',
            longitude: '-122.4175',
            accuracy: 5.0,
            altitude: 15.2,
            speed: 1.5,
          })
        );
        expect(onLocationUpdate).toHaveBeenCalled();
      });
    });
  });

  describe('iOS location warning events', () => {
    it('should handle LOCATION_UNAVAILABLE warning on iOS', async () => {
      (BackgroundLocationModule.isTracking as jest.Mock).mockResolvedValue({
        active: true,
        tripId: mockTripId,
      });
      (BackgroundLocationModule.getLocations as jest.Mock).mockResolvedValue(
        []
      );

      const onLocationWarning = jest.fn();
      const { result } = renderHook(() =>
        useLocationUpdates({ tripId: mockTripId, onLocationWarning })
      );

      await waitFor(() => {
        expect(result.current.isTracking).toBe(true);
      });

      const warningEvent = {
        tripId: mockTripId,
        type: 'LOCATION_UNAVAILABLE',
        message: 'GPS signal lost',
        timestamp: Date.now(),
      };

      act(() => {
        (global as any).simulateWarningEvent(warningEvent);
      });

      await waitFor(() => {
        expect(result.current.lastWarning).toEqual(warningEvent);
        expect(onLocationWarning).toHaveBeenCalledWith(warningEvent);
      });
    });

    it('should handle multiple warning types on iOS', async () => {
      (BackgroundLocationModule.isTracking as jest.Mock).mockResolvedValue({
        active: true,
        tripId: mockTripId,
      });
      (BackgroundLocationModule.getLocations as jest.Mock).mockResolvedValue(
        []
      );

      const onLocationWarning = jest.fn();
      const { result } = renderHook(() =>
        useLocationUpdates({ tripId: mockTripId, onLocationWarning })
      );

      await waitFor(() => {
        expect(result.current.isTracking).toBe(true);
      });

      // Simulate LOCATION_UNAVAILABLE
      const unavailableWarning = {
        tripId: mockTripId,
        type: 'LOCATION_UNAVAILABLE',
        message: 'Location services disabled',
        timestamp: Date.now(),
      };

      act(() => {
        (global as any).simulateWarningEvent(unavailableWarning);
      });

      await waitFor(() => {
        expect(result.current.lastWarning).toEqual(unavailableWarning);
      });

      // Simulate SERVICE_TIMEOUT (could happen on iOS with background limits)
      const timeoutWarning = {
        tripId: mockTripId,
        type: 'SERVICE_TIMEOUT',
        message: 'Background task expired',
        timestamp: Date.now() + 1000,
      };

      act(() => {
        (global as any).simulateWarningEvent(timeoutWarning);
      });

      await waitFor(() => {
        expect(result.current.lastWarning).toEqual(timeoutWarning);
        expect(onLocationWarning).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('iOS foreground-only mode', () => {
    it('should pass foregroundOnly option to native module', async () => {
      (BackgroundLocationModule.startTracking as jest.Mock).mockResolvedValue(
        mockTripId
      );
      (BackgroundLocationModule.isTracking as jest.Mock).mockResolvedValue({
        active: false,
        tripId: undefined,
      });

      const { result } = renderHook(() => useBackgroundLocation());

      await waitFor(() => {
        expect(result_isNotLoading(result)).toBe(true);
      });

      await act(async () => {
        await result.current.startTracking(mockTripId, {
          foregroundOnly: true,
          accuracy: LocationAccuracy.HIGH_ACCURACY,
        });
      });

      expect(BackgroundLocationModule.startTracking).toHaveBeenCalledWith(
        mockTripId,
        expect.objectContaining({
          foregroundOnly: true,
          accuracy: 'HIGH_ACCURACY',
        })
      );
    });

    it('should default foregroundOnly to undefined when not specified', async () => {
      (BackgroundLocationModule.startTracking as jest.Mock).mockResolvedValue(
        mockTripId
      );
      (BackgroundLocationModule.isTracking as jest.Mock).mockResolvedValue({
        active: false,
        tripId: undefined,
      });

      const { result } = renderHook(() => useBackgroundLocation());

      await waitFor(() => {
        expect(result_isNotLoading(result)).toBe(true);
      });

      await act(async () => {
        await result.current.startTracking(mockTripId, {
          accuracy: LocationAccuracy.HIGH_ACCURACY,
        });
      });

      const callArgs = (BackgroundLocationModule.startTracking as jest.Mock)
        .mock.calls[0];
      const options = callArgs?.[1];
      expect(options?.foregroundOnly).toBeUndefined();
    });
  });

  describe('iOS trip management', () => {
    it('should manage trip lifecycle: start -> get locations -> clear', async () => {
      // Start tracking to get a tripId
      (BackgroundLocationModule.startTracking as jest.Mock).mockResolvedValue(
        mockTripId
      );
      (BackgroundLocationModule.isTracking as jest.Mock).mockResolvedValue({
        active: false,
        tripId: undefined,
      });

      const { result } = renderHook(() => useBackgroundLocation());

      await waitFor(() => {
        expect(result_isNotLoading(result)).toBe(true);
      });

      // Start tracking
      await act(async () => {
        const tripId = await result.current.startTracking(mockTripId);
        expect(tripId).toBe(mockTripId);
      });

      expect(result.current.tripId).toBe(mockTripId);

      // Get locations for the trip
      (BackgroundLocationModule.getLocations as jest.Mock).mockResolvedValue(
        mockLocations
      );

      await act(async () => {
        await result.current.refreshLocations();
      });

      expect(result.current.locations).toEqual(mockLocations);
      expect(BackgroundLocationModule.getLocations).toHaveBeenCalledWith(
        mockTripId
      );

      // Clear the trip
      (BackgroundLocationModule.clearTrip as jest.Mock).mockResolvedValue(
        undefined
      );

      await act(async () => {
        await result.current.clearCurrentTrip();
      });

      expect(BackgroundLocationModule.clearTrip).toHaveBeenCalledWith(
        mockTripId
      );
      expect(result.current.locations).toEqual([]);
    });

    it('should not clear trip when no tripId is set', async () => {
      (BackgroundLocationModule.isTracking as jest.Mock).mockResolvedValue({
        active: false,
        tripId: undefined,
      });

      const { result } = renderHook(() => useBackgroundLocation());

      await waitFor(() => {
        expect(result_isNotLoading(result)).toBe(true);
      });

      await act(async () => {
        await result.current.clearCurrentTrip();
      });

      expect(BackgroundLocationModule.clearTrip).not.toHaveBeenCalled();
    });
  });

  describe('iOS updateNotification no-op', () => {
    it('should resolve updateNotification without error on iOS', async () => {
      (
        BackgroundLocationModule.updateNotification as jest.Mock
      ).mockResolvedValue(undefined);

      await expect(
        BackgroundLocation.updateNotification(
          'Updated Title',
          'Updated tracking text'
        )
      ).resolves.toBeUndefined();
    });

    it('should call native updateNotification on iOS (resolved as no-op in native)', async () => {
      (
        BackgroundLocationModule.updateNotification as jest.Mock
      ).mockResolvedValue(undefined);

      await BackgroundLocation.updateNotification(
        'Delivery Active',
        'En route to destination'
      );

      expect(BackgroundLocationModule.updateNotification).toHaveBeenCalledWith(
        'Delivery Active',
        'En route to destination'
      );
    });
  });

  describe('iOS permission denied -> tracking behavior', () => {
    it('should still allow startTracking call after permission denied', async () => {
      // Request permissions - returns denied
      (
        BackgroundLocationModule.requestLocationPermission as jest.Mock
      ).mockResolvedValueOnce({
        status: 'denied',
        canRequestAgain: false,
      });

      const { result: permResult } = renderHook(() => useLocationPermissions());

      await act(async () => {
        const granted = await permResult.current.requestPermissions();
        expect(granted).toBe(false);
      });

      expect(permResult.current.permissionStatus.location.hasPermission).toBe(
        false
      );
      expect(permResult.current.permissionStatus.location.status).toBe(
        LocationPermissionStatus.DENIED
      );

      // Tracking can still technically be called (permission check is at native level)
      (BackgroundLocationModule.startTracking as jest.Mock).mockResolvedValue(
        'denied-trip-001'
      );
      (BackgroundLocationModule.isTracking as jest.Mock).mockResolvedValue({
        active: false,
        tripId: undefined,
      });

      const { result: trackResult } = renderHook(() => useBackgroundLocation());

      await waitFor(() => {
        expect(result_isNotLoading(trackResult)).toBe(true);
      });

      await act(async () => {
        const tripId =
          await trackResult.current.startTracking('denied-trip-001');
        expect(tripId).toBe('denied-trip-001');
      });

      // The hook sets tracking state regardless - native layer handles permission
      expect(trackResult.current.isTracking).toBe(true);
    });

    it('should set canRequestAgain to false when permission is blocked', async () => {
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

  describe('iOS error handling in tracking flow', () => {
    it('should set error state when startTracking rejects', async () => {
      const trackingError = new Error('CLLocationManager authorization denied');

      (BackgroundLocationModule.startTracking as jest.Mock).mockRejectedValue(
        trackingError
      );
      (BackgroundLocationModule.isTracking as jest.Mock).mockResolvedValue({
        active: false,
        tripId: undefined,
      });

      const onError = jest.fn();
      const { result } = renderHook(() => useBackgroundLocation({ onError }));

      await waitFor(() => {
        expect(result_isNotLoading(result)).toBe(true);
      });

      await act(async () => {
        const tripId = await result.current.startTracking(mockTripId);
        expect(tripId).toBeNull();
      });

      expect(result.current.error).toEqual(trackingError);
      expect(result.current.error?.message).toBe(
        'CLLocationManager authorization denied'
      );
      expect(onError).toHaveBeenCalledWith(trackingError);
      expect(result.current.isTracking).toBe(false);
    });

    it('should clear error and allow retry after failure', async () => {
      const trackingError = new Error('Location services disabled');

      // First call fails
      (
        BackgroundLocationModule.startTracking as jest.Mock
      ).mockRejectedValueOnce(trackingError);
      (BackgroundLocationModule.isTracking as jest.Mock).mockResolvedValue({
        active: false,
        tripId: undefined,
      });

      const { result } = renderHook(() => useBackgroundLocation());

      await waitFor(() => {
        expect(result_isNotLoading(result)).toBe(true);
      });

      // First attempt fails
      await act(async () => {
        await result.current.startTracking(mockTripId);
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.error?.message).toBe('Location services disabled');

      // Clear error
      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();

      // Retry succeeds
      (BackgroundLocationModule.startTracking as jest.Mock).mockResolvedValue(
        mockTripId
      );

      await act(async () => {
        const tripId = await result.current.startTracking(mockTripId);
        expect(tripId).toBe(mockTripId);
      });

      expect(result.current.error).toBeNull();
      expect(result.current.isTracking).toBe(true);
      expect(result.current.tripId).toBe(mockTripId);
    });

    it('should handle stopTracking errors on iOS', async () => {
      const stopError = new Error('Failed to stop CLLocationManager');

      (BackgroundLocationModule.startTracking as jest.Mock).mockResolvedValue(
        mockTripId
      );
      (BackgroundLocationModule.stopTracking as jest.Mock).mockRejectedValue(
        stopError
      );
      (BackgroundLocationModule.isTracking as jest.Mock).mockResolvedValue({
        active: false,
        tripId: undefined,
      });

      const onError = jest.fn();
      const { result } = renderHook(() => useBackgroundLocation({ onError }));

      await waitFor(() => {
        expect(result_isNotLoading(result)).toBe(true);
      });

      // Start tracking first
      await act(async () => {
        await result.current.startTracking(mockTripId);
      });

      expect(result.current.isTracking).toBe(true);

      // Stop tracking fails
      await act(async () => {
        try {
          await result.current.stopTracking();
        } catch {
          // Expected to throw
        }
      });

      expect(result.current.error).toEqual(stopError);
      expect(onError).toHaveBeenCalledWith(stopError);
    });

    it('should wrap non-Error exceptions in Error objects', async () => {
      (BackgroundLocationModule.startTracking as jest.Mock).mockRejectedValue(
        'String error from native'
      );
      (BackgroundLocationModule.isTracking as jest.Mock).mockResolvedValue({
        active: false,
        tripId: undefined,
      });

      const { result } = renderHook(() => useBackgroundLocation());

      await waitFor(() => {
        expect(result_isNotLoading(result)).toBe(true);
      });

      await act(async () => {
        const tripId = await result.current.startTracking(mockTripId);
        expect(tripId).toBeNull();
      });

      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe('Failed to start tracking');
    });
  });

  describe('iOS tracking status monitoring', () => {
    it('should monitor tracking status with useLocationTracking on iOS', async () => {
      (BackgroundLocationModule.isTracking as jest.Mock).mockResolvedValue({
        active: true,
        tripId: mockTripId,
      });

      const { result } = renderHook(() => useLocationTracking());

      await waitFor(() => {
        expect(result.current.isTracking).toBe(true);
        expect(result.current.tripId).toBe(mockTripId);
      });

      expect(result.current.isLoading).toBe(false);
    });

    it('should refresh tracking status on iOS', async () => {
      (BackgroundLocationModule.isTracking as jest.Mock)
        .mockResolvedValueOnce({ active: false, tripId: undefined })
        .mockResolvedValueOnce({ active: true, tripId: mockTripId });

      const { result } = renderHook(() => useLocationTracking());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isTracking).toBe(false);

      await act(async () => {
        await result.current.refresh();
      });

      expect(result.current.isTracking).toBe(true);
      expect(result.current.tripId).toBe(mockTripId);
    });

    it('should handle error during status refresh on iOS', async () => {
      (BackgroundLocationModule.isTracking as jest.Mock)
        .mockResolvedValueOnce({ active: false, tripId: undefined })
        .mockRejectedValueOnce(new Error('Native module error'));

      const { result } = renderHook(() => useLocationTracking());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.refresh();
      });

      // Should reset to safe defaults on error
      expect(result.current.isTracking).toBe(false);
      expect(result.current.tripId).toBeNull();
    });
  });

  describe('iOS callbacks integration', () => {
    it('should trigger onTrackingStart and onTrackingStop callbacks on iOS', async () => {
      const onTrackingStart = jest.fn();
      const onTrackingStop = jest.fn();

      (BackgroundLocationModule.startTracking as jest.Mock).mockResolvedValue(
        mockTripId
      );
      (BackgroundLocationModule.stopTracking as jest.Mock).mockResolvedValue(
        undefined
      );
      (BackgroundLocationModule.isTracking as jest.Mock).mockResolvedValue({
        active: false,
        tripId: undefined,
      });

      const { result } = renderHook(() =>
        useBackgroundLocation({ onTrackingStart, onTrackingStop })
      );

      await waitFor(() => {
        expect(result_isNotLoading(result)).toBe(true);
      });

      // Start tracking
      await act(async () => {
        await result.current.startTracking(mockTripId);
      });

      expect(onTrackingStart).toHaveBeenCalledWith(mockTripId);
      expect(onTrackingStop).not.toHaveBeenCalled();

      // Stop tracking
      await act(async () => {
        await result.current.stopTracking();
      });

      expect(onTrackingStop).toHaveBeenCalledTimes(1);
    });
  });
});

/**
 * Helper function to check if a hook result is not in loading state.
 * Used to wait for initial mount effects to complete.
 */
function result_isNotLoading(result: {
  current: { isLoading: boolean };
}): boolean {
  return !result.current.isLoading;
}
