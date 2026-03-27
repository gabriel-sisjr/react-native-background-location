import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useGeofencing } from '../../hooks/useGeofencing';
import { useGeofenceEvents } from '../../hooks/useGeofenceEvents';
import BackgroundLocationModule from '../../NativeBackgroundLocation';
import { GeofenceTransitionType } from '../../types/geofencing';

// Module-level mock similar to existing hook tests
jest.mock('../../NativeBackgroundLocation', () => ({
  __esModule: true,
  default: {
    addGeofence: jest.fn(),
    addGeofences: jest.fn(),
    removeGeofence: jest.fn(),
    removeGeofences: jest.fn(),
    removeAllGeofences: jest.fn(),
    getActiveGeofences: jest.fn(),
    getMaxGeofences: jest.fn(),
    getGeofenceTransitions: jest.fn(),
    clearGeofenceTransitions: jest.fn(),
    configureGeofenceNotifications: jest.fn().mockResolvedValue(undefined),
    getGeofenceNotificationConfig: jest.fn().mockResolvedValue('{}'),
    isTracking: jest.fn().mockResolvedValue({ active: false }),
  },
}));

describe('useGeofencing', () => {
  const mockGeofence = {
    identifier: 'office',
    latitude: -23.5505,
    longitude: -46.6333,
    radius: 200,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (
      BackgroundLocationModule.getActiveGeofences as jest.Mock
    ).mockResolvedValue(JSON.stringify([]));
    (BackgroundLocationModule.getMaxGeofences as jest.Mock).mockResolvedValue(
      100
    );
    (BackgroundLocationModule.addGeofence as jest.Mock).mockResolvedValue(
      undefined
    );
    (BackgroundLocationModule.removeGeofence as jest.Mock).mockResolvedValue(
      undefined
    );
    (
      BackgroundLocationModule.removeAllGeofences as jest.Mock
    ).mockResolvedValue(undefined);
  });

  describe('initialization', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useGeofencing({ autoLoad: false }));
      expect(result.current.geofences).toEqual([]);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.maxGeofences).toBeNull();
    });
  });

  describe('auto-load', () => {
    it('should auto-load geofences on mount when autoLoad is true (default)', async () => {
      const { result } = renderHook(() => useGeofencing());
      await waitFor(() => {
        expect(BackgroundLocationModule.getActiveGeofences).toHaveBeenCalled();
        expect(BackgroundLocationModule.getMaxGeofences).toHaveBeenCalled();
        expect(result.current.maxGeofences).toBe(100);
      });
    });

    it('should skip auto-load when autoLoad is false', () => {
      renderHook(() => useGeofencing({ autoLoad: false }));
      expect(
        BackgroundLocationModule.getActiveGeofences
      ).not.toHaveBeenCalled();
      expect(BackgroundLocationModule.getMaxGeofences).not.toHaveBeenCalled();
    });
  });

  describe('addGeofence', () => {
    it('should call API and refresh list', async () => {
      const { result } = renderHook(() => useGeofencing({ autoLoad: false }));

      await act(async () => {
        await result.current.addGeofence(mockGeofence);
      });

      expect(BackgroundLocationModule.addGeofence).toHaveBeenCalledTimes(1);
      // Refresh called after add
      expect(BackgroundLocationModule.getActiveGeofences).toHaveBeenCalled();
    });

    it('should set error state when API throws', async () => {
      (BackgroundLocationModule.addGeofence as jest.Mock).mockRejectedValue(
        new Error('fail')
      );
      // Also need to mock getActiveGeofences for the duplicate check inside addGeofence API
      const { result } = renderHook(() => useGeofencing({ autoLoad: false }));

      await act(async () => {
        try {
          await result.current.addGeofence(mockGeofence);
        } catch {
          // expected
        }
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.error?.message).toBe('fail');
    });

    it('should wrap non-Error rejection in a generic Error when addGeofence fails', async () => {
      (BackgroundLocationModule.addGeofence as jest.Mock).mockRejectedValue(
        'string rejection'
      );
      const { result } = renderHook(() => useGeofencing({ autoLoad: false }));

      await act(async () => {
        try {
          await result.current.addGeofence(mockGeofence);
        } catch {
          // expected — hook re-throws
        }
      });

      expect(result.current.error).not.toBeNull();
      expect(result.current.error?.message).toBe('Failed to add geofence');
    });
  });

  describe('addGeofences', () => {
    const mockRegions = [
      {
        identifier: 'office',
        latitude: -23.5505,
        longitude: -46.6333,
        radius: 200,
      },
      {
        identifier: 'home',
        latitude: -23.56,
        longitude: -46.64,
        radius: 100,
      },
    ];

    beforeEach(() => {
      (BackgroundLocationModule.addGeofences as jest.Mock).mockResolvedValue(
        undefined
      );
    });

    it('should call API and refresh list on success', async () => {
      const { result } = renderHook(() => useGeofencing({ autoLoad: false }));

      await act(async () => {
        await result.current.addGeofences(mockRegions);
      });

      expect(BackgroundLocationModule.addGeofences).toHaveBeenCalledTimes(1);
      expect(BackgroundLocationModule.getActiveGeofences).toHaveBeenCalled();
      expect(result.current.error).toBeNull();
    });

    it('should set error and re-throw when API rejects with an Error', async () => {
      (BackgroundLocationModule.addGeofences as jest.Mock).mockRejectedValue(
        new Error('batch add failed')
      );
      const { result } = renderHook(() => useGeofencing({ autoLoad: false }));

      await act(async () => {
        try {
          await result.current.addGeofences(mockRegions);
        } catch {
          // expected — hook re-throws
        }
      });

      expect(result.current.error).not.toBeNull();
      expect(result.current.error?.message).toBe('batch add failed');
    });

    it('should wrap non-Error rejection in a generic Error when addGeofences fails', async () => {
      (BackgroundLocationModule.addGeofences as jest.Mock).mockRejectedValue(
        'string rejection'
      );
      const { result } = renderHook(() => useGeofencing({ autoLoad: false }));

      await act(async () => {
        try {
          await result.current.addGeofences(mockRegions);
        } catch {
          // expected — hook re-throws
        }
      });

      expect(result.current.error).not.toBeNull();
      expect(result.current.error?.message).toBe('Failed to add geofences');
    });
  });

  describe('removeGeofence', () => {
    it('should call API and refresh', async () => {
      const { result } = renderHook(() => useGeofencing({ autoLoad: false }));

      await act(async () => {
        await result.current.removeGeofence('office');
      });

      expect(BackgroundLocationModule.removeGeofence).toHaveBeenCalledWith(
        'office'
      );
      expect(BackgroundLocationModule.getActiveGeofences).toHaveBeenCalled();
    });

    it('should set error and re-throw when removeGeofence rejects with an Error', async () => {
      (BackgroundLocationModule.removeGeofence as jest.Mock).mockRejectedValue(
        new Error('remove failed')
      );
      const { result } = renderHook(() => useGeofencing({ autoLoad: false }));

      await act(async () => {
        try {
          await result.current.removeGeofence('office');
        } catch {
          // expected — hook re-throws
        }
      });

      expect(result.current.error).not.toBeNull();
      expect(result.current.error?.message).toBe('remove failed');
    });

    it('should wrap non-Error rejection in a generic Error when removeGeofence fails', async () => {
      (BackgroundLocationModule.removeGeofence as jest.Mock).mockRejectedValue(
        'string rejection'
      );
      const { result } = renderHook(() => useGeofencing({ autoLoad: false }));

      await act(async () => {
        try {
          await result.current.removeGeofence('office');
        } catch {
          // expected — hook re-throws
        }
      });

      expect(result.current.error).not.toBeNull();
      expect(result.current.error?.message).toBe('Failed to remove geofence');
    });
  });

  describe('removeGeofences', () => {
    beforeEach(() => {
      (BackgroundLocationModule.removeGeofences as jest.Mock).mockResolvedValue(
        undefined
      );
    });

    it('should call API and refresh on success', async () => {
      const { result } = renderHook(() => useGeofencing({ autoLoad: false }));

      await act(async () => {
        await result.current.removeGeofences(['office', 'home']);
      });

      expect(BackgroundLocationModule.removeGeofences).toHaveBeenCalledTimes(1);
      expect(BackgroundLocationModule.getActiveGeofences).toHaveBeenCalled();
      expect(result.current.error).toBeNull();
    });

    it('should set error and re-throw when removeGeofences rejects with an Error', async () => {
      (BackgroundLocationModule.removeGeofences as jest.Mock).mockRejectedValue(
        new Error('batch remove failed')
      );
      const { result } = renderHook(() => useGeofencing({ autoLoad: false }));

      await act(async () => {
        try {
          await result.current.removeGeofences(['office', 'home']);
        } catch {
          // expected — hook re-throws
        }
      });

      expect(result.current.error).not.toBeNull();
      expect(result.current.error?.message).toBe('batch remove failed');
    });

    it('should wrap non-Error rejection in a generic Error when removeGeofences fails', async () => {
      (BackgroundLocationModule.removeGeofences as jest.Mock).mockRejectedValue(
        'string rejection'
      );
      const { result } = renderHook(() => useGeofencing({ autoLoad: false }));

      await act(async () => {
        try {
          await result.current.removeGeofences(['office', 'home']);
        } catch {
          // expected — hook re-throws
        }
      });

      expect(result.current.error).not.toBeNull();
      expect(result.current.error?.message).toBe('Failed to remove geofences');
    });
  });

  describe('removeAllGeofences', () => {
    it('should call API and refresh', async () => {
      const { result } = renderHook(() => useGeofencing({ autoLoad: false }));

      await act(async () => {
        await result.current.removeAllGeofences();
      });

      expect(BackgroundLocationModule.removeAllGeofences).toHaveBeenCalledTimes(
        1
      );
      expect(BackgroundLocationModule.getActiveGeofences).toHaveBeenCalled();
    });

    it('should set error and re-throw when removeAllGeofences rejects with an Error', async () => {
      (
        BackgroundLocationModule.removeAllGeofences as jest.Mock
      ).mockRejectedValue(new Error('remove all failed'));
      const { result } = renderHook(() => useGeofencing({ autoLoad: false }));

      await act(async () => {
        try {
          await result.current.removeAllGeofences();
        } catch {
          // expected — hook re-throws
        }
      });

      expect(result.current.error).not.toBeNull();
      expect(result.current.error?.message).toBe('remove all failed');
    });

    it('should wrap non-Error rejection in a generic Error when removeAllGeofences fails', async () => {
      (
        BackgroundLocationModule.removeAllGeofences as jest.Mock
      ).mockRejectedValue('string rejection');
      const { result } = renderHook(() => useGeofencing({ autoLoad: false }));

      await act(async () => {
        try {
          await result.current.removeAllGeofences();
        } catch {
          // expected — hook re-throws
        }
      });

      expect(result.current.error).not.toBeNull();
      expect(result.current.error?.message).toBe(
        'Failed to remove all geofences'
      );
    });
  });

  describe('refresh', () => {
    it('should reload geofences and maxGeofences', async () => {
      const mockList = [mockGeofence];
      (
        BackgroundLocationModule.getActiveGeofences as jest.Mock
      ).mockResolvedValue(JSON.stringify(mockList));
      (BackgroundLocationModule.getMaxGeofences as jest.Mock).mockResolvedValue(
        20
      );

      const { result } = renderHook(() => useGeofencing({ autoLoad: false }));

      await act(async () => {
        await result.current.refresh();
      });

      expect(result.current.geofences).toHaveLength(1);
      expect(result.current.geofences[0]!.identifier).toBe('office');
      expect(result.current.maxGeofences).toBe(20);
    });

    it('should set error when getActiveGeofences rejects with an Error instance', async () => {
      (
        BackgroundLocationModule.getActiveGeofences as jest.Mock
      ).mockRejectedValue(new Error('Network failure'));

      const { result } = renderHook(() => useGeofencing({ autoLoad: false }));

      await act(async () => {
        await result.current.refresh();
      });

      expect(result.current.error).not.toBeNull();
      expect(result.current.error?.message).toBe('Network failure');
      expect(result.current.isLoading).toBe(false);
    });

    it('should wrap non-Error rejection in a generic Error when refresh fails', async () => {
      (
        BackgroundLocationModule.getActiveGeofences as jest.Mock
      ).mockRejectedValue('string error');

      const { result } = renderHook(() => useGeofencing({ autoLoad: false }));

      await act(async () => {
        await result.current.refresh();
      });

      expect(result.current.error).not.toBeNull();
      expect(result.current.error?.message).toBe('Failed to load geofences');
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('clearError', () => {
    it('should reset error to null', async () => {
      (BackgroundLocationModule.addGeofence as jest.Mock).mockRejectedValue(
        new Error('fail')
      );
      const { result } = renderHook(() => useGeofencing({ autoLoad: false }));

      await act(async () => {
        try {
          await result.current.addGeofence(mockGeofence);
        } catch {
          // expected
        }
      });
      expect(result.current.error).not.toBeNull();

      act(() => {
        result.current.clearError();
      });
      expect(result.current.error).toBeNull();
    });
  });

  describe('notification options', () => {
    it('should call configureGeofenceNotifications on mount when options provided', async () => {
      const notificationOptions = {
        enabled: true,
        title: '{{transitionType}}: {{identifier}}',
      };
      renderHook(() => useGeofencing({ autoLoad: false, notificationOptions }));
      await waitFor(() => {
        expect(
          BackgroundLocationModule.configureGeofenceNotifications
        ).toHaveBeenCalledWith(JSON.stringify(notificationOptions));
      });
    });

    it('should NOT call configureGeofenceNotifications when options undefined', () => {
      renderHook(() => useGeofencing({ autoLoad: false }));
      expect(
        BackgroundLocationModule.configureGeofenceNotifications
      ).not.toHaveBeenCalled();
    });

    it('should reconfigure when notificationOptions content changes', async () => {
      const { rerender } = renderHook(
        (props: { notificationOptions?: any }) =>
          useGeofencing({
            autoLoad: false,
            notificationOptions: props.notificationOptions,
          }),
        { initialProps: { notificationOptions: { title: 'A' } } }
      );

      await waitFor(() => {
        expect(
          BackgroundLocationModule.configureGeofenceNotifications
        ).toHaveBeenCalledTimes(1);
      });

      rerender({ notificationOptions: { title: 'B' } });

      await waitFor(() => {
        expect(
          BackgroundLocationModule.configureGeofenceNotifications
        ).toHaveBeenCalledTimes(2);
      });
    });

    it('should NOT reconfigure when object reference changes but content is same', async () => {
      const { rerender } = renderHook(
        (props: { notificationOptions?: any }) =>
          useGeofencing({
            autoLoad: false,
            notificationOptions: props.notificationOptions,
          }),
        { initialProps: { notificationOptions: { title: 'Same' } } }
      );

      await waitFor(() => {
        expect(
          BackgroundLocationModule.configureGeofenceNotifications
        ).toHaveBeenCalledTimes(1);
      });

      // New object reference, same content
      rerender({ notificationOptions: { title: 'Same' } });

      // Should still be 1 (not 2) due to JSON.stringify deep comparison
      await waitFor(() => {
        expect(
          BackgroundLocationModule.configureGeofenceNotifications
        ).toHaveBeenCalledTimes(1);
      });
    });

    it('should set error when configureGeofenceNotifications rejects with an Error', async () => {
      (
        BackgroundLocationModule.configureGeofenceNotifications as jest.Mock
      ).mockRejectedValue(new Error('config failed'));

      const notificationOptions = { enabled: true, title: 'Test' };
      const { result } = renderHook(() =>
        useGeofencing({ autoLoad: false, notificationOptions })
      );

      await waitFor(() => {
        expect(result.current.error).not.toBeNull();
        expect(result.current.error?.message).toBe('config failed');
      });
    });

    it('should wrap non-Error rejection in a generic Error when configureGeofenceNotifications fails', async () => {
      (
        BackgroundLocationModule.configureGeofenceNotifications as jest.Mock
      ).mockRejectedValue('string rejection');

      const notificationOptions = { enabled: true, title: 'Test' };
      const { result } = renderHook(() =>
        useGeofencing({ autoLoad: false, notificationOptions })
      );

      await waitFor(() => {
        expect(result.current.error).not.toBeNull();
        expect(result.current.error?.message).toBe(
          'Failed to configure geofence notifications'
        );
      });
    });
  });
});

describe('useGeofenceEvents', () => {
  let mockAddListener: jest.Mock;
  let mockRemove: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRemove = jest.fn();
    mockAddListener = jest.fn(
      (_event: string, callback: (data: any) => void) => {
        // Store callback for later invocation
        (global as any).__geofenceCallback = callback;
        return { remove: mockRemove };
      }
    );

    // Override the NativeEventEmitter mock
    const { NativeEventEmitter } = require('react-native');
    NativeEventEmitter.mockImplementation(() => ({
      addListener: mockAddListener,
      removeAllListeners: jest.fn(),
    }));
  });

  afterEach(() => {
    delete (global as any).__geofenceCallback;
  });

  it('should subscribe to onGeofenceTransition event', () => {
    renderHook(() =>
      useGeofenceEvents({
        onTransition: jest.fn(),
      })
    );
    expect(mockAddListener).toHaveBeenCalledWith(
      'onGeofenceTransition',
      expect.any(Function)
    );
  });

  it('should call onTransition callback when event is received', () => {
    const onTransition = jest.fn();
    renderHook(() => useGeofenceEvents({ onTransition }));

    const event = {
      geofenceId: 'office',
      transitionType: GeofenceTransitionType.ENTER,
      latitude: -23.5505,
      longitude: -46.6333,
      timestamp: '2024-01-01T00:00:00Z',
      distanceFromCenter: 50,
    };

    act(() => {
      (global as any).__geofenceCallback?.(event);
    });

    expect(onTransition).toHaveBeenCalledWith(event);
  });

  it('should apply transition type filter', () => {
    const onTransition = jest.fn();
    renderHook(() =>
      useGeofenceEvents({
        onTransition,
        filter: [GeofenceTransitionType.ENTER],
      })
    );

    // Should pass ENTER
    act(() => {
      (global as any).__geofenceCallback?.({
        geofenceId: 'office',
        transitionType: GeofenceTransitionType.ENTER,
        latitude: 0,
        longitude: 0,
        timestamp: '2024-01-01T00:00:00Z',
        distanceFromCenter: 0,
      });
    });
    expect(onTransition).toHaveBeenCalledTimes(1);

    // Should NOT pass EXIT
    act(() => {
      (global as any).__geofenceCallback?.({
        geofenceId: 'office',
        transitionType: GeofenceTransitionType.EXIT,
        latitude: 0,
        longitude: 0,
        timestamp: '2024-01-01T00:00:00Z',
        distanceFromCenter: 0,
      });
    });
    expect(onTransition).toHaveBeenCalledTimes(1); // still 1
  });

  it('should apply geofenceId filter', () => {
    const onTransition = jest.fn();
    renderHook(() =>
      useGeofenceEvents({
        onTransition,
        geofenceId: 'office',
      })
    );

    // Should pass matching geofenceId
    act(() => {
      (global as any).__geofenceCallback?.({
        geofenceId: 'office',
        transitionType: GeofenceTransitionType.ENTER,
        latitude: 0,
        longitude: 0,
        timestamp: '2024-01-01T00:00:00Z',
        distanceFromCenter: 0,
      });
    });
    expect(onTransition).toHaveBeenCalledTimes(1);

    // Should NOT pass non-matching geofenceId
    act(() => {
      (global as any).__geofenceCallback?.({
        geofenceId: 'home',
        transitionType: GeofenceTransitionType.ENTER,
        latitude: 0,
        longitude: 0,
        timestamp: '2024-01-01T00:00:00Z',
        distanceFromCenter: 0,
      });
    });
    expect(onTransition).toHaveBeenCalledTimes(1); // still 1
  });

  it('should unsubscribe on unmount', () => {
    const { unmount } = renderHook(() =>
      useGeofenceEvents({
        onTransition: jest.fn(),
      })
    );
    unmount();
    expect(mockRemove).toHaveBeenCalledTimes(1);
  });

  it('should NOT subscribe to events when native module is unavailable', () => {
    const originalIsTracking = BackgroundLocationModule.isTracking;

    // Make isTracking not a function so isNativeModuleAvailable() returns false
    (BackgroundLocationModule as any).isTracking = 'not-a-function';

    renderHook(() =>
      useGeofenceEvents({
        onTransition: jest.fn(),
      })
    );

    // addListener should NOT have been called since module is unavailable
    expect(mockAddListener).not.toHaveBeenCalled();

    // Restore original mock
    (BackgroundLocationModule as any).isTracking = originalIsTracking;
  });

  it('should NOT subscribe to events when native module isTracking is undefined', () => {
    const originalIsTracking = BackgroundLocationModule.isTracking;

    // Make isTracking undefined so typeof check returns false
    (BackgroundLocationModule as any).isTracking = undefined;

    renderHook(() =>
      useGeofenceEvents({
        onTransition: jest.fn(),
      })
    );

    expect(mockAddListener).not.toHaveBeenCalled();

    // Restore original mock
    (BackgroundLocationModule as any).isTracking = originalIsTracking;
  });

  it('should NOT subscribe to events when isTracking property access throws', () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      BackgroundLocationModule,
      'isTracking'
    );

    // Define a getter that throws to cover the catch branch (line 20)
    Object.defineProperty(BackgroundLocationModule, 'isTracking', {
      get() {
        throw new Error('module access error');
      },
      configurable: true,
    });

    renderHook(() =>
      useGeofenceEvents({
        onTransition: jest.fn(),
      })
    );

    expect(mockAddListener).not.toHaveBeenCalled();

    // Restore original property
    if (originalDescriptor) {
      Object.defineProperty(
        BackgroundLocationModule,
        'isTracking',
        originalDescriptor
      );
    } else {
      delete (BackgroundLocationModule as any).isTracking;
    }
  });
});
