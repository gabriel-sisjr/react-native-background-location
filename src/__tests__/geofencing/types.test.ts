import {
  GeofenceTransitionType,
  GeofenceErrorCode,
} from '../../types/geofencing';
import { GEOFENCE_TEMPLATE_VARS } from '../../types/notifications';
import type { NotificationOptions } from '../../types/notifications';

describe('Geofencing Types', () => {
  describe('GeofenceTransitionType', () => {
    it('should have exactly 3 values', () => {
      expect(Object.keys(GeofenceTransitionType)).toHaveLength(3);
    });

    it('should have ENTER with value "ENTER"', () => {
      expect(GeofenceTransitionType.ENTER).toBe('ENTER');
    });

    it('should have EXIT with value "EXIT"', () => {
      expect(GeofenceTransitionType.EXIT).toBe('EXIT');
    });

    it('should have DWELL with value "DWELL"', () => {
      expect(GeofenceTransitionType.DWELL).toBe('DWELL');
    });

    it('should be usable as runtime values', () => {
      const types: string[] = [
        GeofenceTransitionType.ENTER,
        GeofenceTransitionType.EXIT,
        GeofenceTransitionType.DWELL,
      ];
      expect(types).toEqual(['ENTER', 'EXIT', 'DWELL']);
    });
  });

  describe('GeofenceErrorCode', () => {
    it('should have exactly 7 values', () => {
      expect(Object.keys(GeofenceErrorCode)).toHaveLength(7);
    });

    it.each([
      ['INVALID_REGION', 'INVALID_REGION'],
      ['DUPLICATE_IDENTIFIER', 'DUPLICATE_IDENTIFIER'],
      ['LIMIT_EXCEEDED', 'LIMIT_EXCEEDED'],
      ['MONITORING_FAILED', 'MONITORING_FAILED'],
      ['NOT_AVAILABLE', 'NOT_AVAILABLE'],
      ['PERMISSION_DENIED', 'PERMISSION_DENIED'],
      ['PLAY_SERVICES_UNAVAILABLE', 'PLAY_SERVICES_UNAVAILABLE'],
    ])('should have %s with value "%s"', (key, value) => {
      expect(GeofenceErrorCode[key as keyof typeof GeofenceErrorCode]).toBe(
        value
      );
    });
  });

  describe('NotificationOptions', () => {
    it('should accept minimal config (enabled only)', () => {
      const config: NotificationOptions = { enabled: false };
      expect(config.enabled).toBe(false);
    });

    it('should accept full config with all fields', () => {
      const config: NotificationOptions = {
        enabled: true,
        title: 'Zone Alert',
        text: 'You entered a zone',
        channelName: 'Geofence Alerts',
        channelId: 'geofence_alerts',
        priority: 'HIGH' as any,
        smallIcon: 'ic_notification',
        largeIcon: 'ic_large',
        color: '#FF5722',
        showTimestamp: true,
        subtext: 'Geofencing active',
        actions: [{ id: 'dismiss', label: 'Dismiss' }],
      };
      expect(config.title).toBe('Zone Alert');
      expect(config.actions).toHaveLength(1);
    });

    it('should accept template variables in title and text', () => {
      const config: NotificationOptions = {
        title: '{{transitionType}} zone: {{identifier}}',
        text: 'At {{latitude}}, {{longitude}} (r={{radius}}) at {{timestamp}}',
      };
      expect(config.title).toContain('{{transitionType}}');
      expect(config.text).toContain('{{latitude}}');
    });
  });

  describe('GEOFENCE_TEMPLATE_VARS', () => {
    it('should have all 6 template variable constants', () => {
      expect(Object.keys(GEOFENCE_TEMPLATE_VARS)).toHaveLength(6);
    });

    it('should have correct template variable format', () => {
      expect(GEOFENCE_TEMPLATE_VARS.IDENTIFIER).toBe('{{identifier}}');
      expect(GEOFENCE_TEMPLATE_VARS.TRANSITION_TYPE).toBe('{{transitionType}}');
      expect(GEOFENCE_TEMPLATE_VARS.LATITUDE).toBe('{{latitude}}');
      expect(GEOFENCE_TEMPLATE_VARS.LONGITUDE).toBe('{{longitude}}');
      expect(GEOFENCE_TEMPLATE_VARS.RADIUS).toBe('{{radius}}');
      expect(GEOFENCE_TEMPLATE_VARS.TIMESTAMP).toBe('{{timestamp}}');
    });
  });

  describe('Type compilation checks', () => {
    it('should compile GeofenceRegion interface', () => {
      // Type-level assertion -- if this compiles, the interface shape is correct
      const region: import('../../types/geofencing').GeofenceRegion = {
        identifier: 'test',
        latitude: 0,
        longitude: 0,
        radius: 100,
      };
      expect(region.identifier).toBe('test');
    });

    it('should compile GeofenceRegion with all optional fields', () => {
      const region: import('../../types/geofencing').GeofenceRegion = {
        identifier: 'test',
        latitude: 0,
        longitude: 0,
        radius: 100,
        transitionTypes: [GeofenceTransitionType.ENTER],
        loiteringDelay: 5000,
        expirationDuration: 60000,
        metadata: { key: 'value' },
      };
      expect(region.transitionTypes).toEqual([GeofenceTransitionType.ENTER]);
    });

    it('should compile GeofenceTransitionEvent interface', () => {
      const event: import('../../types/geofencing').GeofenceTransitionEvent = {
        geofenceId: 'test',
        transitionType: GeofenceTransitionType.ENTER,
        latitude: 0,
        longitude: 0,
        timestamp: '2024-01-01T00:00:00Z',
        distanceFromCenter: 50,
      };
      expect(event.geofenceId).toBe('test');
    });

    it('should compile GeofenceRegion with notificationOptions as NotificationOptions', () => {
      const region: import('../../types/geofencing').GeofenceRegion = {
        identifier: 'test',
        latitude: 0,
        longitude: 0,
        radius: 100,
        notificationOptions: {
          enabled: true,
          title: 'Zone: {{identifier}}',
          text: '{{transitionType}} detected',
        },
      };
      expect(region.notificationOptions).toBeDefined();
      expect((region.notificationOptions as NotificationOptions).title).toBe(
        'Zone: {{identifier}}'
      );
    });

    it('should compile GeofenceRegion with notificationOptions as false', () => {
      const region: import('../../types/geofencing').GeofenceRegion = {
        identifier: 'test',
        latitude: 0,
        longitude: 0,
        radius: 100,
        notificationOptions: false,
      };
      expect(region.notificationOptions).toBe(false);
    });

    it('should compile GeofenceRegion without notificationOptions', () => {
      const region: import('../../types/geofencing').GeofenceRegion = {
        identifier: 'test',
        latitude: 0,
        longitude: 0,
        radius: 100,
      };
      expect(region.notificationOptions).toBeUndefined();
    });

    it('should compile NotificationOptions with transitionOverrides', () => {
      const options: NotificationOptions = {
        title: 'Default',
        transitionOverrides: {
          ENTER: {
            title: 'Entered {{identifier}}',
            text: 'Welcome!',
          },
          EXIT: {
            title: 'Left {{identifier}}',
          },
          DWELL: {
            title: 'Dwelling at {{identifier}}',
            text: 'You have been here a while',
            smallIcon: 'ic_dwell',
          },
        },
      };
      expect(options.transitionOverrides).toBeDefined();
      expect(options.transitionOverrides!.ENTER!.title).toBe(
        'Entered {{identifier}}'
      );
      expect(options.transitionOverrides!.EXIT!.title).toBe(
        'Left {{identifier}}'
      );
      expect(options.transitionOverrides!.DWELL!.smallIcon).toBe('ic_dwell');
    });

    it('should compile NotificationOptions with partial transitionOverrides', () => {
      const options: NotificationOptions = {
        title: 'Default',
        transitionOverrides: {
          ENTER: {
            title: 'Entered',
          },
        },
      };
      expect(options.transitionOverrides!.ENTER).toBeDefined();
      expect(options.transitionOverrides!.EXIT).toBeUndefined();
      expect(options.transitionOverrides!.DWELL).toBeUndefined();
    });

    it('should compile GeofenceRegion with notificationOptions containing transitionOverrides', () => {
      const region: import('../../types/geofencing').GeofenceRegion = {
        identifier: 'hq',
        latitude: 40.7128,
        longitude: -74.006,
        radius: 500,
        notificationOptions: {
          title: 'HQ Alert',
          text: '{{transitionType}} at HQ',
          transitionOverrides: {
            ENTER: {
              title: 'Welcome to HQ!',
              text: 'You arrived at headquarters',
            },
            EXIT: {
              title: 'Leaving HQ',
            },
          },
        },
      };
      expect(region.notificationOptions).toBeDefined();
      const opts = region.notificationOptions as NotificationOptions;
      expect(opts.transitionOverrides!.ENTER!.title).toBe('Welcome to HQ!');
    });
  });
});
