import { PluginError } from '../errors/PluginError';
import type { BackgroundLocationPluginProps } from './types';

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
      `\`${fieldName}\` must be a string when provided. Received ${typeof value}.`,
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
        `\`${fieldName}["${k}"]\` must be a non-empty string. Received ${typeof v}.`,
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
