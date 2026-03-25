import {
  addGeofence,
  addGeofences,
  removeGeofence,
  removeGeofences,
  removeAllGeofences,
  getActiveGeofences,
  getMaxGeofences,
  getGeofenceTransitions,
  clearGeofenceTransitions,
  GeofenceError,
  GeofenceErrorCode,
  GeofenceTransitionType,
} from '../../index';
import BackgroundLocationModule from '../../NativeBackgroundLocation';
import type { GeofenceRegion } from '../../types/geofencing';

describe('Geofencing API', () => {
  const validRegion: GeofenceRegion = {
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
    (BackgroundLocationModule.addGeofence as jest.Mock).mockResolvedValue(
      undefined
    );
    (BackgroundLocationModule.addGeofences as jest.Mock).mockResolvedValue(
      undefined
    );
    (BackgroundLocationModule.removeGeofence as jest.Mock).mockResolvedValue(
      undefined
    );
    (BackgroundLocationModule.removeGeofences as jest.Mock).mockResolvedValue(
      undefined
    );
    (
      BackgroundLocationModule.removeAllGeofences as jest.Mock
    ).mockResolvedValue(undefined);
    (BackgroundLocationModule.getMaxGeofences as jest.Mock).mockResolvedValue(
      100
    );
    (
      BackgroundLocationModule.getGeofenceTransitions as jest.Mock
    ).mockResolvedValue(JSON.stringify([]));
    (
      BackgroundLocationModule.clearGeofenceTransitions as jest.Mock
    ).mockResolvedValue(undefined);
  });

  describe('GeofenceError', () => {
    it('should be an instance of Error', () => {
      const error = new GeofenceError(GeofenceErrorCode.INVALID_REGION, 'test');
      expect(error).toBeInstanceOf(Error);
    });

    it('should have correct name property', () => {
      const error = new GeofenceError(GeofenceErrorCode.INVALID_REGION, 'test');
      expect(error.name).toBe('GeofenceError');
    });

    it('should have correct code property', () => {
      const error = new GeofenceError(
        GeofenceErrorCode.DUPLICATE_IDENTIFIER,
        'dup'
      );
      expect(error.code).toBe(GeofenceErrorCode.DUPLICATE_IDENTIFIER);
    });

    it('should have correct message', () => {
      const error = new GeofenceError(
        GeofenceErrorCode.LIMIT_EXCEEDED,
        'limit'
      );
      expect(error.message).toBe('limit');
    });

    it('should work with instanceof checks', () => {
      const error = new GeofenceError(GeofenceErrorCode.NOT_AVAILABLE, 'test');
      expect(error instanceof GeofenceError).toBe(true);
      expect(error instanceof Error).toBe(true);
    });
  });

  describe('addGeofence', () => {
    it('should call native module with serialized region', async () => {
      await addGeofence(validRegion);
      expect(BackgroundLocationModule.addGeofence).toHaveBeenCalledTimes(1);
      const jsonArg = (BackgroundLocationModule.addGeofence as jest.Mock).mock
        .calls[0][0];
      const parsed = JSON.parse(jsonArg);
      expect(parsed.identifier).toBe('office');
      expect(parsed.latitude).toBe(-23.5505);
      expect(parsed.longitude).toBe(-46.6333);
      expect(parsed.radius).toBe(200);
    });

    it('should apply default transitionTypes [ENTER, EXIT]', async () => {
      await addGeofence(validRegion);
      const jsonArg = (BackgroundLocationModule.addGeofence as jest.Mock).mock
        .calls[0][0];
      const parsed = JSON.parse(jsonArg);
      expect(parsed.transitionTypes).toEqual(['ENTER', 'EXIT']);
    });

    it('should apply default loiteringDelay of 30000ms', async () => {
      await addGeofence(validRegion);
      const jsonArg = (BackgroundLocationModule.addGeofence as jest.Mock).mock
        .calls[0][0];
      const parsed = JSON.parse(jsonArg);
      expect(parsed.loiteringDelay).toBe(30000);
    });

    it('should serialize metadata as JSON string', async () => {
      const region = {
        ...validRegion,
        metadata: { zone: 'office', floor: 3 },
      };
      await addGeofence(region);
      const jsonArg = (BackgroundLocationModule.addGeofence as jest.Mock).mock
        .calls[0][0];
      const parsed = JSON.parse(jsonArg);
      expect(parsed.metadata).toBe(
        JSON.stringify({ zone: 'office', floor: 3 })
      );
    });

    it('should throw GeofenceError with DUPLICATE_IDENTIFIER when geofence exists', async () => {
      (
        BackgroundLocationModule.getActiveGeofences as jest.Mock
      ).mockResolvedValue(JSON.stringify([validRegion]));
      try {
        await addGeofence(validRegion);
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(GeofenceError);
        expect((error as GeofenceError).code).toBe(
          GeofenceErrorCode.DUPLICATE_IDENTIFIER
        );
      }
    });

    it('should not call native addGeofence when duplicate exists', async () => {
      (
        BackgroundLocationModule.getActiveGeofences as jest.Mock
      ).mockResolvedValue(JSON.stringify([validRegion]));
      try {
        await addGeofence(validRegion);
      } catch {
        // expected
      }
      expect(BackgroundLocationModule.addGeofence).not.toHaveBeenCalled();
    });
  });

  describe('addGeofences', () => {
    it('should call native module with serialized array', async () => {
      const regions = [
        validRegion,
        {
          ...validRegion,
          identifier: 'home',
          latitude: -22.9068,
          longitude: -43.1729,
        },
      ];
      await addGeofences(regions);
      expect(BackgroundLocationModule.addGeofences).toHaveBeenCalledTimes(1);
      const jsonArg = (BackgroundLocationModule.addGeofences as jest.Mock).mock
        .calls[0][0];
      const parsed = JSON.parse(jsonArg);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].identifier).toBe('office');
      expect(parsed[1].identifier).toBe('home');
    });

    it('should throw GeofenceError for duplicate identifiers in batch', async () => {
      const regions = [validRegion, { ...validRegion }];
      try {
        await addGeofences(regions);
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(GeofenceError);
        expect((error as GeofenceError).code).toBe(
          GeofenceErrorCode.DUPLICATE_IDENTIFIER
        );
      }
    });

    it('should validate all regions before sending', async () => {
      const regions = [
        validRegion,
        { ...validRegion, identifier: 'bad', latitude: 999 },
      ];
      await expect(addGeofences(regions)).rejects.toThrow(
        '[BackgroundLocation] Invalid latitude'
      );
      expect(BackgroundLocationModule.addGeofences).not.toHaveBeenCalled();
    });
  });

  describe('removeGeofence', () => {
    it('should call native module with identifier', async () => {
      await removeGeofence('office');
      expect(BackgroundLocationModule.removeGeofence).toHaveBeenCalledWith(
        'office'
      );
    });
  });

  describe('removeGeofences', () => {
    it('should call native module with serialized identifiers', async () => {
      await removeGeofences(['office', 'home']);
      expect(BackgroundLocationModule.removeGeofences).toHaveBeenCalledWith(
        JSON.stringify(['office', 'home'])
      );
    });
  });

  describe('removeAllGeofences', () => {
    it('should call native module', async () => {
      await removeAllGeofences();
      expect(BackgroundLocationModule.removeAllGeofences).toHaveBeenCalledTimes(
        1
      );
    });
  });

  describe('getActiveGeofences', () => {
    it('should parse JSON response into GeofenceRegion[]', async () => {
      const mockGeofences = [
        validRegion,
        { ...validRegion, identifier: 'home' },
      ];
      (
        BackgroundLocationModule.getActiveGeofences as jest.Mock
      ).mockResolvedValue(JSON.stringify(mockGeofences));
      const result = await getActiveGeofences();
      expect(result).toHaveLength(2);
      expect(result[0]!.identifier).toBe('office');
      expect(result[1]!.identifier).toBe('home');
    });

    it('should return empty array when no geofences', async () => {
      const result = await getActiveGeofences();
      expect(result).toEqual([]);
    });
  });

  describe('getMaxGeofences', () => {
    it('should return numeric result from native', async () => {
      (BackgroundLocationModule.getMaxGeofences as jest.Mock).mockResolvedValue(
        20
      );
      const result = await getMaxGeofences();
      expect(result).toBe(20);
    });
  });

  describe('getGeofenceTransitions', () => {
    it('should parse JSON response into GeofenceTransitionEvent[]', async () => {
      const mockTransitions = [
        {
          geofenceId: 'office',
          transitionType: GeofenceTransitionType.ENTER,
          latitude: -23.5505,
          longitude: -46.6333,
          timestamp: '2024-01-01T00:00:00Z',
          distanceFromCenter: 50,
        },
      ];
      (
        BackgroundLocationModule.getGeofenceTransitions as jest.Mock
      ).mockResolvedValue(JSON.stringify(mockTransitions));
      const result = await getGeofenceTransitions();
      expect(result).toHaveLength(1);
      expect(result[0]!.geofenceId).toBe('office');
      expect(result[0]!.transitionType).toBe(GeofenceTransitionType.ENTER);
    });

    it('should pass identifier filter to native', async () => {
      await getGeofenceTransitions('office');
      expect(
        BackgroundLocationModule.getGeofenceTransitions
      ).toHaveBeenCalledWith('office');
    });

    it('should pass undefined when no filter', async () => {
      await getGeofenceTransitions();
      expect(
        BackgroundLocationModule.getGeofenceTransitions
      ).toHaveBeenCalledWith(undefined);
    });
  });

  describe('clearGeofenceTransitions', () => {
    it('should call native with identifier', async () => {
      await clearGeofenceTransitions('office');
      expect(
        BackgroundLocationModule.clearGeofenceTransitions
      ).toHaveBeenCalledWith('office');
    });

    it('should call native without identifier', async () => {
      await clearGeofenceTransitions();
      expect(
        BackgroundLocationModule.clearGeofenceTransitions
      ).toHaveBeenCalledWith(undefined);
    });
  });
});
