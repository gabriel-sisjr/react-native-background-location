import { PluginError } from '../errors/PluginError';
import type { BackgroundLocationPluginProps } from './types';

/**
 * Every option the plugin accepts. Anything else is rejected with
 * `UNKNOWN_PROP`, so a misspelled option fails loudly instead of silently
 * falling back to the generic default copy.
 */
const KNOWN_PROPS = [
  'locationWhenInUseUsageDescription',
  'locationAlwaysAndWhenInUseUsageDescription',
  'locationAlwaysUsageDescription',
  'temporaryUsageDescriptions',
] as const;

/** `typeof null` is `'object'`; report it as `null` so the message is not misleading. */
function typeName(value: unknown): string {
  return value === null ? 'null' : typeof value;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === '[object Object]'
  );
}

function assertOptionalNonEmptyString(
  value: unknown,
  fieldName: string,
  code: 'INVALID_USAGE_DESCRIPTION'
): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') {
    throw new PluginError(
      code,
      `\`${fieldName}\` must be a string when provided. Received ${typeName(value)}.`,
      { fieldName, value }
    );
  }
  if (value.trim().length === 0) {
    throw new PluginError(
      code,
      `\`${fieldName}\` must not be empty or whitespace-only.`,
      { fieldName }
    );
  }
  return value;
}

function assertOptionalStringRecord(
  value: unknown,
  fieldName: string
): Record<string, string> | undefined {
  if (value === undefined) return undefined;
  if (!isPlainObject(value)) {
    throw new PluginError(
      'INVALID_TEMPORARY_USAGE_DESCRIPTIONS',
      `\`${fieldName}\` must be a plain object mapping purpose keys to usage strings.`,
      { fieldName, value }
    );
  }
  for (const [k, v] of Object.entries(value)) {
    if (typeof v !== 'string' || v.trim().length === 0) {
      throw new PluginError(
        'INVALID_TEMPORARY_USAGE_DESCRIPTION_VALUE',
        `\`${fieldName}["${k}"]\` must be a non-empty string. Received ${typeName(v)}.`,
        { fieldName, key: k, value: v }
      );
    }
  }
  return value as Record<string, string>;
}

export function validatePluginProps(
  raw: unknown
): BackgroundLocationPluginProps {
  if (raw === undefined || raw === null) return {};
  if (!isPlainObject(raw)) {
    throw new PluginError(
      'INVALID_PROPS_TYPE',
      `Plugin props must be a plain object. Received ${typeof raw}.`,
      { raw }
    );
  }

  const unknownKeys = Object.keys(raw).filter(
    (key) => !(KNOWN_PROPS as readonly string[]).includes(key)
  );
  if (unknownKeys.length > 0) {
    const list = (keys: readonly string[]) =>
      keys.map((key) => `\`${key}\``).join(', ');
    throw new PluginError(
      'UNKNOWN_PROP',
      `Unknown plugin option${unknownKeys.length > 1 ? 's' : ''}: ${list(unknownKeys)}. Supported options: ${list(KNOWN_PROPS)}.`,
      { unknownKeys }
    );
  }

  return {
    locationWhenInUseUsageDescription: assertOptionalNonEmptyString(
      raw.locationWhenInUseUsageDescription,
      'locationWhenInUseUsageDescription',
      'INVALID_USAGE_DESCRIPTION'
    ),
    locationAlwaysAndWhenInUseUsageDescription: assertOptionalNonEmptyString(
      raw.locationAlwaysAndWhenInUseUsageDescription,
      'locationAlwaysAndWhenInUseUsageDescription',
      'INVALID_USAGE_DESCRIPTION'
    ),
    locationAlwaysUsageDescription: assertOptionalNonEmptyString(
      raw.locationAlwaysUsageDescription,
      'locationAlwaysUsageDescription',
      'INVALID_USAGE_DESCRIPTION'
    ),
    temporaryUsageDescriptions: assertOptionalStringRecord(
      raw.temporaryUsageDescriptions,
      'temporaryUsageDescriptions'
    ),
  };
}
