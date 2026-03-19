import { NativeModules, Platform } from 'react-native';
import BackgroundLocation, {
  LocationAccuracy,
  NotificationPriority,
} from '../index';
import BackgroundLocationModule from '../NativeBackgroundLocation';
import type { TrackingOptions } from '../types';

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

    // Ensure BackgroundLocationModule methods are properly mocked
    (BackgroundLocationModule.startTracking as jest.Mock) = jest.fn();
    (BackgroundLocationModule.stopTracking as jest.Mock) = jest.fn();
    (BackgroundLocationModule.isTracking as jest.Mock) = jest.fn();
    (BackgroundLocationModule.getLocations as jest.Mock) = jest.fn();
    (BackgroundLocationModule.clearTrip as jest.Mock) = jest.fn();
    (BackgroundLocationModule.updateNotification as jest.Mock) = jest.fn();
  });

  afterEach(() => {
    // Restore all mocks after each test
    (BackgroundLocationModule.startTracking as jest.Mock) = jest.fn();
    (BackgroundLocationModule.stopTracking as jest.Mock) = jest.fn();
    (BackgroundLocationModule.isTracking as jest.Mock) = jest.fn();
    (BackgroundLocationModule.getLocations as jest.Mock) = jest.fn();
    (BackgroundLocationModule.clearTrip as jest.Mock) = jest.fn();
    (BackgroundLocationModule.updateNotification as jest.Mock) = jest.fn();
  });

  describe('startTracking', () => {
    it('should start tracking with custom trip ID when module is available', async () => {
      (BackgroundLocationModule.startTracking as jest.Mock).mockResolvedValue(
        mockTripId
      );

      const result = await BackgroundLocation.startTracking(mockTripId);

      expect(result).toBe(mockTripId);
      expect(BackgroundLocationModule.startTracking).toHaveBeenCalledWith(
        mockTripId,
        undefined
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
        undefined,
        undefined
      );
    });

    it.skip('should handle simulator mode gracefully', async () => {
      (global as any).setModuleAvailable(false);

      const result = await BackgroundLocation.startTracking();

      expect(result).toMatch(/^simulator-trip-\d+$/);
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('BackgroundLocation not available')
      );
    });

    it.skip('should use provided trip ID in simulator mode', async () => {
      (global as any).setModuleAvailable(false);

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
      expect(BackgroundLocationModule.startTracking).toHaveBeenCalledWith(
        '',
        undefined
      );
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

    it('should start tracking with options and convert enums to strings', async () => {
      const options: TrackingOptions = {
        updateInterval: 5000,
        fastestInterval: 2000,
        maxWaitTime: 10000,
        accuracy: LocationAccuracy.HIGH_ACCURACY,
        waitForAccurateLocation: true,
        notificationTitle: 'Tracking',
        notificationText: 'Location tracking active',
        notificationChannelName: 'location',
        notificationPriority: NotificationPriority.HIGH,
      };
      (BackgroundLocationModule.startTracking as jest.Mock).mockResolvedValue(
        mockTripId
      );

      const result = await BackgroundLocation.startTracking(
        mockTripId,
        options
      );

      expect(result).toBe(mockTripId);
      expect(BackgroundLocationModule.startTracking).toHaveBeenCalledWith(
        mockTripId,
        {
          updateInterval: 5000,
          fastestInterval: 2000,
          maxWaitTime: 10000,
          accuracy: 'HIGH_ACCURACY',
          waitForAccurateLocation: true,
          notificationTitle: 'Tracking',
          notificationText: 'Location tracking active',
          notificationChannelName: 'location',
          notificationPriority: 'HIGH',
        }
      );
    });

    it('should start tracking with partial options', async () => {
      const options: TrackingOptions = {
        updateInterval: 5000,
        accuracy: LocationAccuracy.BALANCED_POWER_ACCURACY,
      };
      (BackgroundLocationModule.startTracking as jest.Mock).mockResolvedValue(
        mockTripId
      );

      const result = await BackgroundLocation.startTracking(
        mockTripId,
        options
      );

      expect(result).toBe(mockTripId);
      expect(BackgroundLocationModule.startTracking).toHaveBeenCalledWith(
        mockTripId,
        {
          updateInterval: 5000,
          accuracy: 'BALANCED_POWER_ACCURACY',
        }
      );
    });

    it('should start tracking with distanceFilter option', async () => {
      const options: TrackingOptions = {
        updateInterval: 5000,
        distanceFilter: 50,
      };
      (BackgroundLocationModule.startTracking as jest.Mock).mockResolvedValue(
        mockTripId
      );

      const result = await BackgroundLocation.startTracking(
        mockTripId,
        options
      );

      expect(result).toBe(mockTripId);
      expect(BackgroundLocationModule.startTracking).toHaveBeenCalledWith(
        mockTripId,
        expect.objectContaining({
          updateInterval: 5000,
          distanceFilter: 50,
        })
      );
    });

    it('should start tracking with options only (no tripId) - overload signature', async () => {
      const generatedId = 'generated-trip-789';
      const options: TrackingOptions = {
        updateInterval: 10000,
        distanceFilter: 100,
        notificationTitle: 'Tracking Active',
      };
      (BackgroundLocationModule.startTracking as jest.Mock).mockResolvedValue(
        generatedId
      );

      const result = await BackgroundLocation.startTracking(options);

      expect(result).toBe(generatedId);
      expect(BackgroundLocationModule.startTracking).toHaveBeenCalledWith(
        undefined,
        expect.objectContaining({
          updateInterval: 10000,
          distanceFilter: 100,
          notificationTitle: 'Tracking Active',
        })
      );
    });

    it('should handle overload with empty options object', async () => {
      const generatedId = 'generated-trip-empty';
      (BackgroundLocationModule.startTracking as jest.Mock).mockResolvedValue(
        generatedId
      );

      const result = await BackgroundLocation.startTracking({});

      expect(result).toBe(generatedId);
      expect(BackgroundLocationModule.startTracking).toHaveBeenCalledWith(
        undefined,
        {}
      );
    });

    it('should correctly identify object as options in overload', async () => {
      const generatedId = 'generated-trip-obj';
      const options: TrackingOptions = {
        accuracy: LocationAccuracy.BALANCED_POWER_ACCURACY,
        foregroundOnly: true,
      };
      (BackgroundLocationModule.startTracking as jest.Mock).mockResolvedValue(
        generatedId
      );

      const result = await BackgroundLocation.startTracking(options);

      expect(result).toBe(generatedId);
      expect(BackgroundLocationModule.startTracking).toHaveBeenCalledWith(
        undefined,
        expect.objectContaining({
          accuracy: 'BALANCED_POWER_ACCURACY',
          foregroundOnly: true,
        })
      );
    });

    it('should handle simulator mode when called with options object', async () => {
      // Mock isTracking to return undefined to simulate unavailable module
      Object.defineProperty(BackgroundLocationModule, 'isTracking', {
        value: undefined,
        configurable: true,
      });

      const options: TrackingOptions = {
        distanceFilter: 25,
      };

      const result = await BackgroundLocation.startTracking(options);

      expect(result).toMatch(/^simulator-trip-\d+$/);
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('BackgroundLocation not available')
      );

      // Restore
      Object.defineProperty(BackgroundLocationModule, 'isTracking', {
        value: jest.fn(),
        configurable: true,
      });
    });

    it('should handle simulator mode when called with string tripId', async () => {
      // Mock isTracking to return undefined to simulate unavailable module
      Object.defineProperty(BackgroundLocationModule, 'isTracking', {
        value: undefined,
        configurable: true,
      });

      const customTripId = 'my-custom-trip-123';
      const result = await BackgroundLocation.startTracking(customTripId);

      // When tripId is a string, it should return that same tripId even in simulator mode
      expect(result).toBe(customTripId);
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('BackgroundLocation not available')
      );

      // Restore
      Object.defineProperty(BackgroundLocationModule, 'isTracking', {
        value: jest.fn(),
        configurable: true,
      });
    });

    it('should start tracking with all new options including distanceFilter and onUpdateInterval', async () => {
      const options: TrackingOptions = {
        updateInterval: 5000,
        fastestInterval: 2000,
        distanceFilter: 75,
        onUpdateInterval: 30000,
        foregroundOnly: false,
      };
      (BackgroundLocationModule.startTracking as jest.Mock).mockResolvedValue(
        mockTripId
      );

      const result = await BackgroundLocation.startTracking(
        mockTripId,
        options
      );

      expect(result).toBe(mockTripId);
      // Note: onUpdateInterval is not passed to native - it's handled in TypeScript hooks
      expect(BackgroundLocationModule.startTracking).toHaveBeenCalledWith(
        mockTripId,
        expect.objectContaining({
          updateInterval: 5000,
          fastestInterval: 2000,
          distanceFilter: 75,
          foregroundOnly: false,
        })
      );
    });

    it('should start tracking with notification customization options', async () => {
      const options: TrackingOptions = {
        notificationSmallIcon: 'ic_custom_notification',
        notificationColor: '#FF5722',
        notificationShowTimestamp: true,
      };
      (BackgroundLocationModule.startTracking as jest.Mock).mockResolvedValue(
        mockTripId
      );

      const result = await BackgroundLocation.startTracking(
        mockTripId,
        options
      );

      expect(result).toBe(mockTripId);
      expect(BackgroundLocationModule.startTracking).toHaveBeenCalledWith(
        mockTripId,
        expect.objectContaining({
          notificationSmallIcon: 'ic_custom_notification',
          notificationColor: '#FF5722',
          notificationShowTimestamp: true,
        })
      );
    });

    it('should pass undefined for notification customization when not provided', async () => {
      const options: TrackingOptions = {
        updateInterval: 5000,
      };
      (BackgroundLocationModule.startTracking as jest.Mock).mockResolvedValue(
        mockTripId
      );

      await BackgroundLocation.startTracking(mockTripId, options);

      const calledOptions = (
        BackgroundLocationModule.startTracking as jest.Mock
      ).mock.calls[0]?.[1];
      expect(calledOptions?.notificationSmallIcon).toBeUndefined();
      expect(calledOptions?.notificationColor).toBeUndefined();
      expect(calledOptions?.notificationShowTimestamp).toBeUndefined();
    });

    it('should start tracking with all options including notification customization', async () => {
      const options: TrackingOptions = {
        updateInterval: 5000,
        fastestInterval: 2000,
        maxWaitTime: 10000,
        accuracy: LocationAccuracy.HIGH_ACCURACY,
        waitForAccurateLocation: true,
        notificationTitle: 'Tracking',
        notificationText: 'Location tracking active',
        notificationChannelName: 'location',
        notificationPriority: NotificationPriority.HIGH,
        notificationSmallIcon: 'ic_location',
        notificationColor: '#4CAF50',
        notificationShowTimestamp: true,
        distanceFilter: 50,
        foregroundOnly: false,
      };
      (BackgroundLocationModule.startTracking as jest.Mock).mockResolvedValue(
        mockTripId
      );

      const result = await BackgroundLocation.startTracking(
        mockTripId,
        options
      );

      expect(result).toBe(mockTripId);
      expect(BackgroundLocationModule.startTracking).toHaveBeenCalledWith(
        mockTripId,
        {
          updateInterval: 5000,
          fastestInterval: 2000,
          maxWaitTime: 10000,
          accuracy: 'HIGH_ACCURACY',
          waitForAccurateLocation: true,
          notificationTitle: 'Tracking',
          notificationText: 'Location tracking active',
          notificationChannelName: 'location',
          notificationPriority: 'HIGH',
          notificationSmallIcon: 'ic_location',
          notificationColor: '#4CAF50',
          notificationShowTimestamp: true,
          distanceFilter: 50,
          foregroundOnly: false,
        }
      );
    });

    it('should handle when module is not available - isTracking returns false', async () => {
      // Mock BackgroundLocationModule to return undefined for isTracking
      Object.defineProperty(BackgroundLocationModule, 'isTracking', {
        value: undefined,
        configurable: true,
      });

      const result = await BackgroundLocation.startTracking();

      expect(result).toMatch(/^simulator-trip-\d+$/);
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('BackgroundLocation not available')
      );

      // Restore
      Object.defineProperty(BackgroundLocationModule, 'isTracking', {
        value: jest.fn(),
        configurable: true,
      });
    });

    it('should handle when module is null', async () => {
      const originalModule = BackgroundLocationModule;
      // Mock module to be null
      Object.defineProperty(require('../NativeBackgroundLocation'), 'default', {
        value: null,
        configurable: true,
      });

      // Need to re-import to get the null module
      const BackgroundLocationWithNullModule = require('../index').default;
      const result = await BackgroundLocationWithNullModule.startTracking();

      expect(result).toMatch(/^simulator-trip-\d+$/);
      expect(console.warn).toHaveBeenCalled();

      // Restore
      Object.defineProperty(require('../NativeBackgroundLocation'), 'default', {
        value: originalModule,
        configurable: true,
      });
    });

    it('should handle when module is null in isNativeModuleAvailable check', async () => {
      // Test the specific line 50: when BackgroundLocationModule === null
      const originalModule = BackgroundLocationModule;
      const originalIsTracking = BackgroundLocationModule.isTracking;

      // First set isTracking to be a function (to pass first check)
      Object.defineProperty(BackgroundLocationModule, 'isTracking', {
        value: jest.fn(),
        configurable: true,
        writable: true,
      });

      // Then set module to null to trigger line 50
      Object.defineProperty(require('../NativeBackgroundLocation'), 'default', {
        value: null,
        configurable: true,
      });

      // Re-import to get the null module
      const BackgroundLocationWithNullModule = require('../index').default;
      const result = await BackgroundLocationWithNullModule.isTracking();

      expect(result).toEqual({ active: false });
      expect(console.warn).toHaveBeenCalled();

      // Restore
      Object.defineProperty(require('../NativeBackgroundLocation'), 'default', {
        value: originalModule,
        configurable: true,
      });
      Object.defineProperty(BackgroundLocationModule, 'isTracking', {
        value: originalIsTracking,
        configurable: true,
        writable: true,
      });
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

    it('should handle when module is not available', async () => {
      // Mock isTracking to return undefined (not a function) to simulate unavailable module
      const originalIsTracking = BackgroundLocationModule.isTracking;
      Object.defineProperty(BackgroundLocationModule, 'isTracking', {
        value: undefined,
        configurable: true,
        writable: true,
      });

      await BackgroundLocation.stopTracking();

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('BackgroundLocation not available')
      );

      // Restore
      Object.defineProperty(BackgroundLocationModule, 'isTracking', {
        value: originalIsTracking,
        configurable: true,
        writable: true,
      });
      // Ensure it's a mock again
      (BackgroundLocationModule.isTracking as jest.Mock) = jest.fn();
      (BackgroundLocationModule.stopTracking as jest.Mock) = jest.fn();
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

    it('should return inactive status when module is not available', async () => {
      Object.defineProperty(BackgroundLocationModule, 'isTracking', {
        value: undefined,
        configurable: true,
      });

      const result = await BackgroundLocation.isTracking();

      expect(result).toEqual({ active: false });
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('BackgroundLocation not available')
      );

      // Restore
      Object.defineProperty(BackgroundLocationModule, 'isTracking', {
        value: jest.fn(),
        configurable: true,
      });
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

    it('should return empty array when module is not available', async () => {
      // Mock isTracking to return undefined (not a function) to simulate unavailable module
      const originalIsTracking = BackgroundLocationModule.isTracking;
      Object.defineProperty(BackgroundLocationModule, 'isTracking', {
        value: undefined,
        configurable: true,
        writable: true,
      });

      const result = await BackgroundLocation.getLocations(mockTripId);

      expect(result).toEqual([]);
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('BackgroundLocation not available')
      );

      // Restore
      Object.defineProperty(BackgroundLocationModule, 'isTracking', {
        value: originalIsTracking,
        configurable: true,
        writable: true,
      });
      // Ensure it's a mock again
      (BackgroundLocationModule.isTracking as jest.Mock) = jest.fn();
      (BackgroundLocationModule.getLocations as jest.Mock) = jest.fn();
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

    it('should return locations with extended properties when available', async () => {
      const locationsWithExtendedProps = [
        {
          latitude: '37.7749',
          longitude: '-122.4194',
          timestamp: 1640995200000,
          accuracy: 10.5,
          altitude: 100.2,
          speed: 5.5,
          bearing: 90.0,
          provider: 'gps',
          isFromMockProvider: false,
        },
        {
          latitude: '37.7849',
          longitude: '-122.4094',
          timestamp: 1640995260000,
          accuracy: 12.0,
          altitude: 105.0,
          speed: 6.0,
          bearing: 95.0,
          verticalAccuracyMeters: 5.0,
          speedAccuracyMetersPerSecond: 0.5,
          bearingAccuracyDegrees: 2.0,
          elapsedRealtimeNanos: 1000000000,
          provider: 'gps',
        },
      ];

      (BackgroundLocationModule.getLocations as jest.Mock).mockResolvedValue(
        locationsWithExtendedProps
      );

      const result = await BackgroundLocation.getLocations(mockTripId);

      expect(result).toEqual(locationsWithExtendedProps);
      expect(result[0]?.accuracy).toBe(10.5);
      expect(result[0]?.altitude).toBe(100.2);
      expect(result[0]?.speed).toBe(5.5);
      expect(result[0]?.bearing).toBe(90.0);
      expect(result[0]?.provider).toBe('gps');
      expect(result[0]?.isFromMockProvider).toBe(false);
      expect(result[1]?.verticalAccuracyMeters).toBe(5.0);
      expect(result[1]?.speedAccuracyMetersPerSecond).toBe(0.5);
      expect(result[1]?.bearingAccuracyDegrees).toBe(2.0);
      expect(result[1]?.elapsedRealtimeNanos).toBe(1000000000);
    });

    it('should return locations with only basic properties when extended properties are not available', async () => {
      const basicLocations = [
        {
          latitude: '37.7749',
          longitude: '-122.4194',
          timestamp: 1640995200000,
        },
      ];

      (BackgroundLocationModule.getLocations as jest.Mock).mockResolvedValue(
        basicLocations
      );

      const result = await BackgroundLocation.getLocations(mockTripId);

      expect(result).toEqual(basicLocations);
      expect(result[0]?.latitude).toBe('37.7749');
      expect(result[0]?.longitude).toBe('-122.4194');
      expect(result[0]?.timestamp).toBe(1640995200000);
      // Extended properties should be undefined
      expect(result[0]?.accuracy).toBeUndefined();
      expect(result[0]?.speed).toBeUndefined();
      expect(result[0]?.altitude).toBeUndefined();
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

    it('should handle when module is not available', async () => {
      // Mock isTracking to return undefined (not a function) to simulate unavailable module
      const originalIsTracking = BackgroundLocationModule.isTracking;
      Object.defineProperty(BackgroundLocationModule, 'isTracking', {
        value: undefined,
        configurable: true,
        writable: true,
      });

      await BackgroundLocation.clearTrip(mockTripId);

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('BackgroundLocation not available')
      );

      // Restore
      Object.defineProperty(BackgroundLocationModule, 'isTracking', {
        value: originalIsTracking,
        configurable: true,
        writable: true,
      });
      // Ensure it's a mock again
      (BackgroundLocationModule.isTracking as jest.Mock) = jest.fn();
      (BackgroundLocationModule.clearTrip as jest.Mock) = jest.fn();
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

    // NOTE: Module availability tests are skipped due to Jest module caching limitations
    it.skip('should handle iOS platform (not available)', async () => {
      Platform.OS = 'ios';
      (global as any).setModuleAvailable(false);

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

    it('should handle exception when checking module availability', async () => {
      // Mock to throw an error when accessing isTracking
      const originalIsTracking = BackgroundLocationModule.isTracking;
      Object.defineProperty(BackgroundLocationModule, 'isTracking', {
        get: () => {
          throw new Error('Module error');
        },
        configurable: true,
      });

      const result = await BackgroundLocation.startTracking();

      expect(result).toMatch(/^simulator-trip-\d+$/);
      expect(console.warn).toHaveBeenCalled();

      // Restore
      Object.defineProperty(BackgroundLocationModule, 'isTracking', {
        value: originalIsTracking,
        configurable: true,
        writable: true,
      });
      // Ensure it's a mock again
      (BackgroundLocationModule.isTracking as jest.Mock) = jest.fn();
    });
  });

  describe('updateNotification', () => {
    it('should update notification with title and text', async () => {
      (
        BackgroundLocationModule.updateNotification as jest.Mock
      ).mockResolvedValue(undefined);

      await BackgroundLocation.updateNotification(
        'New Title',
        'New notification text'
      );

      expect(BackgroundLocationModule.updateNotification).toHaveBeenCalledWith(
        'New Title',
        'New notification text'
      );
      expect(console.warn).not.toHaveBeenCalled();
    });

    it('should handle when module is not available', async () => {
      const originalIsTracking = BackgroundLocationModule.isTracking;
      Object.defineProperty(BackgroundLocationModule, 'isTracking', {
        value: undefined,
        configurable: true,
        writable: true,
      });

      await BackgroundLocation.updateNotification('Title', 'Text');

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('BackgroundLocation not available')
      );

      // Restore
      Object.defineProperty(BackgroundLocationModule, 'isTracking', {
        value: originalIsTracking,
        configurable: true,
        writable: true,
      });
      (BackgroundLocationModule.isTracking as jest.Mock) = jest.fn();
      (BackgroundLocationModule.updateNotification as jest.Mock) = jest.fn();
    });

    it('should propagate errors from native module', async () => {
      const error = new Error('No active service');
      (
        BackgroundLocationModule.updateNotification as jest.Mock
      ).mockRejectedValue(error);

      await expect(
        BackgroundLocation.updateNotification('Title', 'Text')
      ).rejects.toThrow('No active service');
    });

    it('should pass exact title and text strings to native module', async () => {
      (
        BackgroundLocationModule.updateNotification as jest.Mock
      ).mockResolvedValue(undefined);

      const title = 'Delivery #1234';
      const text = 'En route to destination - 2.5km remaining';

      await BackgroundLocation.updateNotification(title, text);

      expect(BackgroundLocationModule.updateNotification).toHaveBeenCalledWith(
        title,
        text
      );
    });
  });

  describe('notificationActions serialization', () => {
    it('should serialize notification actions as JSON string', async () => {
      const options: TrackingOptions = {
        notificationActions: [
          { id: 'stop', label: 'Stop' },
          { id: 'pause', label: 'Pause' },
        ],
      };
      (BackgroundLocationModule.startTracking as jest.Mock).mockResolvedValue(
        mockTripId
      );

      await BackgroundLocation.startTracking(mockTripId, options);

      expect(BackgroundLocationModule.startTracking).toHaveBeenCalledWith(
        mockTripId,
        expect.objectContaining({
          notificationActions: JSON.stringify([
            { id: 'stop', label: 'Stop' },
            { id: 'pause', label: 'Pause' },
          ]),
        })
      );
    });

    it('should limit notification actions to maximum of 3', async () => {
      const options: TrackingOptions = {
        notificationActions: [
          { id: 'a1', label: 'Action 1' },
          { id: 'a2', label: 'Action 2' },
          { id: 'a3', label: 'Action 3' },
          { id: 'a4', label: 'Action 4' },
        ],
      };
      (BackgroundLocationModule.startTracking as jest.Mock).mockResolvedValue(
        mockTripId
      );

      await BackgroundLocation.startTracking(mockTripId, options);

      const calledOptions = (
        BackgroundLocationModule.startTracking as jest.Mock
      ).mock.calls[0]?.[1];
      const parsedActions = JSON.parse(calledOptions?.notificationActions);
      expect(parsedActions).toHaveLength(3);
      expect(parsedActions[2].id).toBe('a3');
    });

    it('should not include notificationActions when not provided', async () => {
      const options: TrackingOptions = {
        updateInterval: 5000,
      };
      (BackgroundLocationModule.startTracking as jest.Mock).mockResolvedValue(
        mockTripId
      );

      await BackgroundLocation.startTracking(mockTripId, options);

      const calledOptions = (
        BackgroundLocationModule.startTracking as jest.Mock
      ).mock.calls[0]?.[1];
      expect(calledOptions?.notificationActions).toBeUndefined();
    });

    it('should handle empty notification actions array', async () => {
      const options: TrackingOptions = {
        notificationActions: [],
      };
      (BackgroundLocationModule.startTracking as jest.Mock).mockResolvedValue(
        mockTripId
      );

      await BackgroundLocation.startTracking(mockTripId, options);

      const calledOptions = (
        BackgroundLocationModule.startTracking as jest.Mock
      ).mock.calls[0]?.[1];
      expect(calledOptions?.notificationActions).toBe('[]');
    });
  });

  describe('Enum exports', () => {
    it('should export LocationAccuracy enum', () => {
      expect(LocationAccuracy).toBeDefined();
      expect(LocationAccuracy.HIGH_ACCURACY).toBe('HIGH_ACCURACY');
      expect(LocationAccuracy.BALANCED_POWER_ACCURACY).toBe(
        'BALANCED_POWER_ACCURACY'
      );
      expect(LocationAccuracy.LOW_POWER).toBe('LOW_POWER');
      expect(LocationAccuracy.NO_POWER).toBe('NO_POWER');
      expect(LocationAccuracy.PASSIVE).toBe('PASSIVE');
    });

    it('should export NotificationPriority enum', () => {
      expect(NotificationPriority).toBeDefined();
      expect(NotificationPriority.HIGH).toBe('HIGH');
      expect(NotificationPriority.DEFAULT).toBe('DEFAULT');
      expect(NotificationPriority.LOW).toBe('LOW');
      expect(NotificationPriority.MAX).toBe('MAX');
    });
  });
});
