import { addGeofence } from '../../index';
import BackgroundLocationModule from '../../NativeBackgroundLocation';

describe('Geofence Region Validation', () => {
  const validRegion = {
    identifier: 'test-region',
    latitude: -23.5505,
    longitude: -46.6333,
    radius: 200,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock getActiveGeofences to return empty (no duplicates)
    (
      BackgroundLocationModule.getActiveGeofences as jest.Mock
    ).mockResolvedValue(JSON.stringify([]));
    (BackgroundLocationModule.addGeofence as jest.Mock).mockResolvedValue(
      undefined
    );
  });

  describe('identifier validation', () => {
    it('should reject empty identifier', async () => {
      await expect(
        addGeofence({ ...validRegion, identifier: '' })
      ).rejects.toThrow('[BackgroundLocation] Geofence identifier is required');
    });

    it('should reject whitespace-only identifier', async () => {
      await expect(
        addGeofence({ ...validRegion, identifier: '   ' })
      ).rejects.toThrow('[BackgroundLocation] Geofence identifier is required');
    });

    it('should accept valid identifier', async () => {
      await expect(addGeofence(validRegion)).resolves.toBeUndefined();
    });
  });

  describe('latitude validation', () => {
    it('should reject latitude < -90', async () => {
      await expect(
        addGeofence({ ...validRegion, latitude: -91 })
      ).rejects.toThrow('[BackgroundLocation] Invalid latitude');
    });

    it('should reject latitude > 90', async () => {
      await expect(
        addGeofence({ ...validRegion, latitude: 91 })
      ).rejects.toThrow('[BackgroundLocation] Invalid latitude');
    });

    it('should accept latitude exactly -90', async () => {
      await expect(
        addGeofence({ ...validRegion, latitude: -90 })
      ).resolves.toBeUndefined();
    });

    it('should accept latitude exactly 90', async () => {
      await expect(
        addGeofence({ ...validRegion, latitude: 90 })
      ).resolves.toBeUndefined();
    });
  });

  describe('longitude validation', () => {
    it('should reject longitude < -180', async () => {
      await expect(
        addGeofence({ ...validRegion, longitude: -181 })
      ).rejects.toThrow('[BackgroundLocation] Invalid longitude');
    });

    it('should reject longitude > 180', async () => {
      await expect(
        addGeofence({ ...validRegion, longitude: 181 })
      ).rejects.toThrow('[BackgroundLocation] Invalid longitude');
    });

    it('should accept longitude exactly -180', async () => {
      await expect(
        addGeofence({ ...validRegion, longitude: -180 })
      ).resolves.toBeUndefined();
    });

    it('should accept longitude exactly 180', async () => {
      await expect(
        addGeofence({ ...validRegion, longitude: 180 })
      ).resolves.toBeUndefined();
    });
  });

  describe('radius validation', () => {
    it('should reject radius < 100', async () => {
      await expect(addGeofence({ ...validRegion, radius: 50 })).rejects.toThrow(
        '[BackgroundLocation] Invalid radius'
      );
    });

    it('should accept radius exactly 100', async () => {
      await expect(
        addGeofence({ ...validRegion, radius: 100 })
      ).resolves.toBeUndefined();
    });
  });

  describe('loiteringDelay validation', () => {
    it('should reject negative loiteringDelay', async () => {
      await expect(
        addGeofence({ ...validRegion, loiteringDelay: -1 })
      ).rejects.toThrow('[BackgroundLocation] Invalid loiteringDelay');
    });

    it('should accept zero loiteringDelay', async () => {
      await expect(
        addGeofence({ ...validRegion, loiteringDelay: 0 })
      ).resolves.toBeUndefined();
    });

    it('should accept positive loiteringDelay', async () => {
      await expect(
        addGeofence({ ...validRegion, loiteringDelay: 5000 })
      ).resolves.toBeUndefined();
    });
  });

  describe('valid regions', () => {
    it('should accept region with only required fields', async () => {
      await expect(addGeofence(validRegion)).resolves.toBeUndefined();
    });

    it('should accept region with all optional fields', async () => {
      const { GeofenceTransitionType } = await import('../../types/geofencing');
      const fullRegion = {
        ...validRegion,
        transitionTypes: [
          GeofenceTransitionType.ENTER,
          GeofenceTransitionType.DWELL,
        ],
        loiteringDelay: 10000,
        expirationDuration: 3600000,
        metadata: { zone: 'office', floor: 3 },
      };
      await expect(addGeofence(fullRegion)).resolves.toBeUndefined();
    });
  });
});
