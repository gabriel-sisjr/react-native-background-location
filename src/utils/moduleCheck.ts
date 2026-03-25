import NativeModule from '../NativeBackgroundLocation';

/**
 * Asserts that the native BackgroundLocation module is available.
 * Throws a descriptive error if the module is not loaded.
 */
export function assertNativeModuleAvailable(): void {
  if (!NativeModule) {
    throw new Error(
      'BackgroundLocation native module is not available. ' +
        'Ensure the library is properly linked and the app has been rebuilt.'
    );
  }
}
