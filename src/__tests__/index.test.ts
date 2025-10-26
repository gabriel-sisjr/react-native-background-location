import { NativeModules, Platform } from 'react-native';
import BackgroundLocation from '../index';
import BackgroundLocationModule from '../NativeBackgroundLocation';

// Mock do módulo nativo
jest.mock('../NativeBackgroundLocation', () => ({
  __esModule: true,
  default: {
    startTracking: jest.fn(),
    stopTracking: jest.fn(),
    isTracking: jest.fn(),
    getLocations: jest.fn(),
    clearTrip: jest.fn(),
  },
}));

describe('BackgroundLocation API', () => {
  const mockTripId = 'test-trip-123';
  const mockLocations = [
    { latitude: '37.7749', longitude: '-122.4194', timestamp: 1640995200000 },
    { latitude: '37.7849', longitude: '-122.4094', timestamp: 1640995260000 },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    // Ensure we have a mock native module
    NativeModules.BackgroundLocation = {
      startTracking: jest.fn(),
      stopTracking: jest.fn(),
      isTracking: jest.fn(),
      getLocations: jest.fn(),
      clearTrip: jest.fn(),
    };
    Platform.OS = 'android';
    console.warn = jest.fn();
  });

  describe('startTracking', () => {
    it('should start tracking with custom trip ID when module is available', async () => {
      (BackgroundLocationModule.startTracking as jest.Mock).mockResolvedValue(
        mockTripId
      );

      const result = await BackgroundLocation.startTracking(mockTripId);

      expect(result).toBe(mockTripId);
      expect(BackgroundLocationModule.startTracking).toHaveBeenCalledWith(
        mockTripId
      );
      expect(console.warn).not.toHaveBeenCalled();
    });

    it('should start tracking and generate trip ID when not provided', async () => {
      const generatedId = 'generated-trip-456';
      (BackgroundLocationModule.startTracking as jest.Mock).mockResolvedValue(
        generatedId
      );

      const result = await BackgroundLocation.startTracking();

      expect(result).toBe(generatedId);
      expect(BackgroundLocationModule.startTracking).toHaveBeenCalledWith(
        undefined
      );
    });

    it('should handle simulator mode gracefully', async () => {
      NativeModules.BackgroundLocation = null;

      const result = await BackgroundLocation.startTracking();

      expect(result).toMatch(/^simulator-trip-\d+$/);
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('BackgroundLocation not available')
      );
    });

    it('should use provided trip ID in simulator mode', async () => {
      NativeModules.BackgroundLocation = null;

      const result = await BackgroundLocation.startTracking(mockTripId);

      expect(result).toBe(mockTripId);
      expect(console.warn).toHaveBeenCalled();
    });

    it('should handle empty string trip ID', async () => {
      (BackgroundLocationModule.startTracking as jest.Mock).mockResolvedValue(
        'new-trip-id'
      );

      const result = await BackgroundLocation.startTracking('');

      expect(result).toBe('new-trip-id');
      expect(BackgroundLocationModule.startTracking).toHaveBeenCalledWith('');
    });

    it('should propagate errors from native module', async () => {
      const error = new Error('Permission denied');
      (BackgroundLocationModule.startTracking as jest.Mock).mockRejectedValue(
        error
      );

      await expect(BackgroundLocation.startTracking()).rejects.toThrow(
        'Permission denied'
      );
    });
  });

  describe('stopTracking', () => {
    it('should stop tracking when module is available', async () => {
      (BackgroundLocationModule.stopTracking as jest.Mock).mockResolvedValue(
        undefined
      );

      await BackgroundLocation.stopTracking();

      expect(BackgroundLocationModule.stopTracking).toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    it('should handle simulator mode gracefully', async () => {
      NativeModules.BackgroundLocation = null;

      await BackgroundLocation.stopTracking();

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('BackgroundLocation not available')
      );
    });

    it('should propagate errors from native module', async () => {
      const error = new Error('Failed to stop');
      (BackgroundLocationModule.stopTracking as jest.Mock).mockRejectedValue(
        error
      );

      await expect(BackgroundLocation.stopTracking()).rejects.toThrow(
        'Failed to stop'
      );
    });
  });

  describe('isTracking', () => {
    it('should return tracking status when module is available', async () => {
      const mockStatus = { active: true, tripId: mockTripId };
      (BackgroundLocationModule.isTracking as jest.Mock).mockResolvedValue(
        mockStatus
      );

      const result = await BackgroundLocation.isTracking();

      expect(result).toEqual(mockStatus);
      expect(BackgroundLocationModule.isTracking).toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    it('should return inactive status in simulator mode', async () => {
      NativeModules.BackgroundLocation = null;

      const result = await BackgroundLocation.isTracking();

      expect(result).toEqual({ active: false });
      expect(console.warn).toHaveBeenCalled();
    });

    it('should handle inactive tracking', async () => {
      const mockStatus = { active: false, tripId: undefined };
      (BackgroundLocationModule.isTracking as jest.Mock).mockResolvedValue(
        mockStatus
      );

      const result = await BackgroundLocation.isTracking();

      expect(result).toEqual(mockStatus);
    });

    it('should propagate errors from native module', async () => {
      const error = new Error('Failed to check status');
      (BackgroundLocationModule.isTracking as jest.Mock).mockRejectedValue(
        error
      );

      await expect(BackgroundLocation.isTracking()).rejects.toThrow(
        'Failed to check status'
      );
    });
  });

  describe('getLocations', () => {
    it('should return locations when module is available', async () => {
      (BackgroundLocationModule.getLocations as jest.Mock).mockResolvedValue(
        mockLocations
      );

      const result = await BackgroundLocation.getLocations(mockTripId);

      expect(result).toEqual(mockLocations);
      expect(BackgroundLocationModule.getLocations).toHaveBeenCalledWith(
        mockTripId
      );
      expect(console.warn).not.toHaveBeenCalled();
    });

    it('should return empty array in simulator mode', async () => {
      NativeModules.BackgroundLocation = null;

      const result = await BackgroundLocation.getLocations(mockTripId);

      expect(result).toEqual([]);
      expect(console.warn).toHaveBeenCalled();
    });

    it('should handle empty locations array', async () => {
      (BackgroundLocationModule.getLocations as jest.Mock).mockResolvedValue(
        []
      );

      const result = await BackgroundLocation.getLocations(mockTripId);

      expect(result).toEqual([]);
    });

    it('should handle non-existent trip', async () => {
      (BackgroundLocationModule.getLocations as jest.Mock).mockResolvedValue(
        []
      );

      const result = await BackgroundLocation.getLocations('non-existent');

      expect(result).toEqual([]);
      expect(BackgroundLocationModule.getLocations).toHaveBeenCalledWith(
        'non-existent'
      );
    });

    it('should propagate errors from native module', async () => {
      const error = new Error('Failed to get locations');
      (BackgroundLocationModule.getLocations as jest.Mock).mockRejectedValue(
        error
      );

      await expect(BackgroundLocation.getLocations(mockTripId)).rejects.toThrow(
        'Failed to get locations'
      );
    });
  });

  describe('clearTrip', () => {
    it('should clear trip data when module is available', async () => {
      (BackgroundLocationModule.clearTrip as jest.Mock).mockResolvedValue(
        undefined
      );

      await BackgroundLocation.clearTrip(mockTripId);

      expect(BackgroundLocationModule.clearTrip).toHaveBeenCalledWith(
        mockTripId
      );
      expect(console.warn).not.toHaveBeenCalled();
    });

    it('should handle simulator mode gracefully', async () => {
      NativeModules.BackgroundLocation = null;

      await BackgroundLocation.clearTrip(mockTripId);

      expect(console.warn).toHaveBeenCalled();
    });

    it('should propagate errors from native module', async () => {
      const error = new Error('Failed to clear trip');
      (BackgroundLocationModule.clearTrip as jest.Mock).mockRejectedValue(
        error
      );

      await expect(BackgroundLocation.clearTrip(mockTripId)).rejects.toThrow(
        'Failed to clear trip'
      );
    });
  });

  describe('Platform detection', () => {
    it('should work on Android platform', async () => {
      Platform.OS = 'android';
      (BackgroundLocationModule.startTracking as jest.Mock).mockResolvedValue(
        mockTripId
      );

      const result = await BackgroundLocation.startTracking();

      expect(result).toBe(mockTripId);
    });

    it('should handle iOS platform (not available)', async () => {
      Platform.OS = 'ios';
      NativeModules.BackgroundLocation = null;

      const result = await BackgroundLocation.startTracking();

      expect(result).toMatch(/^simulator-trip-\d+$/);
      expect(console.warn).toHaveBeenCalled();
    });
  });

  describe('Module availability', () => {
    it('should detect when module is available', async () => {
      (BackgroundLocationModule.isTracking as jest.Mock).mockResolvedValue({
        active: true,
        tripId: mockTripId,
      });

      expect(NativeModules.BackgroundLocation).toBeDefined();

      await BackgroundLocation.isTracking();

      expect(BackgroundLocationModule.isTracking).toHaveBeenCalled();
    });

    it('should detect when module is not available', async () => {
      NativeModules.BackgroundLocation = null;

      const result = await BackgroundLocation.isTracking();

      expect(result).toEqual({ active: false });
      expect(console.warn).toHaveBeenCalled();
    });
  });
});
