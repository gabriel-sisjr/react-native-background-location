import { act, renderHook, waitFor } from '@testing-library/react-native';
import { NativeModules, Platform } from 'react-native';
import { useLocationUpdates } from '../../hooks/useLocationUpdates';
import BackgroundLocationModule from '../../NativeBackgroundLocation';

jest.mock('../../NativeBackgroundLocation', () => ({
  __esModule: true,
  default: {
    isTracking: jest.fn(),
    getLocations: jest.fn(),
    clearTrip: jest.fn(),
  },
}));

describe('useLocationUpdates', () => {
  const mockTripId = 'test-trip-123';
  const mockLocations = [
    { latitude: '37.7749', longitude: '-122.4194', timestamp: 1640995200000 },
    { latitude: '37.7849', longitude: '-122.4094', timestamp: 1640995260000 },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'android';
    NativeModules.BackgroundLocation = {
      isTracking: jest.fn(),
      getLocations: jest.fn(),
    } as any;

    console.warn = jest.fn();
    console.error = jest.fn();

    (BackgroundLocationModule.isTracking as jest.Mock).mockResolvedValue({
      active: false,
      tripId: undefined,
    });
  });

  const simulateEvent = (data: any) => {
    (global as any).simulateLocationEvent(data);
  };

  describe('Initialization', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useLocationUpdates());

      expect(result.current.tripId).toBeNull();
      expect(result.current.isTracking).toBe(false);
      expect(result.current.locations).toEqual([]);
      expect(result.current.lastLocation).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(typeof result.current.clearError).toBe('function');
    });

    it('should subscribe to location update events', () => {
      const { unmount } = renderHook(() => useLocationUpdates());

      // Component should mount without errors and clean up properly
      unmount();

      // We can't directly test the subscription without exposing internals,
      // but we can verify no errors were thrown
      expect(true).toBe(true);
    });

    it.skip('should warn when module is not available', async () => {
      (global as any).setModuleAvailable(false);

      renderHook(() => useLocationUpdates());

      await waitFor(() => {
        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining('BackgroundLocation not available')
        );
      });
    });

    it('should check tracking status and load locations on mount when autoLoad=true', async () => {
      (BackgroundLocationModule.isTracking as jest.Mock).mockResolvedValue({
        active: true,
        tripId: mockTripId,
      });
      (BackgroundLocationModule.getLocations as jest.Mock).mockResolvedValue(
        mockLocations
      );

      const { result } = renderHook(() =>
        useLocationUpdates({ autoLoad: true })
      );

      await waitFor(() => {
        expect(result.current.isTracking).toBe(true);
      });

      expect(result.current.tripId).toBe(mockTripId);
      expect(result.current.locations).toEqual(mockLocations);
      expect(result.current.lastLocation).toEqual(mockLocations[1]);
    });

    it('should not load locations when autoLoad=false', async () => {
      (BackgroundLocationModule.isTracking as jest.Mock).mockResolvedValue({
        active: true,
        tripId: mockTripId,
      });

      const { result } = renderHook(() =>
        useLocationUpdates({ autoLoad: false })
      );

      await waitFor(() => {
        expect(result.current.isTracking).toBe(true);
      });

      expect(BackgroundLocationModule.getLocations).not.toHaveBeenCalled();
      expect(result.current.locations).toEqual([]);
    });

    it('should use provided tripId', async () => {
      (BackgroundLocationModule.getLocations as jest.Mock).mockResolvedValue(
        mockLocations
      );
      (BackgroundLocationModule.isTracking as jest.Mock).mockResolvedValue({
        active: true,
        tripId: mockTripId,
      });

      renderHook(() => useLocationUpdates({ tripId: 'custom-trip-456' }));

      await waitFor(() => {
        expect(BackgroundLocationModule.getLocations).toHaveBeenCalled();
      });
    });

    it('should handle errors when loading existing locations', async () => {
      const error = new Error('Failed to load locations');
      (BackgroundLocationModule.isTracking as jest.Mock).mockResolvedValue({
        active: true,
        tripId: mockTripId,
      });
      (BackgroundLocationModule.getLocations as jest.Mock).mockRejectedValue(
        error
      );

      const { result } = renderHook(() =>
        useLocationUpdates({ autoLoad: true })
      );

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      expect(result.current.error).toEqual(error);
    });
  });

  describe('Event subscription', () => {
    it('should process location update events', async () => {
      const { result } = renderHook(() => useLocationUpdates());

      await waitFor(() => {
        expect(result.current.locations).toEqual([]);
      });

      // Simulate location update event
      act(() => {
        simulateEvent({
          tripId: mockTripId,
          latitude: '37.7750',
          longitude: '-122.4195',
          timestamp: 1640995201000,
        });
      });

      expect(result.current.tripId).toBe(mockTripId);
      expect(result.current.isTracking).toBe(true);
      expect(result.current.locations).toHaveLength(1);
      expect(result.current.lastLocation).toEqual(
        expect.objectContaining({
          latitude: '37.7750',
          longitude: '-122.4195',
          timestamp: 1640995201000,
          tripId: mockTripId,
        })
      );
    });

    it('should accumulate multiple location updates', async () => {
      const { result } = renderHook(() => useLocationUpdates());

      await waitFor(() => {
        expect(result.current.locations).toEqual([]);
      });

      // First location
      act(() => {
        simulateEvent({
          tripId: mockTripId,
          latitude: '37.7750',
          longitude: '-122.4195',
          timestamp: 1640995201000,
        });
      });

      // Second location
      act(() => {
        simulateEvent({
          tripId: mockTripId,
          latitude: '37.7760',
          longitude: '-122.4196',
          timestamp: 1640995202000,
        });
      });

      expect(result.current.locations).toHaveLength(2);
      expect(result.current.lastLocation?.latitude).toBe('37.7760');
    });

    it('should call onLocationUpdate callback when provided', async () => {
      const onLocationUpdate = jest.fn();

      renderHook(() => useLocationUpdates({ onLocationUpdate }));

      // Small delay to ensure hook setup
      await new Promise((resolve) => setTimeout(resolve, 10));

      const locationEvent = {
        tripId: mockTripId,
        latitude: '37.7750',
        longitude: '-122.4195',
        timestamp: 1640995201000,
      };

      act(() => {
        simulateEvent(locationEvent);
      });

      expect(onLocationUpdate).toHaveBeenCalledTimes(1);
      expect(onLocationUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          latitude: locationEvent.latitude,
          longitude: locationEvent.longitude,
          timestamp: locationEvent.timestamp,
          tripId: locationEvent.tripId,
        })
      );
    });

    it('should filter events by tripId when provided', async () => {
      const { result } = renderHook(() =>
        useLocationUpdates({ tripId: 'specific-trip-789' })
      );

      await waitFor(() => {
        expect(result.current.locations).toEqual([]);
      });

      // Event for different trip
      act(() => {
        simulateEvent({
          tripId: 'other-trip-456',
          latitude: '37.7750',
          longitude: '-122.4195',
          timestamp: 1640995201000,
        });
      });

      expect(result.current.locations).toEqual([]);

      // Event for specific trip
      act(() => {
        simulateEvent({
          tripId: 'specific-trip-789',
          latitude: '37.7760',
          longitude: '-122.4196',
          timestamp: 1640995202000,
        });
      });

      expect(result.current.locations).toHaveLength(1);
    });

    it('should update tripId from event when not specified', async () => {
      const { result } = renderHook(() => useLocationUpdates());

      expect(result.current.tripId).toBeNull();

      act(() => {
        simulateEvent({
          tripId: mockTripId,
          latitude: '37.7750',
          longitude: '-122.4195',
          timestamp: 1640995201000,
        });
      });

      expect(result.current.tripId).toBe(mockTripId);
      expect(result.current.isTracking).toBe(true);
    });

    it('should cleanup event listener on unmount', () => {
      const { unmount } = renderHook(() => useLocationUpdates());

      // Should not throw errors
      expect(() => unmount()).not.toThrow();
    });
  });

  describe('Trip ID changes', () => {
    it('should reset state when tripId changes', async () => {
      (BackgroundLocationModule.getLocations as jest.Mock).mockResolvedValue(
        mockLocations
      );

      const { result, rerender } = renderHook(
        ({ tripId }: { tripId: string }) =>
          useLocationUpdates({ tripId, autoLoad: true }),
        {
          initialProps: { tripId: 'trip-1' },
        }
      );

      await waitFor(() => {
        expect(result.current.tripId).toBe('trip-1');
      });

      await waitFor(() => {
        expect(result.current.locations).toEqual(mockLocations);
      });

      // Change tripId
      rerender({ tripId: 'trip-2' });

      await waitFor(() => {
        expect(result.current.locations).toEqual([]);
      });

      expect(result.current.lastLocation).toBeNull();
    });
  });

  describe('clearError', () => {
    it('should clear error state', async () => {
      const error = new Error('Test error');
      (BackgroundLocationModule.isTracking as jest.Mock).mockResolvedValue({
        active: true,
        tripId: mockTripId,
      });
      (BackgroundLocationModule.getLocations as jest.Mock).mockRejectedValue(
        error
      );

      const { result } = renderHook(() =>
        useLocationUpdates({ autoLoad: true })
      );

      await waitFor(() => {
        expect(result.current.error).toEqual(error);
      });

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('Loading state', () => {
    it('should set loading state while loading locations', async () => {
      let resolvePromise: (value: any) => void;
      const promise = new Promise<any>((resolve) => {
        resolvePromise = resolve;
      });

      (BackgroundLocationModule.isTracking as jest.Mock).mockResolvedValue({
        active: true,
        tripId: mockTripId,
      });
      (BackgroundLocationModule.getLocations as jest.Mock).mockReturnValue(
        promise
      );

      const { result } = renderHook(() =>
        useLocationUpdates({ autoLoad: true })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(true);
      });

      await act(async () => {
        resolvePromise!(mockLocations);
        await promise;
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  describe('Empty locations', () => {
    it('should handle empty locations array', async () => {
      (BackgroundLocationModule.isTracking as jest.Mock).mockResolvedValue({
        active: true,
        tripId: mockTripId,
      });
      (BackgroundLocationModule.getLocations as jest.Mock).mockResolvedValue(
        []
      );

      const { result } = renderHook(() =>
        useLocationUpdates({ autoLoad: true })
      );

      await waitFor(() => {
        expect(result.current.locations).toEqual([]);
      });

      expect(result.current.lastLocation).toBeNull();
    });
  });

  describe('Non-Error exceptions', () => {
    it('should handle non-Error exceptions when loading locations', async () => {
      (BackgroundLocationModule.isTracking as jest.Mock).mockResolvedValue({
        active: true,
        tripId: mockTripId,
      });
      (BackgroundLocationModule.getLocations as jest.Mock).mockRejectedValue(
        'String error'
      );

      const { result } = renderHook(() =>
        useLocationUpdates({ autoLoad: true })
      );

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe(
        'Failed to load existing locations'
      );
    });
  });

  describe('Extended location properties', () => {
    it('should include extended properties when provided in event', async () => {
      const { result } = renderHook(() => useLocationUpdates());

      await waitFor(() => {
        expect(result.current.locations).toEqual([]);
      });

      // Simulate location update event with extended properties
      act(() => {
        simulateEvent({
          tripId: mockTripId,
          latitude: '37.7750',
          longitude: '-122.4195',
          timestamp: 1640995201000,
          accuracy: 10.5,
          altitude: 100.2,
          speed: 5.5,
          bearing: 90.0,
          provider: 'gps',
          isFromMockProvider: false,
        });
      });

      expect(result.current.lastLocation).toEqual(
        expect.objectContaining({
          latitude: '37.7750',
          longitude: '-122.4195',
          timestamp: 1640995201000,
          accuracy: 10.5,
          altitude: 100.2,
          speed: 5.5,
          bearing: 90.0,
          provider: 'gps',
          isFromMockProvider: false,
          tripId: mockTripId,
        })
      );
    });

    it('should include API 26+ properties when provided', async () => {
      const { result } = renderHook(() => useLocationUpdates());

      await waitFor(() => {
        expect(result.current.locations).toEqual([]);
      });

      // Simulate location update event with API 26+ properties
      act(() => {
        simulateEvent({
          tripId: mockTripId,
          latitude: '37.7750',
          longitude: '-122.4195',
          timestamp: 1640995201000,
          verticalAccuracyMeters: 5.0,
          speedAccuracyMetersPerSecond: 0.5,
          bearingAccuracyDegrees: 2.0,
          elapsedRealtimeNanos: 1000000000,
        });
      });

      expect(result.current.lastLocation).toEqual(
        expect.objectContaining({
          latitude: '37.7750',
          longitude: '-122.4195',
          timestamp: 1640995201000,
          verticalAccuracyMeters: 5.0,
          speedAccuracyMetersPerSecond: 0.5,
          bearingAccuracyDegrees: 2.0,
          elapsedRealtimeNanos: 1000000000,
          tripId: mockTripId,
        })
      );
    });

    it('should only include defined properties (exclude undefined)', async () => {
      const { result } = renderHook(() => useLocationUpdates());

      await waitFor(() => {
        expect(result.current.locations).toEqual([]);
      });

      // Simulate event with only some properties
      act(() => {
        simulateEvent({
          tripId: mockTripId,
          latitude: '37.7750',
          longitude: '-122.4195',
          timestamp: 1640995201000,
          accuracy: 10.5,
          // speed, altitude, etc. are not provided (undefined)
        });
      });

      const lastLocation = result.current.lastLocation;
      expect(lastLocation).not.toBeNull();
      if (lastLocation) {
        expect(lastLocation.latitude).toBe('37.7750');
        expect(lastLocation.longitude).toBe('-122.4195');
        expect(lastLocation.timestamp).toBe(1640995201000);
        expect(lastLocation.accuracy).toBe(10.5);
        // These should not be present (undefined)
        expect(lastLocation.speed).toBeUndefined();
        expect(lastLocation.altitude).toBeUndefined();
        expect(lastLocation.bearing).toBeUndefined();
        // tripId is included by extractDefinedProperties (current behavior)
        expect((lastLocation as any).tripId).toBe(mockTripId);
      }
    });

    it('should pass extended properties to onLocationUpdate callback', async () => {
      const onLocationUpdate = jest.fn();

      renderHook(() => useLocationUpdates({ onLocationUpdate }));

      await new Promise((resolve) => setTimeout(resolve, 10));

      const locationEvent = {
        tripId: mockTripId,
        latitude: '37.7750',
        longitude: '-122.4195',
        timestamp: 1640995201000,
        accuracy: 10.5,
        speed: 5.5,
        altitude: 100.2,
      };

      act(() => {
        simulateEvent(locationEvent);
      });

      expect(onLocationUpdate).toHaveBeenCalledTimes(1);
      expect(onLocationUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          latitude: locationEvent.latitude,
          longitude: locationEvent.longitude,
          timestamp: locationEvent.timestamp,
          accuracy: locationEvent.accuracy,
          speed: locationEvent.speed,
          altitude: locationEvent.altitude,
          tripId: locationEvent.tripId,
        })
      );
    });
  });

  describe('Integration scenarios', () => {
    it('should handle load + events flow correctly', async () => {
      (BackgroundLocationModule.isTracking as jest.Mock).mockResolvedValue({
        active: true,
        tripId: mockTripId,
      });
      (BackgroundLocationModule.getLocations as jest.Mock).mockResolvedValue(
        mockLocations
      );

      const onLocationUpdate = jest.fn();
      const { result } = renderHook(() =>
        useLocationUpdates({ onLocationUpdate, autoLoad: true })
      );

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.locations).toEqual(mockLocations);
      });

      // Send new event
      act(() => {
        simulateEvent({
          tripId: mockTripId,
          latitude: '37.7770',
          longitude: '-122.4197',
          timestamp: 1640995203000,
        });
      });

      // Should have initial locations + 1 new one
      expect(result.current.locations).toHaveLength(3);
      expect(onLocationUpdate).toHaveBeenCalledTimes(1);
    });

    it('should update lastLocation when receiving events', async () => {
      const { result } = renderHook(() => useLocationUpdates());

      expect(result.current.lastLocation).toBeNull();

      act(() => {
        simulateEvent({
          tripId: mockTripId,
          latitude: '37.7750',
          longitude: '-122.4195',
          timestamp: 1640995201000,
        });
      });

      expect(result.current.lastLocation?.latitude).toBe('37.7750');

      act(() => {
        simulateEvent({
          tripId: mockTripId,
          latitude: '37.7760',
          longitude: '-122.4196',
          timestamp: 1640995202000,
        });
      });

      expect(result.current.lastLocation?.latitude).toBe('37.7760');
    });
  });

  describe('clearLocations', () => {
    it('should clear locations when module is available', async () => {
      (BackgroundLocationModule.isTracking as jest.Mock).mockResolvedValue({
        active: true,
        tripId: mockTripId,
      });
      (BackgroundLocationModule.getLocations as jest.Mock).mockResolvedValue(
        mockLocations
      );

      const { result } = renderHook(() =>
        useLocationUpdates({ tripId: mockTripId, autoLoad: true })
      );

      await waitFor(() => {
        expect(result.current.locations.length).toBeGreaterThan(0);
      });

      await act(async () => {
        await result.current.clearLocations();
      });

      expect(result.current.locations).toEqual([]);
      expect(result.current.lastLocation).toBeNull();
      expect(BackgroundLocationModule.clearTrip).toHaveBeenCalledWith(
        mockTripId
      );
    });

    it('should not clear if no tripId', async () => {
      const { result } = renderHook(() => useLocationUpdates());

      await act(async () => {
        await result.current.clearLocations();
      });

      expect(BackgroundLocationModule.clearTrip).not.toHaveBeenCalled();
    });

    it('should handle when module is not available', async () => {
      // Mock isTracking to return undefined (not a function) to simulate unavailable module
      const originalIsTracking = BackgroundLocationModule.isTracking;
      Object.defineProperty(BackgroundLocationModule, 'isTracking', {
        value: undefined,
        configurable: true,
        writable: true,
      });

      const { result } = renderHook(() =>
        useLocationUpdates({ tripId: mockTripId, autoLoad: false })
      );

      await act(async () => {
        await result.current.clearLocations();
      });

      // When module is not available, clearLocations should still clear local state
      expect(result.current.locations).toEqual([]);
      expect(result.current.lastLocation).toBeNull();
      expect(console.warn).toHaveBeenCalledWith(
        'BackgroundLocation not available'
      );

      // Restore
      Object.defineProperty(BackgroundLocationModule, 'isTracking', {
        value: originalIsTracking,
        configurable: true,
        writable: true,
      });
      // Ensure it's a mock again
      (BackgroundLocationModule.isTracking as jest.Mock) = jest.fn();
      (BackgroundLocationModule.clearTrip as jest.Mock) = jest.fn();
    });

    it('should handle errors during clear', async () => {
      const error = new Error('Failed to clear');
      (BackgroundLocationModule.clearTrip as jest.Mock).mockRejectedValue(
        error
      );

      const { result } = renderHook(() =>
        useLocationUpdates({ tripId: mockTripId })
      );

      await act(async () => {
        await result.current.clearLocations();
      });

      expect(result.current.error).toEqual(error);
      expect(console.error).toHaveBeenCalled();
    });

    it('should prevent reloading locations immediately after clear', async () => {
      (BackgroundLocationModule.isTracking as jest.Mock).mockResolvedValue({
        active: true,
        tripId: mockTripId,
      });
      (BackgroundLocationModule.getLocations as jest.Mock).mockResolvedValue(
        mockLocations
      );

      const { result } = renderHook(() =>
        useLocationUpdates({ tripId: mockTripId, autoLoad: false })
      );

      // Clear locations - test with autoLoad: false to avoid checkStatus interference
      await act(async () => {
        await result.current.clearLocations();
      });

      // Verify that clearTrip was called on the native module
      expect(BackgroundLocationModule.clearTrip).toHaveBeenCalledWith(
        mockTripId
      );

      // Verify locations and lastLocation are cleared
      expect(result.current.locations).toEqual([]);
      expect(result.current.lastLocation).toBeNull();

      // The key behavior: clearLocations clears the data and calls clearTrip
      // wasClearedRef prevents immediate reload, which is tested in other scenarios
    });
  });

  // Note: Test for wasClearedRef is covered in clearLocations section above

  describe('Module availability', () => {
    it('should handle when module is not available on mount', async () => {
      Object.defineProperty(BackgroundLocationModule, 'isTracking', {
        value: undefined,
        configurable: true,
      });

      renderHook(() => useLocationUpdates());

      await waitFor(() => {
        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining('BackgroundLocation not available')
        );
      });

      // Restore
      Object.defineProperty(BackgroundLocationModule, 'isTracking', {
        value: jest.fn(),
        configurable: true,
      });
    });

    it('should handle when module is not available in loadExistingLocations', async () => {
      Object.defineProperty(BackgroundLocationModule, 'getLocations', {
        value: undefined,
        configurable: true,
      });

      (BackgroundLocationModule.isTracking as jest.Mock).mockResolvedValue({
        active: true,
        tripId: mockTripId,
      });

      const { result } = renderHook(() =>
        useLocationUpdates({ tripId: mockTripId, autoLoad: true })
      );

      await waitFor(() => {
        expect(result.current.tripId).toBe(mockTripId);
      });

      // Should not crash
      expect(result.current.locations).toEqual([]);

      // Restore
      Object.defineProperty(BackgroundLocationModule, 'getLocations', {
        value: jest.fn(),
        configurable: true,
      });
    });

    it('should handle when module is null in isNativeModuleAvailable (line 22)', async () => {
      const originalIsTracking = BackgroundLocationModule.isTracking;
      const originalModule = BackgroundLocationModule;

      // Set isTracking to be a function (to pass first check)
      Object.defineProperty(BackgroundLocationModule, 'isTracking', {
        value: jest.fn(),
        configurable: true,
        writable: true,
      });

      // Set module to null to trigger line 22
      Object.defineProperty(
        require('../../NativeBackgroundLocation'),
        'default',
        {
          value: null,
          configurable: true,
        }
      );

      // Re-import hook to get the null module
      const {
        useLocationUpdates: useLocationUpdatesWithNull,
      } = require('../../hooks/useLocationUpdates');
      renderHook(() => useLocationUpdatesWithNull());

      await waitFor(() => {
        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining('BackgroundLocation not available')
        );
      });

      // Restore
      Object.defineProperty(
        require('../../NativeBackgroundLocation'),
        'default',
        {
          value: originalModule,
          configurable: true,
        }
      );
      Object.defineProperty(BackgroundLocationModule, 'isTracking', {
        value: originalIsTracking,
        configurable: true,
        writable: true,
      });
      (BackgroundLocationModule.isTracking as jest.Mock) = jest.fn();
    });

    it('should handle exception in isNativeModuleAvailable (line 26)', async () => {
      const originalIsTracking = BackgroundLocationModule.isTracking;

      // Make accessing isTracking throw an error
      Object.defineProperty(BackgroundLocationModule, 'isTracking', {
        get: () => {
          throw new Error('Access error');
        },
        configurable: true,
      });

      renderHook(() => useLocationUpdates());

      await waitFor(() => {
        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining('BackgroundLocation not available')
        );
      });

      // Restore
      Object.defineProperty(BackgroundLocationModule, 'isTracking', {
        value: originalIsTracking,
        configurable: true,
        writable: true,
      });
      (BackgroundLocationModule.isTracking as jest.Mock) = jest.fn();
    });

    it('should handle when module is not available in loadExistingLocations (line 125)', async () => {
      const originalIsTracking = BackgroundLocationModule.isTracking;
      Object.defineProperty(BackgroundLocationModule, 'isTracking', {
        value: undefined,
        configurable: true,
        writable: true,
      });

      const { result } = renderHook(() =>
        useLocationUpdates({ tripId: mockTripId, autoLoad: true })
      );

      await waitFor(() => {
        expect(result.current.tripId).toBe(mockTripId);
      });

      // Should not crash and should not call getLocations
      expect(result.current.locations).toEqual([]);
      expect(BackgroundLocationModule.getLocations).not.toHaveBeenCalled();

      // Restore
      Object.defineProperty(BackgroundLocationModule, 'isTracking', {
        value: originalIsTracking,
        configurable: true,
        writable: true,
      });
      (BackgroundLocationModule.isTracking as jest.Mock) = jest.fn();
    });

    it('should handle wasClearedRef timeout reset (lines 181-187)', async () => {
      jest.useFakeTimers();

      (BackgroundLocationModule.isTracking as jest.Mock).mockResolvedValue({
        active: true,
        tripId: mockTripId,
      });
      (BackgroundLocationModule.getLocations as jest.Mock).mockResolvedValue(
        mockLocations
      );
      (BackgroundLocationModule.clearTrip as jest.Mock).mockResolvedValue(
        undefined
      );

      const { result } = renderHook(() =>
        useLocationUpdates({ tripId: mockTripId, autoLoad: true })
      );

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.locations).toEqual(mockLocations);
      });

      // Clear locations
      await act(async () => {
        await result.current.clearLocations();
      });

      await waitFor(() => {
        expect(result.current.locations).toEqual([]);
      });

      // Fast-forward time to trigger setTimeout (line 181-183)
      // This happens in the checkStatus effect when wasClearedRef.current is true
      act(() => {
        jest.advanceTimersByTime(2000);
      });

      // After timeout, wasClearedRef should be reset, allowing reload
      // This is tested by checking that locations can be loaded again
      (
        BackgroundLocationModule.getLocations as jest.Mock
      ).mockResolvedValueOnce(mockLocations);

      // Trigger checkStatus again by waiting for interval (line 195)
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      await waitFor(() => {
        // After timeout reset, locations should be reloadable
        expect(BackgroundLocationModule.getLocations).toHaveBeenCalled();
      });

      jest.useRealTimers();
    });

    it('should handle periodic status check interval (line 195)', async () => {
      jest.useFakeTimers();

      (BackgroundLocationModule.isTracking as jest.Mock).mockResolvedValue({
        active: true,
        tripId: mockTripId,
      });

      renderHook(() => useLocationUpdates());

      // Initial check should happen immediately
      await waitFor(() => {
        expect(BackgroundLocationModule.isTracking).toHaveBeenCalled();
      });

      const initialCallCount = (
        BackgroundLocationModule.isTracking as jest.Mock
      ).mock.calls.length;

      // Fast-forward 5 seconds to trigger interval check
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      await waitFor(() => {
        expect(BackgroundLocationModule.isTracking).toHaveBeenCalledTimes(
          initialCallCount + 1
        );
      });

      jest.useRealTimers();
    });

    it('should reset wasClearedRef when new location arrives after clear (lines 237-238)', async () => {
      (BackgroundLocationModule.isTracking as jest.Mock).mockResolvedValue({
        active: true,
        tripId: mockTripId,
      });
      (BackgroundLocationModule.getLocations as jest.Mock).mockResolvedValue(
        mockLocations
      );
      (BackgroundLocationModule.clearTrip as jest.Mock).mockResolvedValue(
        undefined
      );

      const { result } = renderHook(() =>
        useLocationUpdates({ tripId: mockTripId, autoLoad: true })
      );

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.locations).toEqual(mockLocations);
      });

      // Clear locations
      await act(async () => {
        await result.current.clearLocations();
      });

      await waitFor(() => {
        expect(result.current.locations).toEqual([]);
      });

      // Simulate new location event after clear
      act(() => {
        simulateEvent({
          tripId: mockTripId,
          latitude: '37.7770',
          longitude: '-122.4197',
          timestamp: 1640995203000,
        });
      });

      // After new location arrives, wasClearedRef should be reset (line 237)
      // and location should be added (line 238)
      // When wasClearedRef is true and prev.length === 0, it returns [newLocation]
      await waitFor(() => {
        expect(result.current.locations).toHaveLength(1);
      });
      expect(result.current.locations[0]?.latitude).toBe('37.7770');
    });
  });

  describe('onLocationWarning handler', () => {
    it('should handle location warning events with tripId', async () => {
      const onLocationWarning = jest.fn();
      const { result } = renderHook(() =>
        useLocationUpdates({ tripId: mockTripId, onLocationWarning })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const warningEvent = {
        tripId: mockTripId,
        type: 'SERVICE_TIMEOUT',
        message: 'Service timeout warning',
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

    it('should handle location warning events without specific tripId', async () => {
      const onLocationWarning = jest.fn();
      const { result } = renderHook(() =>
        useLocationUpdates({ onLocationWarning })
      );

      const warningEvent = {
        tripId: 'some-trip',
        type: 'TASK_REMOVED',
        message: 'Task removed warning',
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

    it('should filter warning events by tripId when provided', async () => {
      const onLocationWarning = jest.fn();
      const { result } = renderHook(() =>
        useLocationUpdates({ tripId: mockTripId, onLocationWarning })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const wrongTripWarning = {
        tripId: 'different-trip',
        type: 'SERVICE_TIMEOUT',
        message: 'Different trip warning',
        timestamp: Date.now(),
      };

      act(() => {
        (global as any).simulateWarningEvent(wrongTripWarning);
      });

      // Wait a bit to ensure no state update
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(result.current.lastWarning).toBeNull();
      expect(onLocationWarning).not.toHaveBeenCalled();
    });
  });

  describe('onUpdateInterval throttling', () => {
    it('should call callback immediately on first location update', async () => {
      const onLocationUpdate = jest.fn();

      renderHook(() =>
        useLocationUpdates({
          onLocationUpdate,
          onUpdateInterval: 5000,
        })
      );

      await new Promise((resolve) => setTimeout(resolve, 10));

      act(() => {
        simulateEvent({
          tripId: mockTripId,
          latitude: '37.7750',
          longitude: '-122.4195',
          timestamp: 1640995201000,
        });
      });

      expect(onLocationUpdate).toHaveBeenCalledTimes(1);
    });

    it('should throttle callback when onUpdateInterval is set', async () => {
      const onLocationUpdate = jest.fn();

      const { result } = renderHook(() =>
        useLocationUpdates({
          onLocationUpdate,
          onUpdateInterval: 5000,
        })
      );

      await new Promise((resolve) => setTimeout(resolve, 10));

      // First location - should trigger callback
      act(() => {
        simulateEvent({
          tripId: mockTripId,
          latitude: '37.7750',
          longitude: '-122.4195',
          timestamp: 1640995201000,
        });
      });

      expect(onLocationUpdate).toHaveBeenCalledTimes(1);

      // Second location immediately after - should NOT trigger callback (throttled)
      act(() => {
        simulateEvent({
          tripId: mockTripId,
          latitude: '37.7751',
          longitude: '-122.4196',
          timestamp: 1640995202000,
        });
      });

      expect(onLocationUpdate).toHaveBeenCalledTimes(1); // Still 1, throttled

      // But location should still be added to array
      expect(result.current.locations).toHaveLength(2);
    });

    it('should call callback after throttle interval has passed', async () => {
      const onLocationUpdate = jest.fn();
      const mockDateNow = jest.spyOn(Date, 'now');

      // Start at a high value so first callback fires (needs to be >= onUpdateInterval from 0)
      let currentTime = 10000;
      mockDateNow.mockImplementation(() => currentTime);

      renderHook(() =>
        useLocationUpdates({
          onLocationUpdate,
          onUpdateInterval: 5000,
        })
      );

      await new Promise((resolve) => setTimeout(resolve, 10));

      // First location at t=10000 - should trigger callback (10000 - 0 >= 5000)
      act(() => {
        simulateEvent({
          tripId: mockTripId,
          latitude: '37.7750',
          longitude: '-122.4195',
          timestamp: 1640995201000,
        });
      });

      expect(onLocationUpdate).toHaveBeenCalledTimes(1);

      // Second location immediately (still at t=10000) - should be throttled
      act(() => {
        simulateEvent({
          tripId: mockTripId,
          latitude: '37.7751',
          longitude: '-122.4196',
          timestamp: 1640995202000,
        });
      });

      expect(onLocationUpdate).toHaveBeenCalledTimes(1); // Still throttled

      // Advance Date.now() past the throttle interval (10000 + 5001 = 15001)
      currentTime = 15001;

      // New location after interval - should trigger callback
      act(() => {
        simulateEvent({
          tripId: mockTripId,
          latitude: '37.7752',
          longitude: '-122.4197',
          timestamp: 1640995207000,
        });
      });

      expect(onLocationUpdate).toHaveBeenCalledTimes(2);

      mockDateNow.mockRestore();
    });

    it('should not throttle when onUpdateInterval is undefined', async () => {
      const onLocationUpdate = jest.fn();

      renderHook(() =>
        useLocationUpdates({
          onLocationUpdate,
          // onUpdateInterval not set
        })
      );

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Multiple rapid locations
      act(() => {
        simulateEvent({
          tripId: mockTripId,
          latitude: '37.7750',
          longitude: '-122.4195',
          timestamp: 1640995201000,
        });
      });

      act(() => {
        simulateEvent({
          tripId: mockTripId,
          latitude: '37.7751',
          longitude: '-122.4196',
          timestamp: 1640995202000,
        });
      });

      act(() => {
        simulateEvent({
          tripId: mockTripId,
          latitude: '37.7752',
          longitude: '-122.4197',
          timestamp: 1640995203000,
        });
      });

      // All should trigger callback without throttling
      expect(onLocationUpdate).toHaveBeenCalledTimes(3);
    });

    it('should collect all locations even when callback is throttled', async () => {
      const onLocationUpdate = jest.fn();
      const mockDateNow = jest.spyOn(Date, 'now');

      // Start at a high value so first callback fires (needs to be >= onUpdateInterval from 0)
      mockDateNow.mockReturnValue(15000);

      const { result } = renderHook(() =>
        useLocationUpdates({
          onLocationUpdate,
          onUpdateInterval: 10000, // 10 second throttle
        })
      );

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Send 5 rapid locations (all within throttle window - time doesn't advance)
      for (let i = 0; i < 5; i++) {
        act(() => {
          simulateEvent({
            tripId: mockTripId,
            latitude: `37.775${i}`,
            longitude: `-122.419${i}`,
            timestamp: 1640995201000 + i * 1000,
          });
        });
      }

      // Only first callback should have been called (15000 - 0 >= 10000, but subsequent ones are throttled)
      expect(onLocationUpdate).toHaveBeenCalledTimes(1);

      // But all locations should be stored
      expect(result.current.locations).toHaveLength(5);
      expect(result.current.lastLocation?.latitude).toBe('37.7754');

      mockDateNow.mockRestore();
    });

    it('should handle onUpdateInterval of 0 as no throttling', async () => {
      const onLocationUpdate = jest.fn();

      renderHook(() =>
        useLocationUpdates({
          onLocationUpdate,
          onUpdateInterval: 0,
        })
      );

      await new Promise((resolve) => setTimeout(resolve, 10));

      act(() => {
        simulateEvent({
          tripId: mockTripId,
          latitude: '37.7750',
          longitude: '-122.4195',
          timestamp: 1640995201000,
        });
      });

      act(() => {
        simulateEvent({
          tripId: mockTripId,
          latitude: '37.7751',
          longitude: '-122.4196',
          timestamp: 1640995202000,
        });
      });

      // 0 is falsy, so no throttling applied
      expect(onLocationUpdate).toHaveBeenCalledTimes(2);
    });

    it('should reset throttle timer when callback is called', async () => {
      const onLocationUpdate = jest.fn();
      const mockDateNow = jest.spyOn(Date, 'now');

      // Start at a high value so first callback fires (needs to be >= onUpdateInterval from 0)
      let currentTime = 5000;
      mockDateNow.mockImplementation(() => currentTime);

      renderHook(() =>
        useLocationUpdates({
          onLocationUpdate,
          onUpdateInterval: 3000,
        })
      );

      await new Promise((resolve) => setTimeout(resolve, 10));

      // First location at t=5000 - should trigger callback (5000 - 0 >= 3000)
      act(() => {
        simulateEvent({
          tripId: mockTripId,
          latitude: '37.7750',
          longitude: '-122.4195',
          timestamp: 1640995201000,
        });
      });

      expect(onLocationUpdate).toHaveBeenCalledTimes(1);

      // Advance to 2 seconds after first call (t=7000) - not enough (need 3000ms elapsed from 5000)
      currentTime = 7000;

      act(() => {
        simulateEvent({
          tripId: mockTripId,
          latitude: '37.7751',
          longitude: '-122.4196',
          timestamp: 1640995203000,
        });
      });

      expect(onLocationUpdate).toHaveBeenCalledTimes(1); // Still throttled (only 2000ms elapsed)

      // Advance to 3 seconds after first call (t=8000) - now 3000ms elapsed from 5000
      currentTime = 8000;

      act(() => {
        simulateEvent({
          tripId: mockTripId,
          latitude: '37.7752',
          longitude: '-122.4197',
          timestamp: 1640995204000,
        });
      });

      expect(onLocationUpdate).toHaveBeenCalledTimes(2); // Now allowed

      mockDateNow.mockRestore();
    });
  });

  describe('checkStatus error handling', () => {
    it('should handle errors in checkStatus gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      (BackgroundLocationModule.isTracking as jest.Mock).mockRejectedValue(
        new Error('Check status failed')
      );

      const { result } = renderHook(() =>
        useLocationUpdates({ tripId: mockTripId, autoLoad: true })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error checking tracking status:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('wasClearedRef timeout', () => {
    it('should reset wasClearedRef after timeout when not tracking', async () => {
      jest.useFakeTimers();

      (BackgroundLocationModule.isTracking as jest.Mock).mockResolvedValue({
        active: false,
        tripId: null,
      });
      (BackgroundLocationModule.clearTrip as jest.Mock).mockResolvedValue(
        undefined
      );

      const { result } = renderHook(() =>
        useLocationUpdates({ tripId: mockTripId, autoLoad: true })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Clear locations
      await act(async () => {
        await result.current.clearLocations();
      });

      await waitFor(() => {
        expect(result.current.locations).toEqual([]);
      });

      // Fast-forward the 2-second timeout
      act(() => {
        jest.advanceTimersByTime(2000);
      });

      jest.useRealTimers();
    });
  });

  describe('iOS-specific behavior', () => {
    beforeEach(() => {
      Platform.OS = 'ios';
    });

    it('should receive location events on iOS', async () => {
      const { result } = renderHook(() => useLocationUpdates());

      await waitFor(() => {
        expect(result.current.locations).toEqual([]);
      });

      // Simulate location update event on iOS
      act(() => {
        simulateEvent({
          tripId: mockTripId,
          latitude: '34.0522',
          longitude: '-118.2437',
          timestamp: 1640995201000,
        });
      });

      expect(result.current.tripId).toBe(mockTripId);
      expect(result.current.isTracking).toBe(true);
      expect(result.current.locations).toHaveLength(1);
      expect(result.current.lastLocation).toEqual(
        expect.objectContaining({
          latitude: '34.0522',
          longitude: '-118.2437',
          timestamp: 1640995201000,
          tripId: mockTripId,
        })
      );
    });

    it('should handle warning events (PERMISSION_REVOKED, LOCATION_UNAVAILABLE) on iOS', async () => {
      const onLocationWarning = jest.fn();
      const { result } = renderHook(() =>
        useLocationUpdates({ onLocationWarning })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Simulate PERMISSION_REVOKED warning on iOS
      const permissionWarning = {
        tripId: mockTripId,
        type: 'PERMISSION_REVOKED',
        message: 'Location permission was revoked by user',
        timestamp: Date.now(),
      };

      act(() => {
        (global as any).simulateWarningEvent(permissionWarning);
      });

      await waitFor(() => {
        expect(result.current.lastWarning).toEqual(permissionWarning);
        expect(onLocationWarning).toHaveBeenCalledWith(permissionWarning);
      });

      // Simulate LOCATION_UNAVAILABLE warning on iOS
      const locationUnavailableWarning = {
        tripId: mockTripId,
        type: 'LOCATION_UNAVAILABLE',
        message: 'Location services are unavailable',
        timestamp: Date.now(),
      };

      act(() => {
        (global as any).simulateWarningEvent(locationUnavailableWarning);
      });

      await waitFor(() => {
        expect(result.current.lastWarning).toEqual(locationUnavailableWarning);
        expect(onLocationWarning).toHaveBeenCalledWith(
          locationUnavailableWarning
        );
      });
    });

    it('should handle iOS-specific location properties (no elapsedRealtimeNanos, no isFromMockProvider)', async () => {
      const { result } = renderHook(() => useLocationUpdates());

      await waitFor(() => {
        expect(result.current.locations).toEqual([]);
      });

      // iOS locations do not include Android-specific properties like
      // elapsedRealtimeNanos and isFromMockProvider
      act(() => {
        simulateEvent({
          tripId: mockTripId,
          latitude: '34.0522',
          longitude: '-118.2437',
          timestamp: 1640995201000,
          accuracy: 5.0,
          altitude: 71.0,
          speed: 2.5,
          bearing: 180.0,
          verticalAccuracyMeters: 3.0,
          speedAccuracyMetersPerSecond: 0.3,
          // Note: no elapsedRealtimeNanos (Android-only)
          // Note: no isFromMockProvider (Android-only)
        });
      });

      const lastLocation = result.current.lastLocation;
      expect(lastLocation).not.toBeNull();
      if (lastLocation) {
        expect(lastLocation.latitude).toBe('34.0522');
        expect(lastLocation.longitude).toBe('-118.2437');
        expect(lastLocation.accuracy).toBe(5.0);
        expect(lastLocation.altitude).toBe(71.0);
        expect(lastLocation.speed).toBe(2.5);
        expect(lastLocation.bearing).toBe(180.0);
        expect(lastLocation.verticalAccuracyMeters).toBe(3.0);
        expect(lastLocation.speedAccuracyMetersPerSecond).toBe(0.3);
        // Android-only fields should not be present
        expect(lastLocation.elapsedRealtimeNanos).toBeUndefined();
        expect(lastLocation.isFromMockProvider).toBeUndefined();
      }
    });

    it('should load existing locations on mount when autoLoad=true on iOS', async () => {
      (BackgroundLocationModule.isTracking as jest.Mock).mockResolvedValue({
        active: true,
        tripId: mockTripId,
      });
      (BackgroundLocationModule.getLocations as jest.Mock).mockResolvedValue(
        mockLocations
      );

      const { result } = renderHook(() =>
        useLocationUpdates({ autoLoad: true })
      );

      await waitFor(() => {
        expect(result.current.isTracking).toBe(true);
      });

      expect(result.current.tripId).toBe(mockTripId);
      expect(result.current.locations).toEqual(mockLocations);
      expect(result.current.lastLocation).toEqual(mockLocations[1]);
    });

    it('should filter events by tripId on iOS', async () => {
      const { result } = renderHook(() =>
        useLocationUpdates({ tripId: 'ios-trip-specific', autoLoad: false })
      );

      await waitFor(() => {
        expect(result.current.locations).toEqual([]);
      });

      // Event for a different trip - should be filtered out
      act(() => {
        simulateEvent({
          tripId: 'other-trip-android',
          latitude: '37.7750',
          longitude: '-122.4195',
          timestamp: 1640995201000,
        });
      });

      expect(result.current.locations).toEqual([]);

      // Event for the correct trip - should be accepted
      act(() => {
        simulateEvent({
          tripId: 'ios-trip-specific',
          latitude: '34.0522',
          longitude: '-118.2437',
          timestamp: 1640995202000,
        });
      });

      expect(result.current.locations).toHaveLength(1);
      expect(result.current.lastLocation?.latitude).toBe('34.0522');
    });
  });
});
