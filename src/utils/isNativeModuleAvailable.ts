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
 * The probe uses optional chaining so that `null` / `undefined` modules
 * short-circuit safely, and Proxy-based mocks used in the example app
 * and tests still resolve correctly.
 */
export function isNativeModuleAvailable(): boolean {
  try {
    return typeof NativeModule?.isTracking === 'function';
  } catch {
    return false;
  }
}
