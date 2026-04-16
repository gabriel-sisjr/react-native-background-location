import { isNativeModuleAvailable } from '../../utils/isNativeModuleAvailable';

describe('isNativeModuleAvailable', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should return true when native module is available with expected methods', () => {
    expect(isNativeModuleAvailable()).toBe(true);
  });

  it('should return false when native module is null', () => {
    jest.resetModules();

    jest.doMock('../../NativeBackgroundLocation', () => ({
      __esModule: true,
      default: null,
    }));

    const {
      isNativeModuleAvailable: isolated,
    } = require('../../utils/isNativeModuleAvailable');

    expect(isolated()).toBe(false);
  });

  it('should return false when native module is undefined', () => {
    jest.resetModules();

    jest.doMock('../../NativeBackgroundLocation', () => ({
      __esModule: true,
      default: undefined,
    }));

    const {
      isNativeModuleAvailable: isolated,
    } = require('../../utils/isNativeModuleAvailable');

    expect(isolated()).toBe(false);
  });

  it('should return false when isTracking is not a function', () => {
    jest.resetModules();

    jest.doMock('../../NativeBackgroundLocation', () => ({
      __esModule: true,
      default: { isTracking: 'not-a-function' },
    }));

    const {
      isNativeModuleAvailable: isolated,
    } = require('../../utils/isNativeModuleAvailable');

    expect(isolated()).toBe(false);
  });

  it('should return false when native module throws on access', () => {
    jest.resetModules();

    jest.doMock('../../NativeBackgroundLocation', () => ({
      __esModule: true,
      get default() {
        throw new Error('Module not linked');
      },
    }));

    const {
      isNativeModuleAvailable: isolated,
    } = require('../../utils/isNativeModuleAvailable');

    expect(isolated()).toBe(false);
  });
});
