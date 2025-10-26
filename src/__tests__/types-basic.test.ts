import type {
  Coords,
  TrackingStatus,
  PermissionState,
  UseLocationPermissionsResult,
  UseBackgroundLocationResult,
  UseLocationTrackingOptions,
} from '../types';
import { LocationPermissionStatus } from '../types';

describe('Types - Basic Tests', () => {
  describe('Coords', () => {
    it('should have correct structure', () => {
      const coords: Coords = {
        latitude: '37.7749',
        longitude: '-122.4194',
        timestamp: 1640995200000,
      };

      expect(typeof coords.latitude).toBe('string');
      expect(typeof coords.longitude).toBe('string');
      expect(typeof coords.timestamp).toBe('number');
    });

    it('should accept valid coordinate values', () => {
      const validCoords: Coords[] = [
        {
          latitude: '0',
          longitude: '0',
          timestamp: 0,
        },
        {
          latitude: '90',
          longitude: '180',
          timestamp: Date.now(),
        },
        {
          latitude: '-90',
          longitude: '-180',
          timestamp: 1640995200000,
        },
      ];

      validCoords.forEach((coords) => {
        expect(coords).toHaveProperty('latitude');
        expect(coords).toHaveProperty('longitude');
        expect(coords).toHaveProperty('timestamp');
      });
    });
  });

  describe('TrackingStatus', () => {
    it('should have correct structure for active tracking', () => {
      const activeStatus: TrackingStatus = {
        active: true,
        tripId: 'test-trip-123',
      };

      expect(typeof activeStatus.active).toBe('boolean');
      expect(typeof activeStatus.tripId).toBe('string');
      expect(activeStatus.active).toBe(true);
    });

    it('should have correct structure for inactive tracking', () => {
      const inactiveStatus: TrackingStatus = {
        active: false,
        tripId: undefined,
      };

      expect(typeof inactiveStatus.active).toBe('boolean');
      expect(inactiveStatus.tripId).toBeUndefined();
      expect(inactiveStatus.active).toBe(false);
    });

    it('should allow optional tripId', () => {
      const statusWithoutTripId: TrackingStatus = {
        active: false,
      };

      expect(statusWithoutTripId).toHaveProperty('active');
      expect(statusWithoutTripId.tripId).toBeUndefined();
    });
  });

  describe('LocationPermissionStatus', () => {
    it('should have all required enum values', () => {
      expect(LocationPermissionStatus.GRANTED).toBe('granted');
      expect(LocationPermissionStatus.DENIED).toBe('denied');
      expect(LocationPermissionStatus.BLOCKED).toBe('blocked');
      expect(LocationPermissionStatus.UNDETERMINED).toBe('undetermined');
    });

    it('should be usable as string literal types', () => {
      const grantedStatus: LocationPermissionStatus =
        LocationPermissionStatus.GRANTED;
      const deniedStatus: LocationPermissionStatus =
        LocationPermissionStatus.DENIED;
      const blockedStatus: LocationPermissionStatus =
        LocationPermissionStatus.BLOCKED;
      const undeterminedStatus: LocationPermissionStatus =
        LocationPermissionStatus.UNDETERMINED;

      expect(grantedStatus).toBe('granted');
      expect(deniedStatus).toBe('denied');
      expect(blockedStatus).toBe('blocked');
      expect(undeterminedStatus).toBe('undetermined');
    });
  });

  describe('PermissionState', () => {
    it('should have correct structure', () => {
      const permissionState: PermissionState = {
        hasPermission: true,
        status: LocationPermissionStatus.GRANTED,
        canRequestAgain: true,
      };

      expect(typeof permissionState.hasPermission).toBe('boolean');
      expect(typeof permissionState.status).toBe('string');
      expect(typeof permissionState.canRequestAgain).toBe('boolean');
    });

    it('should handle all permission states', () => {
      const grantedState: PermissionState = {
        hasPermission: true,
        status: LocationPermissionStatus.GRANTED,
        canRequestAgain: true,
      };

      const deniedState: PermissionState = {
        hasPermission: false,
        status: LocationPermissionStatus.DENIED,
        canRequestAgain: true,
      };

      const blockedState: PermissionState = {
        hasPermission: false,
        status: LocationPermissionStatus.BLOCKED,
        canRequestAgain: false,
      };

      const undeterminedState: PermissionState = {
        hasPermission: false,
        status: LocationPermissionStatus.UNDETERMINED,
        canRequestAgain: true,
      };

      expect(grantedState.hasPermission).toBe(true);
      expect(deniedState.hasPermission).toBe(false);
      expect(blockedState.canRequestAgain).toBe(false);
      expect(undeterminedState.status).toBe('undetermined');
    });
  });

  describe('UseLocationPermissionsResult', () => {
    it('should have correct structure', () => {
      const mockResult: UseLocationPermissionsResult = {
        permissionStatus: {
          hasPermission: true,
          status: LocationPermissionStatus.GRANTED,
          canRequestAgain: true,
        },
        requestPermissions: jest.fn(),
        checkPermissions: jest.fn(),
        isRequesting: false,
      };

      expect(typeof mockResult.permissionStatus).toBe('object');
      expect(typeof mockResult.requestPermissions).toBe('function');
      expect(typeof mockResult.checkPermissions).toBe('function');
      expect(typeof mockResult.isRequesting).toBe('boolean');
    });
  });

  describe('UseBackgroundLocationResult', () => {
    it('should have correct structure', () => {
      const mockResult: UseBackgroundLocationResult = {
        tripId: 'test-trip-123',
        isTracking: true,
        locations: [
          {
            latitude: '37.7749',
            longitude: '-122.4194',
            timestamp: 1640995200000,
          },
        ],
        isLoading: false,
        error: null,
        startTracking: jest.fn(),
        stopTracking: jest.fn(),
        refreshLocations: jest.fn(),
        clearCurrentTrip: jest.fn(),
        clearError: jest.fn(),
      };

      expect(typeof mockResult.tripId).toBe('string');
      expect(typeof mockResult.isTracking).toBe('boolean');
      expect(Array.isArray(mockResult.locations)).toBe(true);
      expect(typeof mockResult.isLoading).toBe('boolean');
      expect(mockResult.error).toBeNull();
      expect(typeof mockResult.startTracking).toBe('function');
      expect(typeof mockResult.stopTracking).toBe('function');
      expect(typeof mockResult.refreshLocations).toBe('function');
      expect(typeof mockResult.clearCurrentTrip).toBe('function');
      expect(typeof mockResult.clearError).toBe('function');
    });

    it('should handle null tripId', () => {
      const mockResult: UseBackgroundLocationResult = {
        tripId: null,
        isTracking: false,
        locations: [],
        isLoading: false,
        error: null,
        startTracking: jest.fn(),
        stopTracking: jest.fn(),
        refreshLocations: jest.fn(),
        clearCurrentTrip: jest.fn(),
        clearError: jest.fn(),
      };

      expect(mockResult.tripId).toBeNull();
      expect(mockResult.isTracking).toBe(false);
      expect(mockResult.locations).toEqual([]);
    });
  });

  describe('UseLocationTrackingOptions', () => {
    it('should have correct structure', () => {
      const mockOptions: UseLocationTrackingOptions = {
        autoStart: true,
        tripId: 'test-trip-123',
        onTrackingStart: jest.fn(),
        onTrackingStop: jest.fn(),
        onError: jest.fn(),
      };

      expect(typeof mockOptions.autoStart).toBe('boolean');
      expect(typeof mockOptions.tripId).toBe('string');
      expect(typeof mockOptions.onTrackingStart).toBe('function');
      expect(typeof mockOptions.onTrackingStop).toBe('function');
      expect(typeof mockOptions.onError).toBe('function');
    });

    it('should allow partial options', () => {
      const partialOptions: UseLocationTrackingOptions = {
        autoStart: false,
      };

      expect(partialOptions.autoStart).toBe(false);
      expect(partialOptions.tripId).toBeUndefined();
      expect(partialOptions.onTrackingStart).toBeUndefined();
      expect(partialOptions.onTrackingStop).toBeUndefined();
      expect(partialOptions.onError).toBeUndefined();
    });

    it('should allow empty options', () => {
      const emptyOptions: UseLocationTrackingOptions = {};

      expect(emptyOptions.autoStart).toBeUndefined();
      expect(emptyOptions.tripId).toBeUndefined();
      expect(emptyOptions.onTrackingStart).toBeUndefined();
      expect(emptyOptions.onTrackingStop).toBeUndefined();
      expect(emptyOptions.onError).toBeUndefined();
    });
  });
});
