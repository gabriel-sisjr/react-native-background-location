import { toTrackingOptionsSpec } from '../../utils/trackingOptionsMapper';
import { toMotionSpecFields } from '../../utils/motionOptionsMapper';
import {
  LocationAccuracy,
  LocationActivityType,
  NotificationPriority,
} from '../../types/enums';
import type { TrackingOptions } from '../../types';
import type { TrackingOptionsSpec } from '../../NativeBackgroundLocation';

/**
 * Frozen copy of the mapper as it was before motion activity existed. The
 * feature-off output must stay identical to it.
 */
function legacyToTrackingOptionsSpec(
  options?: TrackingOptions | null
): TrackingOptionsSpec {
  if (!options) {
    return {};
  }
  return {
    updateInterval: options.updateInterval,
    fastestInterval: options.fastestInterval,
    maxWaitTime: options.maxWaitTime,
    accuracy: options.accuracy ? String(options.accuracy) : undefined,
    activityType: options.activityType
      ? String(options.activityType)
      : undefined,
    waitForAccurateLocation: options.waitForAccurateLocation,
    foregroundOnly: options.foregroundOnly,
    distanceFilter: options.distanceFilter,
    notificationOptions: options.notificationOptions
      ? JSON.stringify(options.notificationOptions)
      : undefined,
  };
}

const motionKeysOf = (spec: TrackingOptionsSpec): string[] =>
  Object.keys(spec).filter((key) => key.startsWith('motion'));

/** Casts deliberately malformed input past the public type. */
const asOptions = (value: unknown): TrackingOptions => value as TrackingOptions;

describe('trackingOptionsMapper', () => {
  describe('toTrackingOptionsSpec', () => {
    it('returns an empty object when input is undefined', () => {
      const result = toTrackingOptionsSpec(undefined);

      expect(result).toBeDefined();
      expect(result).not.toBeNull();
      expect(typeof result).toBe('object');
      expect(result).toEqual({});
    });

    it('returns an empty object when input is null', () => {
      const result = toTrackingOptionsSpec(null);

      expect(result).toBeDefined();
      expect(result).not.toBeNull();
      expect(typeof result).toBe('object');
      expect(result).toEqual({});
    });

    it('returns an empty object when no argument is provided', () => {
      const result = toTrackingOptionsSpec();

      expect(result).toBeDefined();
      expect(result).not.toBeNull();
      expect(typeof result).toBe('object');
      expect(result).toEqual({});
    });

    it('handles an empty options object', () => {
      const result = toTrackingOptionsSpec({});

      expect(result).toBeDefined();
      expect(result).toEqual({
        updateInterval: undefined,
        fastestInterval: undefined,
        maxWaitTime: undefined,
        accuracy: undefined,
        waitForAccurateLocation: undefined,
        foregroundOnly: undefined,
        distanceFilter: undefined,
        notificationOptions: undefined,
      });
    });

    it('maps a fully populated options object correctly through the enum-to-string conversion', () => {
      const options: TrackingOptions = {
        updateInterval: 5000,
        fastestInterval: 2500,
        maxWaitTime: 10000,
        accuracy: LocationAccuracy.HIGH_ACCURACY,
        waitForAccurateLocation: true,
        foregroundOnly: false,
        distanceFilter: 10,
        notificationOptions: {
          title: 'Tracking',
          text: 'Trip in progress',
          priority: NotificationPriority.HIGH,
        },
      };

      const result = toTrackingOptionsSpec(options);

      expect(result).toEqual({
        updateInterval: 5000,
        fastestInterval: 2500,
        maxWaitTime: 10000,
        accuracy: 'HIGH_ACCURACY',
        waitForAccurateLocation: true,
        foregroundOnly: false,
        distanceFilter: 10,
        notificationOptions: JSON.stringify({
          title: 'Tracking',
          text: 'Trip in progress',
          priority: NotificationPriority.HIGH,
        }),
      });
    });

    it('converts the LocationAccuracy enum value to a string for Codegen compatibility', () => {
      const result = toTrackingOptionsSpec({
        accuracy: LocationAccuracy.BALANCED_POWER_ACCURACY,
      });

      expect(result.accuracy).toBe('BALANCED_POWER_ACCURACY');
      expect(typeof result.accuracy).toBe('string');
    });

    it('JSON-stringifies notificationOptions when provided', () => {
      const notificationOptions = {
        title: 'Hello',
        text: 'World',
        priority: NotificationPriority.DEFAULT,
      };

      const result = toTrackingOptionsSpec({ notificationOptions });

      expect(typeof result.notificationOptions).toBe('string');
      expect(result.notificationOptions).toBe(
        JSON.stringify(notificationOptions)
      );
    });

    it('leaves notificationOptions undefined when omitted', () => {
      const result = toTrackingOptionsSpec({
        accuracy: LocationAccuracy.LOW_POWER,
      });

      expect(result.notificationOptions).toBeUndefined();
    });

    it('preserves distanceFilter when explicitly set to 0', () => {
      // 0 is a valid distance filter (emit every update). Must not be
      // collapsed to undefined by truthy checks.
      const result = toTrackingOptionsSpec({ distanceFilter: 0 });

      expect(result.distanceFilter).toBe(0);
    });
  });

  describe('activityType mapping', () => {
    it('leaves activityType undefined when omitted from options', () => {
      const result = toTrackingOptionsSpec({});

      expect(result.activityType).toBeUndefined();
    });

    it('maps LocationActivityType.OTHER to the string "OTHER"', () => {
      const result = toTrackingOptionsSpec({
        activityType: LocationActivityType.OTHER,
      });

      expect(result.activityType).toBe('OTHER');
      expect(typeof result.activityType).toBe('string');
    });

    it('maps LocationActivityType.AUTOMOTIVE_NAVIGATION to the string "AUTOMOTIVE_NAVIGATION"', () => {
      const result = toTrackingOptionsSpec({
        activityType: LocationActivityType.AUTOMOTIVE_NAVIGATION,
      });

      expect(result.activityType).toBe('AUTOMOTIVE_NAVIGATION');
      expect(typeof result.activityType).toBe('string');
    });

    it('leaves activityType undefined when explicitly set to undefined', () => {
      const result = toTrackingOptionsSpec({ activityType: undefined });

      expect(result.activityType).toBeUndefined();
    });

    it('maps accuracy, distanceFilter, and activityType together when all are provided', () => {
      const options: TrackingOptions = {
        accuracy: LocationAccuracy.HIGH_ACCURACY,
        distanceFilter: 10,
        activityType: LocationActivityType.FITNESS,
      };

      const result = toTrackingOptionsSpec(options);

      expect(result.accuracy).toBe('HIGH_ACCURACY');
      expect(result.distanceFilter).toBe(10);
      expect(result.activityType).toBe('FITNESS');
    });
  });

  describe('motionActivity mapping', () => {
    const LEGACY_OPTION_SETS: Array<[string, TrackingOptions]> = [
      ['an empty object', {}],
      [
        'a fully populated object',
        {
          updateInterval: 5000,
          fastestInterval: 2500,
          maxWaitTime: 10000,
          accuracy: LocationAccuracy.HIGH_ACCURACY,
          activityType: LocationActivityType.AUTOMOTIVE_NAVIGATION,
          waitForAccurateLocation: true,
          foregroundOnly: false,
          distanceFilter: 10,
          onUpdateInterval: 30000,
          notificationOptions: {
            title: 'Tracking',
            text: 'Trip in progress',
            priority: NotificationPriority.HIGH,
            actions: [{ id: 'stop', label: 'Stop' }],
          },
        },
      ],
      ['zero and false values', { distanceFilter: 0, foregroundOnly: false }],
      [
        'a foreground-only low-power trip',
        { accuracy: LocationAccuracy.LOW_POWER, foregroundOnly: true },
      ],
      ['a passive trip', { accuracy: LocationAccuracy.PASSIVE }],
    ];

    it('omits every motion key when motionActivity is absent', () => {
      for (const [label, options] of LEGACY_OPTION_SETS) {
        const expected = legacyToTrackingOptionsSpec(options);

        const absent = toTrackingOptionsSpec(options);
        expect({ label, spec: absent }).toStrictEqual({
          label,
          spec: expected,
        });
        expect(motionKeysOf(absent)).toEqual([]);

        const explicitlyUndefined = toTrackingOptionsSpec({
          ...options,
          motionActivity: undefined,
        });
        expect({ label, spec: explicitlyUndefined }).toStrictEqual({
          label,
          spec: expected,
        });

        const disabled = toTrackingOptionsSpec({
          ...options,
          motionActivity: false,
        });
        expect({ label, spec: disabled }).toStrictEqual({
          label,
          spec: expected,
        });
        expect(motionKeysOf(disabled)).toEqual([]);
      }
      expect(console.warn).not.toHaveBeenCalled();
    });

    it('maps true / {} to motionActivityEnabled only', () => {
      expect(toMotionSpecFields(true)).toStrictEqual({
        motionActivityEnabled: true,
      });
      expect(toMotionSpecFields({})).toStrictEqual({
        motionActivityEnabled: true,
      });

      const spec = toTrackingOptionsSpec({
        accuracy: LocationAccuracy.HIGH_ACCURACY,
        motionActivity: true,
      });
      expect(spec.motionActivityEnabled).toBe(true);
      expect(spec.accuracy).toBe('HIGH_ACCURACY');
      expect(motionKeysOf(spec)).toEqual(['motionActivityEnabled']);
      expect(
        motionKeysOf(toTrackingOptionsSpec({ motionActivity: {} }))
      ).toEqual(['motionActivityEnabled']);
      expect(console.warn).not.toHaveBeenCalled();
    });

    it('maps reduceWhenStationary true without options', () => {
      expect(
        toTrackingOptionsSpec({
          motionActivity: { reduceWhenStationary: true },
        })
      ).toMatchObject({
        motionActivityEnabled: true,
        motionReduceWhenStationary: true,
      });
      expect(
        motionKeysOf(
          toTrackingOptionsSpec({
            motionActivity: { reduceWhenStationary: true },
          })
        ).sort()
      ).toEqual(['motionActivityEnabled', 'motionReduceWhenStationary']);
      expect(toMotionSpecFields({ reduceWhenStationary: {} })).toStrictEqual({
        motionActivityEnabled: true,
        motionReduceWhenStationary: true,
      });
      expect(toMotionSpecFields({ reduceWhenStationary: false })).toStrictEqual(
        { motionActivityEnabled: true }
      );
      expect(console.warn).not.toHaveBeenCalled();
    });

    it('forwards clamped integer options', () => {
      expect(
        toMotionSpecFields({
          sampleInterval: 45000,
          reduceWhenStationary: {
            stationaryDelay: 240000,
            automotiveCooldown: 900000,
            maxReducedDuration: 1200000,
          },
        })
      ).toStrictEqual({
        motionActivityEnabled: true,
        motionSampleInterval: 45000,
        motionReduceWhenStationary: true,
        motionStationaryDelay: 240000,
        motionAutomotiveCooldown: 900000,
        motionMaxReducedDuration: 1200000,
      });

      // Below the range: clamped to the minimum.
      expect(
        toMotionSpecFields({
          sampleInterval: 1,
          reduceWhenStationary: {
            stationaryDelay: 0,
            automotiveCooldown: -5,
            maxReducedDuration: 1,
          },
        })
      ).toStrictEqual({
        motionActivityEnabled: true,
        motionSampleInterval: 10000,
        motionReduceWhenStationary: true,
        motionStationaryDelay: 60000,
        motionAutomotiveCooldown: 120000,
        motionMaxReducedDuration: 300000,
      });

      // Above the range: clamped to the maximum.
      expect(
        toMotionSpecFields({
          sampleInterval: Number.MAX_SAFE_INTEGER,
          reduceWhenStationary: {
            stationaryDelay: 1e12,
            automotiveCooldown: 3600001,
            maxReducedDuration: 7200000,
          },
        })
      ).toStrictEqual({
        motionActivityEnabled: true,
        motionSampleInterval: 300000,
        motionReduceWhenStationary: true,
        motionStationaryDelay: 3600000,
        motionAutomotiveCooldown: 3600000,
        motionMaxReducedDuration: 3600000,
      });

      // Fractional values: rounded to whole milliseconds.
      expect(
        toMotionSpecFields({
          sampleInterval: 12345.6,
          reduceWhenStationary: {
            stationaryDelay: 300000.4,
            automotiveCooldown: 600000.5,
          },
        })
      ).toStrictEqual({
        motionActivityEnabled: true,
        motionSampleInterval: 12346,
        motionReduceWhenStationary: true,
        motionStationaryDelay: 300000,
        motionAutomotiveCooldown: 600001,
      });
      expect(console.warn).not.toHaveBeenCalled();
    });

    it('drops a malformed sampleInterval and keeps detection', () => {
      const malformedValues: unknown[] = [
        NaN,
        Infinity,
        -Infinity,
        '30000',
        true,
        { ms: 30000 },
      ];
      for (const sampleInterval of malformedValues) {
        const spec = toTrackingOptionsSpec(
          asOptions({
            motionActivity: { sampleInterval, reduceWhenStationary: true },
          })
        );
        expect(spec.motionActivityEnabled).toBe(true);
        expect(spec.motionReduceWhenStationary).toBe(true);
        expect('motionSampleInterval' in spec).toBe(false);

        expect(
          toMotionSpecFields({ sampleInterval, reduceWhenStationary: true })
        ).toStrictEqual({
          motionActivityEnabled: true,
          motionReduceWhenStationary: true,
        });
      }
    });

    it('turns reduction off when a reduction option is malformed', () => {
      const fields = [
        'stationaryDelay',
        'automotiveCooldown',
        'maxReducedDuration',
      ];
      const malformedValues: unknown[] = [NaN, Infinity, '300000', true];

      for (const field of fields) {
        for (const malformed of malformedValues) {
          const result = toMotionSpecFields({
            sampleInterval: 20000,
            reduceWhenStationary: {
              stationaryDelay: 400000,
              automotiveCooldown: 700000,
              maxReducedDuration: 1000000,
              notificationText: 'Parked',
              [field]: malformed,
            },
          });

          // Detection stays on; every reduction key is gone (continuous GPS).
          expect({ field, malformed, result }).toStrictEqual({
            field,
            malformed,
            result: {
              motionActivityEnabled: true,
              motionSampleInterval: 20000,
            },
          });
        }
      }
    });

    it('treats null options as absent', () => {
      expect(toTrackingOptionsSpec(null)).toEqual({});
      expect(
        motionKeysOf(toTrackingOptionsSpec(asOptions({ motionActivity: null })))
      ).toEqual([]);
      expect(
        toMotionSpecFields({ sampleInterval: null, reduceWhenStationary: null })
      ).toStrictEqual({ motionActivityEnabled: true });
      expect(
        toMotionSpecFields({
          reduceWhenStationary: {
            stationaryDelay: null,
            automotiveCooldown: null,
            maxReducedDuration: null,
            notificationText: null,
          },
        })
      ).toStrictEqual({
        motionActivityEnabled: true,
        motionReduceWhenStationary: true,
      });
      expect(console.warn).not.toHaveBeenCalled();
    });

    it('ignores motionActivity values that are neither boolean nor object', () => {
      const values: unknown[] = [1, 'true', [true], () => true, new Date(0)];
      for (const motionActivity of values) {
        const spec = toTrackingOptionsSpec(
          asOptions({ distanceFilter: 5, motionActivity })
        );

        expect(motionKeysOf(spec)).toEqual([]);
        expect(spec).toStrictEqual(
          legacyToTrackingOptionsSpec({ distanceFilter: 5 })
        );
      }
    });

    it('omits reduceWhenStationary values that are neither boolean nor object', () => {
      const values: unknown[] = ['yes', 1, [{ stationaryDelay: 60000 }]];
      for (const reduceWhenStationary of values) {
        expect(toMotionSpecFields({ reduceWhenStationary })).toStrictEqual({
          motionActivityEnabled: true,
        });
      }
    });

    it('forwards notificationText only when non-blank', () => {
      expect(
        toMotionSpecFields({
          reduceWhenStationary: {
            notificationText: ' Parked: saving battery ',
          },
        })
      ).toStrictEqual({
        motionActivityEnabled: true,
        motionReduceWhenStationary: true,
        motionReducedNotificationText: ' Parked: saving battery ',
      });

      for (const blank of ['', '   ', '\n\t']) {
        expect(
          toMotionSpecFields({
            reduceWhenStationary: { notificationText: blank },
          })
        ).toStrictEqual({
          motionActivityEnabled: true,
          motionReduceWhenStationary: true,
        });
      }
      // Blank values are dropped silently.
      expect(console.warn).not.toHaveBeenCalled();

      // A non-string is dropped too; the reduction itself stays on.
      expect(
        toMotionSpecFields({
          reduceWhenStationary: { notificationText: 42 },
        })
      ).toStrictEqual({
        motionActivityEnabled: true,
        motionReduceWhenStationary: true,
      });
    });

    describe('dev warnings', () => {
      const originalDev = (global as any).__DEV__;

      afterEach(() => {
        (global as any).__DEV__ = originalDev;
      });

      /** A mapper with a fresh once-per-field registry. */
      const loadIsolatedMapper = (): typeof toMotionSpecFields => {
        let isolated: typeof toMotionSpecFields | undefined;
        jest.isolateModules(() => {
          isolated = require('../../utils/motionOptionsMapper')
            .toMotionSpecFields as typeof toMotionSpecFields;
        });
        if (!isolated) {
          throw new Error('mapper not loaded');
        }
        return isolated;
      };

      const MALFORMED_EVERYWHERE: Array<[unknown, string]> = [
        [
          'yes',
          '[BackgroundLocation] motionActivity must be a boolean or an object; motion activity is disabled.',
        ],
        [
          { sampleInterval: NaN },
          '[BackgroundLocation] motionActivity.sampleInterval must be a finite number of milliseconds; the default is used.',
        ],
        [
          { reduceWhenStationary: 'yes' },
          '[BackgroundLocation] motionActivity.reduceWhenStationary must be a boolean or an object; reduceWhenStationary is disabled.',
        ],
        [
          { reduceWhenStationary: { stationaryDelay: '300000' } },
          '[BackgroundLocation] motionActivity.reduceWhenStationary.stationaryDelay must be a finite number of milliseconds; reduceWhenStationary is disabled.',
        ],
        [
          { reduceWhenStationary: { automotiveCooldown: Infinity } },
          '[BackgroundLocation] motionActivity.reduceWhenStationary.automotiveCooldown must be a finite number of milliseconds; reduceWhenStationary is disabled.',
        ],
        [
          { reduceWhenStationary: { maxReducedDuration: true } },
          '[BackgroundLocation] motionActivity.reduceWhenStationary.maxReducedDuration must be a finite number of milliseconds; reduceWhenStationary is disabled.',
        ],
        [
          { reduceWhenStationary: { notificationText: 42 } },
          '[BackgroundLocation] motionActivity.reduceWhenStationary.notificationText must be a string; the default notification text is used.',
        ],
      ];

      it('warns once per field in __DEV__ and never in production', () => {
        (global as any).__DEV__ = true;
        const devMapper = loadIsolatedMapper();

        for (const [value, message] of MALFORMED_EVERYWHERE) {
          devMapper(value);
          // A second call with the same malformed field does not warn again.
          devMapper(value);
          expect(
            (console.warn as jest.Mock).mock.calls.filter(
              ([text]) => text === message
            )
          ).toHaveLength(1);
        }
        expect(console.warn).toHaveBeenCalledTimes(MALFORMED_EVERYWHERE.length);

        // Two malformed reduction fields in one call: one warning each.
        (console.warn as jest.Mock).mockClear();
        const freshDevMapper = loadIsolatedMapper();
        freshDevMapper({
          reduceWhenStationary: {
            stationaryDelay: NaN,
            maxReducedDuration: NaN,
          },
        });
        expect(console.warn).toHaveBeenCalledTimes(2);

        (console.warn as jest.Mock).mockClear();
        (global as any).__DEV__ = false;
        const productionMapper = loadIsolatedMapper();
        for (const [value] of MALFORMED_EVERYWHERE) {
          productionMapper(value);
        }
        expect(console.warn).not.toHaveBeenCalled();
      });
    });
  });
});
