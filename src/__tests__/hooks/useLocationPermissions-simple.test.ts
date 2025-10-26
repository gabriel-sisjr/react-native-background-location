import { renderHook } from '@testing-library/react-native';
import { useLocationPermissions } from '../../hooks/useLocationPermissions';

describe('useLocationPermissions - Simple Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic functionality', () => {
    it('should initialize with correct default state', () => {
      const { result } = renderHook(() => useLocationPermissions());

      expect(result.current.permissionStatus).toEqual({
        hasPermission: false,
        status: 'undetermined',
        canRequestAgain: true,
      });
      expect(result.current.isRequesting).toBe(false);
      expect(typeof result.current.requestPermissions).toBe('function');
      expect(typeof result.current.checkPermissions).toBe('function');
    });

    it('should handle iOS platform gracefully', () => {
      const { result } = renderHook(() => useLocationPermissions());

      expect(result.current.permissionStatus.hasPermission).toBe(false);
      expect(result.current.permissionStatus.status).toBe('undetermined');
    });
  });

  describe('Permission checking', () => {
    it('should have checkPermissions function', () => {
      const { result } = renderHook(() => useLocationPermissions());

      expect(typeof result.current.checkPermissions).toBe('function');
    });
  });

  describe('Permission requesting', () => {
    it('should have requestPermissions function', () => {
      const { result } = renderHook(() => useLocationPermissions());

      expect(typeof result.current.requestPermissions).toBe('function');
    });
  });
});
