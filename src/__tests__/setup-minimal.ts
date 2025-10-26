/**
 * Minimal Jest setup for react-native-background-location tests
 */

// Mock react-native modules
jest.mock('react-native', () => ({
  Platform: {
    OS: 'android',
    Version: 30,
    select: jest.fn((obj) => obj.android || obj.default),
  },
  PermissionsAndroid: {
    PERMISSIONS: {
      ACCESS_FINE_LOCATION: 'android.permission.ACCESS_FINE_LOCATION',
      ACCESS_COARSE_LOCATION: 'android.permission.ACCESS_COARSE_LOCATION',
      ACCESS_BACKGROUND_LOCATION:
        'android.permission.ACCESS_BACKGROUND_LOCATION',
    },
    RESULTS: {
      GRANTED: 'granted',
      DENIED: 'denied',
      NEVER_ASK_AGAIN: 'never_ask_again',
    },
    request: jest.fn(),
    requestMultiple: jest.fn(),
    check: jest.fn(),
  },
  NativeModules: {
    BackgroundLocation: {
      startTracking: jest.fn(),
      stopTracking: jest.fn(),
      isTracking: jest.fn(),
      getLocations: jest.fn(),
      clearTrip: jest.fn(),
    },
  },
  Linking: {
    openSettings: jest.fn(),
    openURL: jest.fn(),
    canOpenURL: jest.fn(),
    getInitialURL: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  },
}));

// Mock TurboModuleRegistry
jest.mock('react-native/Libraries/TurboModule/TurboModuleRegistry', () => ({
  getEnforcing: jest.fn(() => ({
    startTracking: jest.fn(),
    stopTracking: jest.fn(),
    isTracking: jest.fn(),
    getLocations: jest.fn(),
    clearTrip: jest.fn(),
  })),
  get: jest.fn(),
}));

// Mock console methods to reduce noise in tests
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeEach(() => {
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterEach(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
  jest.clearAllMocks();
});

// Global test utilities
(global as any).mockLocationData = {
  latitude: '37.7749',
  longitude: '-122.4194',
  timestamp: 1640995200000,
};

(global as any).mockTripId = 'test-trip-123';

(global as any).mockTrackingStatus = {
  active: true,
  tripId: (global as any).mockTripId,
};

(global as any).mockLocations = [
  {
    latitude: '37.7749',
    longitude: '-122.4194',
    timestamp: 1640995200000,
  },
  {
    latitude: '37.7849',
    longitude: '-122.4094',
    timestamp: 1640995260000,
  },
];
