import type { PermissionRationale } from '../types';

/**
 * Resolved rationale shape consumed by `PermissionsAndroid.request`.
 * Defined explicitly (rather than `Required<PermissionRationale>`) so
 * future optional fields on `PermissionRationale` cannot silently flip
 * to required in this contract.
 *
 * @internal
 */
interface ResolvedPermissionRationale {
  title: string;
  message: string;
  buttonPositive: string;
  buttonNegative: string;
  buttonNeutral: string;
}

/**
 * Default English copy for the Android background-location rationale
 * dialog. Mirrors the literals previously hardcoded in
 * `useLocationPermissions.ts`.
 *
 * @internal Not re-exported from `src/utils/index.ts` or `src/index.tsx`
 * — the wording is internal and may evolve without a SemVer bump.
 */
const DEFAULT_BACKGROUND_LOCATION_RATIONALE = {
  title: 'Background Location Permission',
  message:
    'This app needs access to your location in the background to track your trips.',
  buttonPositive: 'OK',
  buttonNegative: 'Cancel',
  buttonNeutral: 'Ask Me Later',
} as const;

/**
 * Merges a partial {@link PermissionRationale} override onto the library
 * defaults, returning a fully populated rationale ready to pass to
 * `PermissionsAndroid.request`.
 *
 * Resolution rule (per field): trim the override value; if the trimmed
 * value is truthy, use the trimmed string; otherwise fall back to the
 * default. Empty strings, whitespace-only strings, `undefined`, and
 * `null` all fall back.
 *
 * Implementation note: each field is read explicitly rather than via
 * iteration. This keeps the function type-safe under
 * `noUncheckedIndexedAccess` and survives future additions to
 * `PermissionRationale` without silently propagating new fields.
 *
 * @internal
 */
export function resolveRationale(
  override?: PermissionRationale
): ResolvedPermissionRationale {
  const title =
    typeof override?.title === 'string' && override.title.trim().length > 0
      ? override.title.trim()
      : DEFAULT_BACKGROUND_LOCATION_RATIONALE.title;

  const message =
    typeof override?.message === 'string' && override.message.trim().length > 0
      ? override.message.trim()
      : DEFAULT_BACKGROUND_LOCATION_RATIONALE.message;

  const buttonPositive =
    typeof override?.buttonPositive === 'string' &&
    override.buttonPositive.trim().length > 0
      ? override.buttonPositive.trim()
      : DEFAULT_BACKGROUND_LOCATION_RATIONALE.buttonPositive;

  const buttonNegative =
    typeof override?.buttonNegative === 'string' &&
    override.buttonNegative.trim().length > 0
      ? override.buttonNegative.trim()
      : DEFAULT_BACKGROUND_LOCATION_RATIONALE.buttonNegative;

  const buttonNeutral =
    typeof override?.buttonNeutral === 'string' &&
    override.buttonNeutral.trim().length > 0
      ? override.buttonNeutral.trim()
      : DEFAULT_BACKGROUND_LOCATION_RATIONALE.buttonNeutral;

  return {
    title,
    message,
    buttonPositive,
    buttonNegative,
    buttonNeutral,
  };
}
