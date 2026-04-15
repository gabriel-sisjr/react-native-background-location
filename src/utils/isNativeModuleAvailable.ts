import NativeModule from '../NativeBackgroundLocation';

/**
 * Non-throwing check that the native BackgroundLocation module is loaded
 * and exposes its expected methods.
 *
 * This is distinct from {@link assertNativeModuleAvailable}: it returns a
 * boolean instead of throwing, which is the right tool for the graceful
 * fallback paths in the public API (e.g. simulator/dev environments where
 * the native module is not linked and we want to `console.warn` instead
 * of crashing).
 *
 * The probe intentionally checks `typeof NativeModule?.isTracking` first so
 * that Proxy-based mocks used in the example app and tests still resolve
 * correctly, then verifies the module itself is not null.
 */
export function isNativeModuleAvailable(): boolean {
  try {
    // Check if methods are available (works with Proxy mocks)
    // This must be checked first before checking if module exists
    if (typeof NativeModule?.isTracking !== 'function') {
      return false;
    }
    // Check if module exists and is not null
    if (!NativeModule || NativeModule === null) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
