import { Platform, NativeModules, PermissionsAndroid } from 'react-native';

describe('React Native Background Location - Basic Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Platform detection', () => {
    it('should detect Android platform', () => {
      expect(Platform.OS).toBe('android');
    });

    it('should handle iOS platform', () => {
      Platform.OS = 'ios';
      expect(Platform.OS).toBe('ios');
    });
  });

  describe('Native modules', () => {
    it('should have BackgroundLocation module', () => {
      expect(NativeModules.BackgroundLocation).toBeDefined();
      expect(typeof NativeModules.BackgroundLocation.startTracking).toBe(
        'function'
      );
      expect(typeof NativeModules.BackgroundLocation.stopTracking).toBe(
        'function'
      );
      expect(typeof NativeModules.BackgroundLocation.isTracking).toBe(
        'function'
      );
      expect(typeof NativeModules.BackgroundLocation.getLocations).toBe(
        'function'
      );
      expect(typeof NativeModules.BackgroundLocation.clearTrip).toBe(
        'function'
      );
    });

    it('should handle simulator mode', () => {
      // Simulate simulator mode (no native module)
      const originalModule = NativeModules.BackgroundLocation;
      NativeModules.BackgroundLocation = null;

      expect(NativeModules.BackgroundLocation).toBeNull();

      // Restore
      NativeModules.BackgroundLocation = originalModule;
    });
  });

  describe('Permissions', () => {
    it('should have PermissionsAndroid available', () => {
      expect(PermissionsAndroid).toBeDefined();
      expect(PermissionsAndroid.PERMISSIONS).toBeDefined();
      expect(PermissionsAndroid.RESULTS).toBeDefined();
      expect(typeof PermissionsAndroid.request).toBe('function');
      expect(typeof PermissionsAndroid.requestMultiple).toBe('function');
      expect(typeof PermissionsAndroid.check).toBe('function');
    });

    it('should have correct permission constants', () => {
      expect(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION).toBe(
        'android.permission.ACCESS_FINE_LOCATION'
      );
      expect(PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION).toBe(
        'android.permission.ACCESS_COARSE_LOCATION'
      );
      expect(PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION).toBe(
        'android.permission.ACCESS_BACKGROUND_LOCATION'
      );
    });

    it('should have correct result constants', () => {
      expect(PermissionsAndroid.RESULTS.GRANTED).toBe('granted');
      expect(PermissionsAndroid.RESULTS.DENIED).toBe('denied');
      expect(PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN).toBe(
        'never_ask_again'
      );
    });
  });

  describe('Linking', () => {
    it('should have Linking module available', () => {
      const { Linking } = require('react-native');

      expect(Linking).toBeDefined();
      expect(typeof Linking.openSettings).toBe('function');
      expect(typeof Linking.openURL).toBe('function');
      expect(typeof Linking.canOpenURL).toBe('function');
      expect(typeof Linking.getInitialURL).toBe('function');
      expect(typeof Linking.addEventListener).toBe('function');
      expect(typeof Linking.removeEventListener).toBe('function');
    });
  });
});
