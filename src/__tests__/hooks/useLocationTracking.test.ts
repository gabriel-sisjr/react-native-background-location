import { act, renderHook, waitFor } from '@testing-library/react-native';
import { NativeModules, Platform } from 'react-native';
import { useLocationTracking } from '../../hooks/useLocationTracking';
import BackgroundLocationModule from '../../NativeBackgroundLocation';

jest.mock('../../NativeBackgroundLocation', () => ({
  __esModule: true,
  default: {
    startTracking: jest.fn(),
    stopTracking: jest.fn(),
    isTracking: jest.fn(),
    getLocations: jest.fn(),
    clearTrip: jest.fn(),
  },
}));

describe('useLocationTracking', () => {
  const mockTripId = 'test-trip-123';

  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'android';
    NativeModules.BackgroundLocation = {
      startTracking: jest.fn(),
      stopTracking: jest.fn(),
      isTracking: jest.fn(),
      getLocations: jest.fn(),
      clearTrip: jest.fn(),
    };
    console.warn = jest.fn();
    console.error = jest.fn();

    // Ensure BackgroundLocationModule methods are properly mocked
    (BackgroundLocationModule.isTracking as jest.Mock) = jest.fn();
    (BackgroundLocationModule.isTracking as jest.Mock).mockResolvedValue({
      active: false,
      tripId: undefined,
    });
  });

  afterEach(() => {
    // Restore all mocks after each test
    (BackgroundLocationModule.isTracking as jest.Mock) = jest.fn();
    (BackgroundLocationModule.isTracking as jest.Mock).mockResolvedValue({
      active: false,
      tripId: undefined,
    });
  });

  describe('Initialization', () => {
    it('should initialize with default state', () => {
      (BackgroundLocationModule.isTracking as jest.Mock).mockResolvedValue({
        active: false,
        tripId: undefined,
      });

      const { result } = renderHook(() => useLocationTracking(false));

      expect(result.current.isTracking).toBe(false);
      expect(result.current.tripId).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(typeof result.current.refresh).toBe('function');
    });

    it('should auto-refresh on mount when enabled', async () => {
      (BackgroundLocationModule.isTracking as jest.Mock).mockResolvedValue({
        active: true,
        tripId: mockTripId,
      });

      const { result } = renderHook(() => useLocationTracking(true));

      await waitFor(() => {
        expect(result.current.isTracking).toBe(true);
      });

      expect(result.current.tripId).toBe(mockTripId);
      expect(BackgroundLocationModule.isTracking).toHaveBeenCalled();
    });

    it('should not auto-refresh when disabled', async () => {
      (BackgroundLocationModule.isTracking as jest.Mock).mockResolvedValue({
        active: true,
        tripId: mockTripId,
      });

      const { result } = renderHook(() => useLocationTracking(false));

      // Wait a bit to ensure no refresh happened
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(result.current.isTracking).toBe(false);
      expect(BackgroundLocationModule.isTracking).not.toHaveBeenCalled();
    });

    it('should default to autoRefresh=true when no argument provided', async () => {
      (BackgroundLocationModule.isTracking as jest.Mock).mockResolvedValue({
        active: true,
        tripId: mockTripId,
      });

      const { result } = renderHook(() => useLocationTracking());

      await waitFor(() => {
        expect(result.current.isTracking).toBe(true);
      });

      expect(BackgroundLocationModule.isTracking).toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    it('should refresh tracking status successfully', async () => {
      (BackgroundLocationModule.isTracking as jest.Mock).mockResolvedValue({
        active: true,
        tripId: mockTripId,
      });

      const { result } = renderHook(() => useLocationTracking(false));

      await act(async () => {
        await result.current.refresh();
      });

      expect(result.current.isTracking).toBe(true);
      expect(result.current.tripId).toBe(mockTripId);
      expect(result.current.isLoading).toBe(false);
    });

    it('should update to inactive status', async () => {
      (BackgroundLocationModule.isTracking as jest.Mock).mockResolvedValue({
        active: false,
        tripId: undefined,
      });

      const { result } = renderHook(() => useLocationTracking(false));

      await act(async () => {
        await result.current.refresh();
      });

      expect(result.current.isTracking).toBe(false);
      expect(result.current.tripId).toBeNull();
    });

    it('should handle active tracking without tripId', async () => {
      (BackgroundLocationModule.isTracking as jest.Mock).mockResolvedValue({
        active: true,
        tripId: undefined,
      });

      const { result } = renderHook(() => useLocationTracking(false));

      await act(async () => {
        await result.current.refresh();
      });

      expect(result.current.isTracking).toBe(true);
      expect(result.current.tripId).toBeNull();
    });

    it('should set loading state during refresh', async () => {
      let resolvePromise: (value: any) => void;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      (BackgroundLocationModule.isTracking as jest.Mock).mockReturnValue(
        promise
      );

      const { result } = renderHook(() => useLocationTracking(false));

      act(() => {
        result.current.refresh();
      });

      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        resolvePromise!({ active: true, tripId: mockTripId });
        await promise;
      });

      expect(result.current.isLoading).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      (BackgroundLocationModule.isTracking as jest.Mock).mockRejectedValue(
        new Error('Failed to check status')
      );

      const { result } = renderHook(() => useLocationTracking(false));

      await act(async () => {
        await result.current.refresh();
      });

      expect(result.current.isTracking).toBe(false);
      expect(result.current.tripId).toBeNull();
      expect(console.error).toHaveBeenCalledWith(
        'Error checking tracking status:',
        expect.any(Error)
      );
    });

    it.skip('should warn when module is not available', async () => {
      (global as any).setModuleAvailable(false);

      const { result } = renderHook(() => useLocationTracking(false));

      await act(async () => {
        await result.current.refresh();
      });

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('BackgroundLocation not available')
      );
    });

    it('should handle when isTracking is not a function (line 11)', async () => {
      const originalIsTracking = BackgroundLocationModule.isTracking;
      Object.defineProperty(BackgroundLocationModule, 'isTracking', {
        value: undefined,
        configurable: true,
        writable: true,
      });

      const { result } = renderHook(() => useLocationTracking(false));

      await act(async () => {
        await result.current.refresh();
      });

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('BackgroundLocation not available')
      );
      expect(result.current.isTracking).toBe(false);

      // Restore
      Object.defineProperty(BackgroundLocationModule, 'isTracking', {
        value: originalIsTracking,
        configurable: true,
        writable: true,
      });
      (BackgroundLocationModule.isTracking as jest.Mock) = jest.fn();
    });

    it('should handle when module is null (line 15)', async () => {
      const originalIsTracking = BackgroundLocationModule.isTracking;
      const originalModule = BackgroundLocationModule;

      // Set isTracking to be a function (to pass first check)
      Object.defineProperty(BackgroundLocationModule, 'isTracking', {
        value: jest.fn(),
        configurable: true,
        writable: true,
      });

      // Set module to null to trigger line 15
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
        useLocationTracking: useLocationTrackingWithNull,
      } = require('../../hooks/useLocationTracking');
      const { result } = renderHook(() => useLocationTrackingWithNull(false));

      await act(async () => {
        await result.current.refresh();
      });

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('BackgroundLocation not available')
      );

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

    it('should handle exception in isNativeModuleAvailable (line 19)', async () => {
      const originalIsTracking = BackgroundLocationModule.isTracking;

      // Make accessing isTracking throw an error
      Object.defineProperty(BackgroundLocationModule, 'isTracking', {
        get: () => {
          throw new Error('Access error');
        },
        configurable: true,
      });

      const { result } = renderHook(() => useLocationTracking(false));

      await act(async () => {
        await result.current.refresh();
      });

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('BackgroundLocation not available')
      );

      // Restore
      Object.defineProperty(BackgroundLocationModule, 'isTracking', {
        value: originalIsTracking,
        configurable: true,
        writable: true,
      });
      (BackgroundLocationModule.isTracking as jest.Mock) = jest.fn();
    });

    it('should handle when module is not available in refresh (lines 81-84)', async () => {
      const originalIsTracking = BackgroundLocationModule.isTracking;
      Object.defineProperty(BackgroundLocationModule, 'isTracking', {
        value: undefined,
        configurable: true,
        writable: true,
      });

      const { result } = renderHook(() => useLocationTracking(false));

      await act(async () => {
        await result.current.refresh();
      });

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('BackgroundLocation not available')
      );
      expect(result.current.isTracking).toBe(false);
      // isTracking is undefined, so we can't check if it was called
      // The important thing is that the warning was shown and isTracking is false

      // Restore
      Object.defineProperty(BackgroundLocationModule, 'isTracking', {
        value: originalIsTracking,
        configurable: true,
        writable: true,
      });
      (BackgroundLocationModule.isTracking as jest.Mock) = jest.fn();
      (BackgroundLocationModule.isTracking as jest.Mock).mockResolvedValue({
        active: false,
        tripId: undefined,
      });
    });
  });

  describe('Multiple refreshes', () => {
    it('should handle multiple rapid refreshes', async () => {
      (BackgroundLocationModule.isTracking as jest.Mock)
        .mockResolvedValueOnce({ active: true, tripId: 'trip-1' })
        .mockResolvedValueOnce({ active: false, tripId: undefined })
        .mockResolvedValueOnce({ active: true, tripId: 'trip-2' });

      const { result } = renderHook(() => useLocationTracking(false));

      // First refresh
      await act(async () => {
        await result.current.refresh();
      });
      expect(result.current.tripId).toBe('trip-1');

      // Second refresh
      await act(async () => {
        await result.current.refresh();
      });
      expect(result.current.isTracking).toBe(false);
      expect(result.current.tripId).toBeNull();

      // Third refresh
      await act(async () => {
        await result.current.refresh();
      });
      expect(result.current.tripId).toBe('trip-2');
    });
  });

  describe('Concurrent operations', () => {
    it('should handle concurrent refresh calls', async () => {
      let resolveFirst: (value: any) => void;
      let resolveSecond: (value: any) => void;

      const firstPromise = new Promise((resolve) => {
        resolveFirst = resolve;
      });
      const secondPromise = new Promise((resolve) => {
        resolveSecond = resolve;
      });

      (BackgroundLocationModule.isTracking as jest.Mock)
        .mockReturnValueOnce(firstPromise)
        .mockReturnValueOnce(secondPromise);

      const { result } = renderHook(() => useLocationTracking(false));

      // Start first refresh
      act(() => {
        result.current.refresh();
      });

      // Start second refresh while first is pending
      act(() => {
        result.current.refresh();
      });

      expect(result.current.isLoading).toBe(true);

      // Complete both promises
      await act(async () => {
        resolveFirst!({ active: true, tripId: 'trip-1' });
        resolveSecond!({ active: false, tripId: undefined });
        await Promise.all([firstPromise, secondPromise]);
      });

      // Should reflect the last completed result
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('Status changes', () => {
    it('should track status changes from inactive to active', async () => {
      (BackgroundLocationModule.isTracking as jest.Mock)
        .mockResolvedValueOnce({ active: false, tripId: undefined })
        .mockResolvedValueOnce({ active: true, tripId: mockTripId });

      const { result } = renderHook(() => useLocationTracking(false));

      await act(async () => {
        await result.current.refresh();
      });

      expect(result.current.isTracking).toBe(false);

      await act(async () => {
        await result.current.refresh();
      });

      expect(result.current.isTracking).toBe(true);
      expect(result.current.tripId).toBe(mockTripId);
    });

    it('should track status changes from active to inactive', async () => {
      (BackgroundLocationModule.isTracking as jest.Mock)
        .mockResolvedValueOnce({ active: true, tripId: mockTripId })
        .mockResolvedValueOnce({ active: false, tripId: undefined });

      const { result } = renderHook(() => useLocationTracking(false));

      await act(async () => {
        await result.current.refresh();
      });

      expect(result.current.isTracking).toBe(true);

      await act(async () => {
        await result.current.refresh();
      });

      expect(result.current.isTracking).toBe(false);
      expect(result.current.tripId).toBeNull();
    });

    it('should track tripId changes', async () => {
      (BackgroundLocationModule.isTracking as jest.Mock)
        .mockResolvedValueOnce({ active: true, tripId: 'trip-1' })
        .mockResolvedValueOnce({ active: true, tripId: 'trip-2' });

      const { result } = renderHook(() => useLocationTracking(false));

      await act(async () => {
        await result.current.refresh();
      });

      expect(result.current.tripId).toBe('trip-1');

      await act(async () => {
        await result.current.refresh();
      });

      expect(result.current.tripId).toBe('trip-2');
    });
  });

  describe('Platform handling', () => {
    it('should work on Android platform', async () => {
      Platform.OS = 'android';
      (BackgroundLocationModule.isTracking as jest.Mock).mockResolvedValue({
        active: true,
        tripId: mockTripId,
      });

      const { result } = renderHook(() => useLocationTracking(false));

      await act(async () => {
        await result.current.refresh();
      });

      expect(result.current.isTracking).toBe(true);
    });

    // NOTE: Module availability tests are skipped due to Jest module caching limitations
    it.skip('should handle iOS platform (not available)', async () => {
      Platform.OS = 'ios';
      (global as any).setModuleAvailable(false);

      const { result } = renderHook(() => useLocationTracking(false));

      await act(async () => {
        await result.current.refresh();
      });

      expect(result.current.isTracking).toBe(false);
      expect(console.warn).toHaveBeenCalled();
    });
  });

  describe('Module availability', () => {
    it('should detect when module is available', async () => {
      expect(NativeModules.BackgroundLocation).toBeDefined();

      (BackgroundLocationModule.isTracking as jest.Mock).mockResolvedValue({
        active: true,
        tripId: mockTripId,
      });

      const { result } = renderHook(() => useLocationTracking(false));

      await act(async () => {
        await result.current.refresh();
      });

      expect(BackgroundLocationModule.isTracking).toHaveBeenCalled();
    });

    it.skip('should detect when module is not available', async () => {
      (global as any).setModuleAvailable(false);

      const { result } = renderHook(() => useLocationTracking(false));

      await act(async () => {
        await result.current.refresh();
      });

      expect(result.current.isTracking).toBe(false);
      expect(console.warn).toHaveBeenCalled();
    });
  });

  describe('Edge cases', () => {
    it('should handle undefined tripId correctly', async () => {
      (BackgroundLocationModule.isTracking as jest.Mock).mockResolvedValue({
        active: true,
        tripId: undefined,
      });

      const { result } = renderHook(() => useLocationTracking(false));

      await act(async () => {
        await result.current.refresh();
      });

      expect(result.current.tripId).toBeNull();
    });

    it('should handle empty string tripId as null', async () => {
      (BackgroundLocationModule.isTracking as jest.Mock).mockResolvedValue({
        active: true,
        tripId: '',
      });

      const { result } = renderHook(() => useLocationTracking(false));

      await act(async () => {
        await result.current.refresh();
      });

      // Empty string is returned as null ('' || null = null)
      expect(result.current.tripId).toBeNull();
    });
  });
});
