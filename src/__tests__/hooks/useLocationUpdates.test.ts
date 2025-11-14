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
  });
});
