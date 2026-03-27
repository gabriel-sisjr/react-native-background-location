import { assertNativeModuleAvailable } from '../../utils/moduleCheck';

describe('moduleCheck', () => {
  describe('assertNativeModuleAvailable', () => {
    it('should not throw when native module is available', () => {
      // The global setup mock provides a truthy NativeModule by default
      expect(() => assertNativeModuleAvailable()).not.toThrow();
    });

    it('should throw when native module is null', () => {
      // Clear entire module registry so the hoisted mock from setup is gone
      jest.resetModules();

      // Mock NativeBackgroundLocation to return null as default export
      jest.doMock('../../NativeBackgroundLocation', () => ({
        __esModule: true,
        default: null,
      }));

      const {
        assertNativeModuleAvailable: isolatedAssert,
      } = require('../../utils/moduleCheck');

      expect(() => isolatedAssert()).toThrow(
        'BackgroundLocation native module is not available. ' +
          'Ensure the library is properly linked and the app has been rebuilt.'
      );
    });

    it('should throw when native module is undefined', () => {
      jest.resetModules();

      jest.doMock('../../NativeBackgroundLocation', () => ({
        __esModule: true,
        default: undefined,
      }));

      const {
        assertNativeModuleAvailable: isolatedAssert,
      } = require('../../utils/moduleCheck');

      expect(() => isolatedAssert()).toThrow(
        'BackgroundLocation native module is not available'
      );
    });
  });
});
