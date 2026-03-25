import {
  GeofenceTransitionType,
  GeofenceErrorCode,
} from '../../types/geofencing';

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
  });
});
