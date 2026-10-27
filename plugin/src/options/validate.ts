import { PluginError } from '../errors/PluginError';
import type {
  BackgroundLocationPluginProps,
  MotionActivityPluginProps,
} from './types';

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
  'motionActivity',
] as const;

/**
 * Every key accepted inside the `motionActivity` object, rejected the same
 * way as the top-level options.
 */
const KNOWN_MOTION_ACTIVITY_PROPS = ['usageDescription'] as const;

/** `typeof null` is `'object'`; report it as `null` so the message is not misleading. */
function typeName(value: unknown): string {
  return value === null ? 'null' : typeof value;
}

/** Formats option names as a comma-separated list of code spans. */
function formatKeys(keys: readonly string[]): string {
  return keys.map((key) => `\`${key}\``).join(', ');
}

function assertNoUnknownKeys(
  value: Record<string, unknown>,
  knownKeys: readonly string[],
  prefix: string
): void {
  const unknownKeys = Object.keys(value)
    .filter((key) => !knownKeys.includes(key))
    .map((key) => `${prefix}${key}`);
  if (unknownKeys.length > 0) {
    throw new PluginError(
      'UNKNOWN_PROP',
      `Unknown plugin option${unknownKeys.length > 1 ? 's' : ''}: ${formatKeys(unknownKeys)}. Supported options: ${formatKeys(knownKeys.map((key) => `${prefix}${key}`))}.`,
      { unknownKeys }
    );
  }
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

/**
 * `motionActivity` opts in by presence: absent means "not requested", and a
 * plain object (even `{}`) means "requested". Every other value is rejected,
 * `true` included, so the opt-in is always written the same way.
 */
function assertOptionalMotionActivity(
  value: unknown
): MotionActivityPluginProps | undefined {
  if (value === undefined) return undefined;
  if (!isPlainObject(value)) {
    const received = Array.isArray(value) ? 'array' : typeName(value);
    throw new PluginError(
      'INVALID_MOTION_ACTIVITY',
      `\`motionActivity\` must be a plain object (use \`{}\` to opt in with the default usage string). Received ${received}.`,
      { fieldName: 'motionActivity', value }
    );
  }

  assertNoUnknownKeys(value, KNOWN_MOTION_ACTIVITY_PROPS, 'motionActivity.');

  const usageDescription = assertOptionalNonEmptyString(
    value.usageDescription,
    'motionActivity.usageDescription',
    'INVALID_USAGE_DESCRIPTION'
  );
  return usageDescription === undefined ? {} : { usageDescription };
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

  assertNoUnknownKeys(raw, KNOWN_PROPS, '');

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
    motionActivity: assertOptionalMotionActivity(raw.motionActivity),
  };
}
