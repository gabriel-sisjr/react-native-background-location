import { NativeEventEmitter, PermissionsAndroid, Platform } from 'react-native';
import {
  addMotionActivityListener,
  checkMotionPermission,
  getMotionActivityState,
  requestMotionPermission,
} from '../../motion';
import * as publicApi from '../../index';
import BackgroundLocationModule from '../../NativeBackgroundLocation';
import {
  MotionActivityType,
  MotionConfidence,
  MotionDetectionStatus,
  MotionPermissionStatus,
  MotionReductionStatus,
} from '../../types/enums';
import type { MotionActivityEvent, MotionActivityState } from '../../types';

const NOT_AVAILABLE =
  'BackgroundLocation not available - running in simulator or module not linked?';

const OFF_STATE: MotionActivityState = {
  tripId: null,
  detection: MotionDetectionStatus.OFF,
  reduction: MotionReductionStatus.DISABLED,
  lastActivity: null,
};

const ACTIVITY: MotionActivityEvent = {
  tripId: 'trip-1',
  activity: MotionActivityType.WALKING,
  confidence: MotionConfidence.HIGH,
  timestamp: 1700000000000,
};

type MutableModule = Record<string, unknown>;
const nativeModule = BackgroundLocationModule as unknown as MutableModule;
const originalNativeModule: MutableModule = { ...nativeModule };

const nativeMock = (
  name:
    | 'checkMotionPermission'
    | 'requestMotionPermission'
    | 'getMotionActivityState'
): jest.Mock => BackgroundLocationModule[name] as unknown as jest.Mock;

const setAndroidApiLevel = (apiLevel: number): void => {
  Object.defineProperty(Platform, 'Version', {
    get: () => apiLevel,
    configurable: true,
  });
};

/** Subscriptions returned by every NativeEventEmitter created in the test. */
const emitterSubscriptions = (): Array<{ remove: jest.Mock }> =>
  (NativeEventEmitter as unknown as jest.Mock).mock.results.flatMap((emitter) =>
    (emitter.value.addListener as jest.Mock).mock.results.map(
      (result) => result.value as { remove: jest.Mock }
    )
  );

describe('motion activity API', () => {
  beforeEach(() => {
    Object.assign(nativeModule, originalNativeModule);
    Platform.OS = 'android';
    setAndroidApiLevel(30);
    nativeMock('checkMotionPermission').mockReset();
    nativeMock('requestMotionPermission').mockReset();
    nativeMock('getMotionActivityState').mockReset();
    (PermissionsAndroid.request as jest.Mock).mockReset();
  });

  afterAll(() => {
    Object.assign(nativeModule, originalNativeModule);
    Platform.OS = 'android';
    setAndroidApiLevel(30);
  });

  it('exports the motion API and enums from the package entry point', () => {
    expect(publicApi.addMotionActivityListener).toBe(addMotionActivityListener);
    expect(publicApi.checkMotionPermission).toBe(checkMotionPermission);
    expect(publicApi.requestMotionPermission).toBe(requestMotionPermission);
    expect(publicApi.getMotionActivityState).toBe(getMotionActivityState);
    expect(typeof publicApi.useMotionActivity).toBe('function');

    expect(publicApi.MotionActivityType).toBe(MotionActivityType);
    expect(publicApi.MotionConfidence).toBe(MotionConfidence);
    expect(publicApi.MotionPermissionStatus).toBe(MotionPermissionStatus);
    expect(publicApi.MotionDetectionStatus).toBe(MotionDetectionStatus);
    expect(publicApi.MotionReductionStatus).toBe(MotionReductionStatus);
  });

  it('defines the enum values used on the bridge', () => {
    expect(Object.values(MotionActivityType)).toEqual([
      'STATIONARY',
      'WALKING',
      'RUNNING',
      'CYCLING',
      'AUTOMOTIVE',
      'UNKNOWN',
    ]);
    expect(Object.values(MotionConfidence)).toEqual(['LOW', 'MEDIUM', 'HIGH']);
    expect(Object.values(MotionPermissionStatus)).toEqual([
      'granted',
      'denied',
      'undetermined',
      'unavailable',
    ]);
    expect(Object.values(MotionDetectionStatus)).toEqual([
      'OFF',
      'RUNNING',
      'UNAVAILABLE',
      'PERMISSION_NOT_GRANTED',
    ]);
    expect(Object.values(MotionReductionStatus)).toEqual([
      'DISABLED',
      'NOT_APPLICABLE',
      'UNAVAILABLE',
      'MONITORING',
      'REDUCED',
    ]);
  });

  describe('checkMotionPermission', () => {
    it('check maps every string and unknown → UNAVAILABLE', async () => {
      const cases: Array<[string, MotionPermissionStatus]> = [
        ['granted', MotionPermissionStatus.GRANTED],
        ['denied', MotionPermissionStatus.DENIED],
        ['undetermined', MotionPermissionStatus.UNDETERMINED],
        ['unavailable', MotionPermissionStatus.UNAVAILABLE],
        ['restricted', MotionPermissionStatus.UNAVAILABLE],
        ['', MotionPermissionStatus.UNAVAILABLE],
      ];

      for (const [nativeStatus, expected] of cases) {
        nativeMock('checkMotionPermission').mockResolvedValueOnce(nativeStatus);
        await expect(checkMotionPermission()).resolves.toBe(expected);
      }
      expect(nativeMock('checkMotionPermission')).toHaveBeenCalledTimes(
        cases.length
      );
      expect(PermissionsAndroid.request).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });
  });

  describe('requestMotionPermission', () => {
    it('request on Android ≥ 29 calls PermissionsAndroid.request(ACTIVITY_RECOGNITION) and maps granted/denied/never_ask_again', async () => {
      const cases: Array<[number, string, string, MotionPermissionStatus]> = [
        [30, 'denied', 'granted', MotionPermissionStatus.GRANTED],
        [29, 'denied', 'granted', MotionPermissionStatus.GRANTED],
        [34, 'denied', 'denied', MotionPermissionStatus.DENIED],
        [34, 'denied', 'never_ask_again', MotionPermissionStatus.DENIED],
        [34, 'undetermined', 'granted', MotionPermissionStatus.GRANTED],
      ];

      for (const [apiLevel, checked, requested, expected] of cases) {
        setAndroidApiLevel(apiLevel);
        nativeMock('checkMotionPermission').mockResolvedValueOnce(checked);
        (PermissionsAndroid.request as jest.Mock).mockResolvedValueOnce(
          requested
        );

        await expect(requestMotionPermission()).resolves.toBe(expected);
      }

      expect(PermissionsAndroid.request).toHaveBeenCalledTimes(cases.length);
      for (const call of (PermissionsAndroid.request as jest.Mock).mock.calls) {
        expect(call).toEqual(['android.permission.ACTIVITY_RECOGNITION']);
      }
      // The native module never prompts on Android.
      expect(nativeMock('requestMotionPermission')).not.toHaveBeenCalled();
    });

    it('Android 28 does not request', async () => {
      setAndroidApiLevel(28);

      nativeMock('checkMotionPermission').mockResolvedValueOnce('denied');
      await expect(requestMotionPermission()).resolves.toBe(
        MotionPermissionStatus.DENIED
      );

      nativeMock('checkMotionPermission').mockResolvedValueOnce('granted');
      await expect(requestMotionPermission()).resolves.toBe(
        MotionPermissionStatus.GRANTED
      );

      expect(PermissionsAndroid.request).not.toHaveBeenCalled();
      expect(nativeMock('requestMotionPermission')).not.toHaveBeenCalled();
    });

    it('granted/unavailable checks do not request', async () => {
      setAndroidApiLevel(34);

      nativeMock('checkMotionPermission').mockResolvedValueOnce('granted');
      await expect(requestMotionPermission()).resolves.toBe(
        MotionPermissionStatus.GRANTED
      );

      nativeMock('checkMotionPermission').mockResolvedValueOnce('unavailable');
      await expect(requestMotionPermission()).resolves.toBe(
        MotionPermissionStatus.UNAVAILABLE
      );

      expect(PermissionsAndroid.request).not.toHaveBeenCalled();
      expect(nativeMock('requestMotionPermission')).not.toHaveBeenCalled();
    });

    it('iOS calls native', async () => {
      Platform.OS = 'ios';
      const cases: Array<[string, MotionPermissionStatus]> = [
        ['granted', MotionPermissionStatus.GRANTED],
        ['denied', MotionPermissionStatus.DENIED],
        ['undetermined', MotionPermissionStatus.UNDETERMINED],
        ['unavailable', MotionPermissionStatus.UNAVAILABLE],
      ];

      for (const [nativeStatus, expected] of cases) {
        nativeMock('requestMotionPermission').mockResolvedValueOnce(
          nativeStatus
        );
        await expect(requestMotionPermission()).resolves.toBe(expected);
      }

      expect(nativeMock('requestMotionPermission')).toHaveBeenCalledTimes(
        cases.length
      );
      expect(nativeMock('checkMotionPermission')).not.toHaveBeenCalled();
      expect(PermissionsAndroid.request).not.toHaveBeenCalled();
    });
  });

  describe('getMotionActivityState', () => {
    it('state JSON parse and malformed → OFF', async () => {
      const resolveState = async (json: string) => {
        nativeMock('getMotionActivityState').mockResolvedValueOnce(json);
        return getMotionActivityState();
      };

      // A complete snapshot.
      await expect(
        resolveState(
          JSON.stringify({
            tripId: 'trip-1',
            detection: 'RUNNING',
            reduction: 'REDUCED',
            lastActivity: ACTIVITY,
          })
        )
      ).resolves.toEqual({
        tripId: 'trip-1',
        detection: MotionDetectionStatus.RUNNING,
        reduction: MotionReductionStatus.REDUCED,
        lastActivity: ACTIVITY,
      });

      // The OFF snapshot itself, and a session without events yet.
      await expect(resolveState(JSON.stringify(OFF_STATE))).resolves.toEqual(
        OFF_STATE
      );
      await expect(
        resolveState(
          JSON.stringify({
            tripId: 'trip-2',
            detection: 'PERMISSION_NOT_GRANTED',
            reduction: 'UNAVAILABLE',
            lastActivity: null,
          })
        )
      ).resolves.toEqual({
        tripId: 'trip-2',
        detection: MotionDetectionStatus.PERMISSION_NOT_GRANTED,
        reduction: MotionReductionStatus.UNAVAILABLE,
        lastActivity: null,
      });

      // A non-string tripId is reported as null.
      await expect(
        resolveState(
          JSON.stringify({
            tripId: 42,
            detection: 'UNAVAILABLE',
            reduction: 'DISABLED',
            lastActivity: null,
          })
        )
      ).resolves.toEqual({
        ...OFF_STATE,
        detection: MotionDetectionStatus.UNAVAILABLE,
      });

      // Unparsable or wrongly shaped snapshots give the OFF state.
      const malformedSnapshots = [
        'not json',
        '',
        'null',
        '[]',
        '"RUNNING"',
        '42',
        JSON.stringify({ detection: 'SLEEPING', reduction: 'DISABLED' }),
        JSON.stringify({ detection: 'RUNNING', reduction: 'PAUSED' }),
        JSON.stringify({ detection: 'RUNNING' }),
        JSON.stringify({ tripId: 'trip-1', lastActivity: ACTIVITY }),
      ];
      for (const json of malformedSnapshots) {
        await expect(resolveState(json)).resolves.toEqual(OFF_STATE);
      }

      // A malformed lastActivity is dropped; the rest of the state is kept.
      const malformedActivities: unknown[] = [
        'WALKING',
        [ACTIVITY],
        { ...ACTIVITY, tripId: 7 },
        { ...ACTIVITY, activity: 'SWIMMING' },
        { ...ACTIVITY, confidence: 'CERTAIN' },
        { ...ACTIVITY, timestamp: '1700000000000' },
      ];
      for (const lastActivity of malformedActivities) {
        await expect(
          resolveState(
            JSON.stringify({
              tripId: 'trip-1',
              detection: 'RUNNING',
              reduction: 'MONITORING',
              lastActivity,
            })
          )
        ).resolves.toEqual({
          tripId: 'trip-1',
          detection: MotionDetectionStatus.RUNNING,
          reduction: MotionReductionStatus.MONITORING,
          lastActivity: null,
        });
      }

      // A non-finite timestamp (1e999 parses to Infinity) is dropped as well.
      await expect(
        resolveState(
          '{"tripId":"trip-1","detection":"RUNNING","reduction":"MONITORING",' +
            '"lastActivity":{"tripId":"trip-1","activity":"WALKING","confidence":"LOW","timestamp":1e999}}'
        )
      ).resolves.toEqual({
        tripId: 'trip-1',
        detection: MotionDetectionStatus.RUNNING,
        reduction: MotionReductionStatus.MONITORING,
        lastActivity: null,
      });

      expect(console.warn).not.toHaveBeenCalled();
    });

    it('returns a fresh OFF state object on every call', async () => {
      nativeMock('getMotionActivityState').mockResolvedValue('not json');

      const first = await getMotionActivityState();
      const second = await getMotionActivityState();

      expect(first).toEqual(OFF_STATE);
      expect(second).toEqual(OFF_STATE);
      expect(first).not.toBe(second);
    });
  });

  describe('addMotionActivityListener', () => {
    it('listener delivery and remove()', () => {
      const listener = jest.fn();

      const subscription = addMotionActivityListener(listener);

      expect(NativeEventEmitter).toHaveBeenCalledWith(BackgroundLocationModule);
      const [emitter] = (NativeEventEmitter as unknown as jest.Mock).mock
        .results;
      expect(emitter?.value.addListener).toHaveBeenCalledWith(
        'onMotionActivity',
        expect.any(Function)
      );

      (global as any).simulateMotionActivityEvent(ACTIVITY);
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(ACTIVITY);

      const [nativeSubscription] = emitterSubscriptions();
      subscription.remove();
      subscription.remove();
      expect(nativeSubscription?.remove).toHaveBeenCalledTimes(1);
    });
  });

  describe('module missing', () => {
    it('module missing → fallbacks plus a warning', async () => {
      nativeModule.isTracking = undefined;

      const listener = jest.fn();
      const subscription = addMotionActivityListener(listener);
      expect(() => subscription.remove()).not.toThrow();
      expect(NativeEventEmitter).not.toHaveBeenCalled();
      (global as any).simulateMotionActivityEvent(ACTIVITY);
      expect(listener).not.toHaveBeenCalled();

      await expect(checkMotionPermission()).resolves.toBe(
        MotionPermissionStatus.UNAVAILABLE
      );
      await expect(requestMotionPermission()).resolves.toBe(
        MotionPermissionStatus.UNAVAILABLE
      );
      Platform.OS = 'ios';
      await expect(requestMotionPermission()).resolves.toBe(
        MotionPermissionStatus.UNAVAILABLE
      );
      await expect(getMotionActivityState()).resolves.toEqual(OFF_STATE);

      expect(console.warn).toHaveBeenCalledTimes(5);
      for (const call of (console.warn as jest.Mock).mock.calls) {
        expect(call).toEqual([NOT_AVAILABLE]);
      }
      expect(nativeMock('checkMotionPermission')).not.toHaveBeenCalled();
      expect(nativeMock('requestMotionPermission')).not.toHaveBeenCalled();
      expect(nativeMock('getMotionActivityState')).not.toHaveBeenCalled();
      expect(PermissionsAndroid.request).not.toHaveBeenCalled();
    });

    it('treats a native build without the motion methods as missing', async () => {
      nativeModule.checkMotionPermission = undefined;
      nativeModule.requestMotionPermission = undefined;
      nativeModule.getMotionActivityState = undefined;

      await expect(checkMotionPermission()).resolves.toBe(
        MotionPermissionStatus.UNAVAILABLE
      );
      // Android needs the native check before prompting.
      await expect(requestMotionPermission()).resolves.toBe(
        MotionPermissionStatus.UNAVAILABLE
      );
      Platform.OS = 'ios';
      await expect(requestMotionPermission()).resolves.toBe(
        MotionPermissionStatus.UNAVAILABLE
      );
      await expect(getMotionActivityState()).resolves.toEqual(OFF_STATE);

      expect(console.warn).toHaveBeenCalledTimes(4);
      expect(console.warn).toHaveBeenCalledWith(NOT_AVAILABLE);
      expect(PermissionsAndroid.request).not.toHaveBeenCalled();
    });
  });
});
