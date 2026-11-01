import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AppState, NativeEventEmitter } from 'react-native';
import { useMotionActivity } from '../../hooks/useMotionActivity';
import { useMotionActivity as exportedUseMotionActivity } from '../../hooks';
import BackgroundLocationModule from '../../NativeBackgroundLocation';
import {
  MotionActivityType,
  MotionConfidence,
  MotionDetectionStatus,
  MotionReductionStatus,
} from '../../types/enums';
import type { LocationWarningType, MotionActivityEvent } from '../../types';

const simulateMotionActivityEvent = (event: unknown): void =>
  (global as any).simulateMotionActivityEvent(event);
const simulateWarningEvent = (event: unknown): void =>
  (global as any).simulateWarningEvent(event);
const simulateAppStateChange = (state: string): void =>
  (global as any).simulateAppStateChange(state);
const getAppStateSubscriptions = (): Array<{ remove: jest.Mock }> =>
  (global as any).getAppStateSubscriptions();

const getStateMock =
  BackgroundLocationModule.getMotionActivityState as unknown as jest.Mock;

type MutableModule = Record<string, unknown>;
const nativeModule = BackgroundLocationModule as unknown as MutableModule;
const originalNativeModule: MutableModule = { ...nativeModule };

const activity = (
  overrides: Partial<MotionActivityEvent> = {}
): MotionActivityEvent => ({
  tripId: 'trip-1',
  activity: MotionActivityType.WALKING,
  confidence: MotionConfidence.HIGH,
  timestamp: 1700000000000,
  ...overrides,
});

const stateJson = (state: {
  tripId?: string | null;
  detection?: string;
  reduction?: string;
  lastActivity?: MotionActivityEvent | null;
}): string =>
  JSON.stringify({
    tripId: null,
    detection: 'OFF',
    reduction: 'DISABLED',
    lastActivity: null,
    ...state,
  });

const OFF_JSON = stateJson({});

/** A promise resolved by the test, to control when a refresh completes. */
const deferred = <T>() => {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
};

/** Subscriptions returned by every NativeEventEmitter created in the test. */
const emitterSubscriptions = (): Array<{ remove: jest.Mock }> =>
  (NativeEventEmitter as unknown as jest.Mock).mock.results.flatMap((emitter) =>
    (emitter.value.addListener as jest.Mock).mock.results.map(
      (result) => result.value as { remove: jest.Mock }
    )
  );

describe('useMotionActivity', () => {
  beforeEach(() => {
    Object.assign(nativeModule, originalNativeModule);
    getStateMock.mockReset();
    getStateMock.mockResolvedValue(OFF_JSON);
  });

  afterAll(() => {
    Object.assign(nativeModule, originalNativeModule);
  });

  it('is exported from the hooks barrel', () => {
    expect(exportedUseMotionActivity).toBe(useMotionActivity);
  });

  it('hydrates on mount', async () => {
    getStateMock.mockResolvedValue(
      stateJson({
        tripId: 'trip-1',
        detection: 'RUNNING',
        reduction: 'MONITORING',
        lastActivity: activity(),
      })
    );

    const { result } = renderHook(() => useMotionActivity());

    // Defaults until the native state arrives.
    expect(result.current.lastActivity).toBeNull();
    expect(result.current.detection).toBe(MotionDetectionStatus.OFF);
    expect(result.current.reduction).toBe(MotionReductionStatus.DISABLED);
    expect(typeof result.current.refresh).toBe('function');

    await waitFor(() => {
      expect(result.current.detection).toBe(MotionDetectionStatus.RUNNING);
    });
    expect(result.current.reduction).toBe(MotionReductionStatus.MONITORING);
    expect(result.current.lastActivity).toEqual(activity());
    expect(getStateMock).toHaveBeenCalledTimes(1);
  });

  it('tripId filter', async () => {
    const onMotionActivity = jest.fn();
    const { result } = renderHook(() =>
      useMotionActivity({ tripId: 'trip-1', onMotionActivity })
    );
    await waitFor(() => expect(getStateMock).toHaveBeenCalledTimes(1));

    // Another trip's event is ignored and does not re-read the state.
    act(() => {
      simulateMotionActivityEvent(activity({ tripId: 'trip-2' }));
    });
    expect(result.current.lastActivity).toBeNull();
    expect(onMotionActivity).not.toHaveBeenCalled();
    expect(getStateMock).toHaveBeenCalledTimes(1);

    // The watched trip's event is kept and forwarded.
    const walking = activity({ timestamp: 1700000001000 });
    act(() => {
      simulateMotionActivityEvent(walking);
    });
    expect(result.current.lastActivity).toEqual(walking);
    expect(onMotionActivity).toHaveBeenCalledTimes(1);
    expect(onMotionActivity).toHaveBeenCalledWith(walking);
    // No state read shows trip-1 running yet, so the event re-reads it.
    expect(getStateMock).toHaveBeenCalledTimes(2);

    // A session of another trip reads as OFF for the watched trip, and its
    // last activity is not adopted.
    getStateMock.mockResolvedValue(
      stateJson({
        tripId: 'trip-2',
        detection: 'RUNNING',
        reduction: 'REDUCED',
        lastActivity: activity({ tripId: 'trip-2', timestamp: 1700000009000 }),
      })
    );
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.detection).toBe(MotionDetectionStatus.OFF);
    expect(result.current.reduction).toBe(MotionReductionStatus.DISABLED);
    expect(result.current.lastActivity).toEqual(walking);

    // The watched trip's session is mirrored.
    getStateMock.mockResolvedValue(
      stateJson({
        tripId: 'trip-1',
        detection: 'RUNNING',
        reduction: 'REDUCED',
        lastActivity: activity({
          activity: MotionActivityType.STATIONARY,
          timestamp: 1700000009000,
        }),
      })
    );
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.detection).toBe(MotionDetectionStatus.RUNNING);
    expect(result.current.reduction).toBe(MotionReductionStatus.REDUCED);
    expect(result.current.lastActivity?.activity).toBe(
      MotionActivityType.STATIONARY
    );
  });

  it('keeps events of every trip when tripId is omitted', async () => {
    const onMotionActivity = jest.fn();
    const { result } = renderHook(() =>
      useMotionActivity({ onMotionActivity })
    );
    await waitFor(() => expect(getStateMock).toHaveBeenCalledTimes(1));

    act(() => {
      simulateMotionActivityEvent(activity({ tripId: 'trip-1' }));
      simulateMotionActivityEvent(
        activity({ tripId: 'trip-2', activity: MotionActivityType.AUTOMOTIVE })
      );
    });

    expect(onMotionActivity).toHaveBeenCalledTimes(2);
    expect(result.current.lastActivity?.tripId).toBe('trip-2');
    expect(result.current.lastActivity?.activity).toBe(
      MotionActivityType.AUTOMOTIVE
    );
  });

  it('calls the latest onMotionActivity callback without re-subscribing', async () => {
    const first = jest.fn();
    const second = jest.fn();
    const { rerender } = renderHook(
      ({ callback }: { callback: (event: MotionActivityEvent) => void }) =>
        useMotionActivity({ onMotionActivity: callback }),
      { initialProps: { callback: first } }
    );
    await waitFor(() => expect(getStateMock).toHaveBeenCalledTimes(1));

    rerender({ callback: second });
    act(() => {
      simulateMotionActivityEvent(activity());
    });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith(activity());
    // One emitter for the warnings and one for the motion events.
    expect(NativeEventEmitter).toHaveBeenCalledTimes(2);
  });

  it('refreshes on each MOTION_* warning and not on others', async () => {
    const { result } = renderHook(() => useMotionActivity());
    await waitFor(() => expect(getStateMock).toHaveBeenCalledTimes(1));

    const otherWarnings: LocationWarningType[] = [
      'SERVICE_TIMEOUT',
      'TASK_REMOVED',
      'LOCATION_UNAVAILABLE',
      'LOCATION_UPDATES_PAUSED',
      'LOCATION_UPDATES_RESUMED',
      'PERMISSION_REVOKED',
      'PERMISSION_DOWNGRADED',
    ];
    act(() => {
      for (const type of otherWarnings) {
        simulateWarningEvent({
          tripId: 'trip-1',
          type,
          message: type,
          timestamp: 1,
        });
      }
    });
    expect(getStateMock).toHaveBeenCalledTimes(1);

    const motionWarnings: LocationWarningType[] = [
      'MOTION_LOCATION_REDUCED',
      'MOTION_LOCATION_RESTORED',
      'MOTION_ACTIVITY_UNAVAILABLE',
      'MOTION_PERMISSION_NOT_GRANTED',
    ];
    getStateMock.mockResolvedValue(
      stateJson({
        tripId: 'trip-1',
        detection: 'RUNNING',
        reduction: 'REDUCED',
      })
    );
    for (const [index, type] of motionWarnings.entries()) {
      await act(async () => {
        simulateWarningEvent({
          tripId: 'trip-1',
          type,
          message: type,
          timestamp: 1,
        });
      });
      expect(getStateMock).toHaveBeenCalledTimes(index + 2);
    }
    await waitFor(() => {
      expect(result.current.reduction).toBe(MotionReductionStatus.REDUCED);
    });
  });

  it('AppState active refresh', async () => {
    const { result } = renderHook(() => useMotionActivity());
    await waitFor(() => expect(getStateMock).toHaveBeenCalledTimes(1));
    expect(AppState.addEventListener).toHaveBeenCalledWith(
      'change',
      expect.any(Function)
    );

    act(() => {
      simulateAppStateChange('background');
      simulateAppStateChange('inactive');
    });
    expect(getStateMock).toHaveBeenCalledTimes(1);

    getStateMock.mockResolvedValue(
      stateJson({
        tripId: 'trip-1',
        detection: 'PERMISSION_NOT_GRANTED',
        reduction: 'UNAVAILABLE',
      })
    );
    await act(async () => {
      simulateAppStateChange('active');
    });
    expect(getStateMock).toHaveBeenCalledTimes(2);
    await waitFor(() => {
      expect(result.current.detection).toBe(
        MotionDetectionStatus.PERMISSION_NOT_GRANTED
      );
    });
    expect(result.current.reduction).toBe(MotionReductionStatus.UNAVAILABLE);
  });

  it('cleanup on unmount', async () => {
    const { unmount } = renderHook(() => useMotionActivity());
    await waitFor(() => expect(getStateMock).toHaveBeenCalledTimes(1));

    const subscriptions = emitterSubscriptions();
    const appStateSubscriptions = getAppStateSubscriptions();
    expect(subscriptions).toHaveLength(2);
    expect(appStateSubscriptions).toHaveLength(1);

    unmount();

    for (const subscription of [...subscriptions, ...appStateSubscriptions]) {
      expect(subscription.remove).toHaveBeenCalledTimes(1);
    }
  });

  it('module missing → defaults', async () => {
    nativeModule.isTracking = undefined;

    const { result } = renderHook(() =>
      useMotionActivity({ tripId: 'trip-1' })
    );

    expect(result.current.lastActivity).toBeNull();
    expect(result.current.detection).toBe(MotionDetectionStatus.OFF);
    expect(result.current.reduction).toBe(MotionReductionStatus.DISABLED);
    expect(getStateMock).not.toHaveBeenCalled();
    expect(NativeEventEmitter).not.toHaveBeenCalled();
    expect(AppState.addEventListener).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();

    // A manual refresh warns once and keeps the OFF state.
    await act(async () => {
      await result.current.refresh();
    });
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(getStateMock).not.toHaveBeenCalled();
    expect(result.current.detection).toBe(MotionDetectionStatus.OFF);
    expect(result.current.reduction).toBe(MotionReductionStatus.DISABLED);
  });

  it('logs a failed refresh and keeps the previous state', async () => {
    getStateMock.mockResolvedValueOnce(
      stateJson({
        tripId: 'trip-1',
        detection: 'RUNNING',
        reduction: 'MONITORING',
      })
    );
    const { result } = renderHook(() => useMotionActivity());
    await waitFor(() =>
      expect(result.current.detection).toBe(MotionDetectionStatus.RUNNING)
    );

    const failure = new Error('native failure');
    getStateMock.mockRejectedValueOnce(failure);
    await act(async () => {
      await result.current.refresh();
    });

    expect(console.error).toHaveBeenCalledWith(
      'Error refreshing motion activity state:',
      failure
    );
    expect(result.current.detection).toBe(MotionDetectionStatus.RUNNING);
    expect(result.current.reduction).toBe(MotionReductionStatus.MONITORING);
  });

  it('applies only the most recent refresh', async () => {
    const mountRefresh = deferred<string>();
    getStateMock.mockReturnValueOnce(mountRefresh.promise);
    getStateMock.mockResolvedValueOnce(
      stateJson({
        tripId: 'trip-1',
        detection: 'RUNNING',
        reduction: 'REDUCED',
      })
    );

    const { result } = renderHook(() => useMotionActivity());
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.reduction).toBe(MotionReductionStatus.REDUCED);

    // The older mount request completes last and is ignored.
    await act(async () => {
      mountRefresh.resolve(
        stateJson({
          tripId: 'trip-1',
          detection: 'RUNNING',
          reduction: 'MONITORING',
        })
      );
      await mountRefresh.promise;
    });
    expect(result.current.reduction).toBe(MotionReductionStatus.REDUCED);
  });

  it('never replaces a newer event with an older hydrated activity', async () => {
    const mountRefresh = deferred<string>();
    const eventRefresh = deferred<string>();
    getStateMock
      .mockReturnValueOnce(mountRefresh.promise)
      .mockReturnValueOnce(eventRefresh.promise);

    const { result } = renderHook(() => useMotionActivity());

    // The event arrives while the mount request is in flight. No state read
    // shows its trip running yet, so it re-reads the state.
    const newer = activity({
      activity: MotionActivityType.AUTOMOTIVE,
      timestamp: 1700000005000,
    });
    act(() => {
      simulateMotionActivityEvent(newer);
    });
    expect(getStateMock).toHaveBeenCalledTimes(2);

    await act(async () => {
      eventRefresh.resolve(
        stateJson({
          tripId: 'trip-1',
          detection: 'RUNNING',
          reduction: 'MONITORING',
          lastActivity: activity({ timestamp: 1700000001000 }),
        })
      );
      await eventRefresh.promise;
    });
    expect(result.current.detection).toBe(MotionDetectionStatus.RUNNING);
    expect(result.current.lastActivity).toEqual(newer);

    // The older mount request completes last and is ignored.
    await act(async () => {
      mountRefresh.resolve(OFF_JSON);
      await mountRefresh.promise;
    });
    expect(result.current.detection).toBe(MotionDetectionStatus.RUNNING);
    expect(result.current.lastActivity).toEqual(newer);

    // A hydrated activity newer than the current one replaces it.
    const latest = activity({
      activity: MotionActivityType.STATIONARY,
      timestamp: 1700000009000,
    });
    getStateMock.mockResolvedValueOnce(
      stateJson({
        tripId: 'trip-1',
        detection: 'RUNNING',
        reduction: 'MONITORING',
        lastActivity: latest,
      })
    );
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.lastActivity).toEqual(latest);
  });

  it('resets lastActivity and re-hydrates when tripId changes', async () => {
    // The session already reads RUNNING, so the trip's events do not re-read it.
    getStateMock.mockResolvedValue(
      stateJson({
        tripId: 'trip-1',
        detection: 'RUNNING',
        reduction: 'DISABLED',
      })
    );
    const { result, rerender } = renderHook(
      ({ tripId }: { tripId?: string }) => useMotionActivity({ tripId }),
      { initialProps: { tripId: 'trip-1' } as { tripId?: string } }
    );
    await waitFor(() => {
      expect(result.current.detection).toBe(MotionDetectionStatus.RUNNING);
    });

    act(() => {
      simulateMotionActivityEvent(activity());
    });
    expect(result.current.lastActivity).toEqual(activity());
    expect(getStateMock).toHaveBeenCalledTimes(1);

    getStateMock.mockResolvedValue(
      stateJson({
        tripId: 'trip-2',
        detection: 'RUNNING',
        reduction: 'MONITORING',
      })
    );
    rerender({ tripId: 'trip-2' });

    expect(result.current.lastActivity).toBeNull();
    await waitFor(() => {
      expect(result.current.reduction).toBe(MotionReductionStatus.MONITORING);
    });
    expect(getStateMock).toHaveBeenCalledTimes(2);

    // Same tripId: no reset and no extra hydration.
    rerender({ tripId: 'trip-2' });
    expect(getStateMock).toHaveBeenCalledTimes(2);
  });

  it('refreshes once per trip when an event arrives before the state shows the trip running', async () => {
    const onMotionActivity = jest.fn();
    const { result } = renderHook(() =>
      useMotionActivity({ onMotionActivity })
    );
    await waitFor(() => expect(getStateMock).toHaveBeenCalledTimes(1));

    // Hydration read OFF (for example before the session started). The first
    // events of trip-1 re-read the state once, even before that read returns.
    getStateMock.mockResolvedValue(
      stateJson({
        tripId: 'trip-1',
        detection: 'RUNNING',
        reduction: 'MONITORING',
      })
    );
    act(() => {
      simulateMotionActivityEvent(activity());
      simulateMotionActivityEvent(
        activity({
          activity: MotionActivityType.RUNNING,
          timestamp: 1700000001000,
        })
      );
    });
    expect(getStateMock).toHaveBeenCalledTimes(2);
    expect(onMotionActivity).toHaveBeenCalledTimes(2);
    await waitFor(() => {
      expect(result.current.detection).toBe(MotionDetectionStatus.RUNNING);
    });
    expect(result.current.reduction).toBe(MotionReductionStatus.MONITORING);

    // Later events of trip-1 do not re-read it.
    act(() => {
      simulateMotionActivityEvent(
        activity({
          activity: MotionActivityType.STATIONARY,
          timestamp: 1700000002000,
        })
      );
    });
    expect(getStateMock).toHaveBeenCalledTimes(2);

    // Another trip re-reads once, and only once even when that read does not
    // show it running.
    getStateMock.mockResolvedValue(OFF_JSON);
    await act(async () => {
      simulateMotionActivityEvent(
        activity({ tripId: 'trip-2', timestamp: 1700000003000 })
      );
    });
    expect(getStateMock).toHaveBeenCalledTimes(3);
    await waitFor(() => {
      expect(result.current.detection).toBe(MotionDetectionStatus.OFF);
    });

    act(() => {
      simulateMotionActivityEvent(
        activity({
          tripId: 'trip-2',
          activity: MotionActivityType.AUTOMOTIVE,
          timestamp: 1700000004000,
        })
      );
    });
    expect(getStateMock).toHaveBeenCalledTimes(3);
    expect(onMotionActivity).toHaveBeenCalledTimes(5);
    expect(result.current.lastActivity?.activity).toBe(
      MotionActivityType.AUTOMOTIVE
    );
  });

  it('skips automatic refreshes and logs once per JS session when the native build lacks getMotionActivityState', async () => {
    // The message is module-scoped (once per JS session); this is the only
    // test in this file that reaches it.
    const nativeBuildMessage =
      '[BackgroundLocation] motion activity is not available in this native build; rebuild the app to use it.';
    // The module is linked, but the native build predates the motion methods.
    nativeModule.checkMotionPermission = undefined;
    nativeModule.requestMotionPermission = undefined;
    nativeModule.getMotionActivityState = undefined;

    const first = renderHook(() => useMotionActivity());
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(nativeBuildMessage);

    // Foreground, MOTION_* warning and event refreshes are skipped silently.
    // A refresh that ran would warn through getMotionActivityState().
    await act(async () => {
      simulateAppStateChange('active');
      simulateWarningEvent({
        tripId: 'trip-1',
        type: 'MOTION_ACTIVITY_UNAVAILABLE',
        message: 'MOTION_ACTIVITY_UNAVAILABLE',
        timestamp: 1,
      });
      simulateMotionActivityEvent(activity());
    });
    expect(first.result.current.lastActivity).toEqual(activity());

    // Another hook instance does not log it again.
    const second = renderHook(() => useMotionActivity({ tripId: 'trip-1' }));
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(getStateMock).not.toHaveBeenCalled();
    expect(first.result.current.detection).toBe(MotionDetectionStatus.OFF);
    expect(second.result.current.detection).toBe(MotionDetectionStatus.OFF);

    // A manual refresh keeps its behaviour: the generic warning and the OFF
    // state.
    await act(async () => {
      await first.result.current.refresh();
    });
    expect(console.warn).toHaveBeenCalledTimes(2);
    expect(console.warn).toHaveBeenLastCalledWith(
      'BackgroundLocation not available - running in simulator or module not linked?'
    );
    expect(
      (console.warn as jest.Mock).mock.calls.filter(
        ([text]) => text === nativeBuildMessage
      )
    ).toHaveLength(1);
    expect(first.result.current.detection).toBe(MotionDetectionStatus.OFF);
    expect(first.result.current.reduction).toBe(MotionReductionStatus.DISABLED);
  });
});
