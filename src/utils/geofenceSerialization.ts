import type { GeofenceRegion } from '../types/geofencing';
import { GeofenceTransitionType } from '../types/geofencing';
import type { NotificationOptions } from '../types/notifications';

/**
 * Prepares a geofence region as a plain object ready for JSON serialization
 * by the native layer.
 *
 * Handles:
 *  - `notificationOptions === false` → `{ enabled: false }` override
 *  - `notificationOptions === undefined` → property omitted entirely
 *  - Default `transitionTypes` of `[ENTER, EXIT]` when none supplied
 *  - Default `loiteringDelay` of 30000 ms
 *  - Stringifies `transitionTypes` so the native side can parse them
 *
 * @internal
 */
export function prepareGeofenceRegion(
  region: GeofenceRegion
): Record<string, unknown> {
  // Resolve notificationOptions: false → { enabled: false }, undefined → omit
  let notificationOptions: NotificationOptions | undefined;
  if (region.notificationOptions === false) {
    notificationOptions = { enabled: false };
  } else if (region.notificationOptions != null) {
    notificationOptions = region.notificationOptions;
  }

  const prepared: Record<string, unknown> = {
    ...region,
    transitionTypes: (
      region.transitionTypes ?? [
        GeofenceTransitionType.ENTER,
        GeofenceTransitionType.EXIT,
      ]
    ).map((t) => t.toString()),
    loiteringDelay: region.loiteringDelay ?? 30000,
    expirationDuration: region.expirationDuration ?? undefined,
    metadata: region.metadata ?? undefined,
  };

  if (notificationOptions !== undefined) {
    prepared.notificationOptions = notificationOptions;
  } else {
    delete prepared.notificationOptions;
  }

  return prepared;
}

/**
 * Serializes a single geofence region to a JSON string for calls that send
 * one region to the native layer.
 *
 * @internal
 */
export function serializeGeofenceRegion(region: GeofenceRegion): string {
  return JSON.stringify(prepareGeofenceRegion(region));
}
