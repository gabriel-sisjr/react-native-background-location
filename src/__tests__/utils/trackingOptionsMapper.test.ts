import { toTrackingOptionsSpec } from '../../utils/trackingOptionsMapper';
import { LocationAccuracy, NotificationPriority } from '../../types/enums';
import type { TrackingOptions } from '../../types';

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
});
