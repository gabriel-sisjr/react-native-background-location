/**
 * Barrel export for internal utility helpers used across the public API.
 *
 * Keeping these in a single module lets `src/index.tsx` stay a lean facade
 * over the TurboModule bridge while still sharing logic with tests and
 * hooks.
 */

export { assertNativeModuleAvailable } from './moduleCheck';
export { isNativeModuleAvailable } from './isNativeModuleAvailable';
export { extractDefinedProperties } from './objectUtils';
export { toTrackingOptionsSpec } from './trackingOptionsMapper';
export { validateGeofenceRegion } from './geofenceValidation';
export {
  prepareGeofenceRegion,
  serializeGeofenceRegion,
} from './geofenceSerialization';
