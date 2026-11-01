import type { TrackingOptionsSpec } from '../NativeBackgroundLocation';

/**
 * Motion keys of the flat {@link TrackingOptionsSpec}.
 */
type MotionSpecFields = Pick<
  TrackingOptionsSpec,
  | 'motionActivityEnabled'
  | 'motionSampleInterval'
  | 'motionReduceWhenStationary'
  | 'motionStationaryDelay'
  | 'motionAutomotiveCooldown'
  | 'motionMaxReducedDuration'
  | 'motionReducedNotificationText'
>;

interface MillisecondsRange {
  min: number;
  max: number;
}

const SAMPLE_INTERVAL_RANGE: MillisecondsRange = { min: 10000, max: 300000 };

/**
 * Numeric options of `reduceWhenStationary`, with their spec key and range.
 * If any of them is malformed, the whole reduction is turned off.
 */
const REDUCTION_NUMBER_FIELDS: ReadonlyArray<{
  option: 'stationaryDelay' | 'automotiveCooldown' | 'maxReducedDuration';
  specKey:
    | 'motionStationaryDelay'
    | 'motionAutomotiveCooldown'
    | 'motionMaxReducedDuration';
  range: MillisecondsRange;
}> = [
  {
    option: 'stationaryDelay',
    specKey: 'motionStationaryDelay',
    range: { min: 60000, max: 3600000 },
  },
  {
    option: 'automotiveCooldown',
    specKey: 'motionAutomotiveCooldown',
    range: { min: 120000, max: 3600000 },
  },
  {
    option: 'maxReducedDuration',
    specKey: 'motionMaxReducedDuration',
    range: { min: 300000, max: 3600000 },
  },
];

/**
 * Fields already warned about. Intentionally module-scoped for
 * once-per-JS-session behavior.
 */
const warnedFields = new Set<string>();

/**
 * Emits a `__DEV__`-only console.warn, at most once per field per JS session.
 */
function warnOnce(field: string, problem: string): void {
  if (!__DEV__ || warnedFields.has(field)) {
    return;
  }
  warnedFields.add(field);
  console.warn(`[BackgroundLocation] ${field} ${problem}`);
}

function isAbsent(value: unknown): value is null | undefined {
  return value === undefined || value === null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === '[object Object]';
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function clampToInteger(value: number, range: MillisecondsRange): number {
  return Math.round(Math.min(Math.max(value, range.min), range.max));
}

function toSampleIntervalFields(value: unknown): MotionSpecFields {
  if (isAbsent(value)) {
    return {};
  }
  if (!isFiniteNumber(value)) {
    warnOnce(
      'motionActivity.sampleInterval',
      'must be a finite number of milliseconds; the default is used.'
    );
    return {};
  }
  return { motionSampleInterval: clampToInteger(value, SAMPLE_INTERVAL_RANGE) };
}

function toReductionFields(value: unknown): MotionSpecFields {
  if (isAbsent(value) || value === false) {
    return {};
  }
  if (value === true) {
    return { motionReduceWhenStationary: true };
  }
  if (!isPlainObject(value)) {
    warnOnce(
      'motionActivity.reduceWhenStationary',
      'must be a boolean or an object; reduceWhenStationary is disabled.'
    );
    return {};
  }

  const fields: MotionSpecFields = { motionReduceWhenStationary: true };
  let malformed = false;
  for (const { option, specKey, range } of REDUCTION_NUMBER_FIELDS) {
    const raw = value[option];
    if (isAbsent(raw)) {
      continue;
    }
    if (!isFiniteNumber(raw)) {
      warnOnce(
        `motionActivity.reduceWhenStationary.${option}`,
        'must be a finite number of milliseconds; reduceWhenStationary is disabled.'
      );
      malformed = true;
      continue;
    }
    fields[specKey] = clampToInteger(raw, range);
  }
  if (malformed) {
    // Reduction off: tracking keeps continuous full-accuracy updates.
    return {};
  }

  const text = value.notificationText;
  if (typeof text === 'string') {
    if (text.trim().length > 0) {
      fields.motionReducedNotificationText = text;
    }
  } else if (!isAbsent(text)) {
    warnOnce(
      'motionActivity.reduceWhenStationary.notificationText',
      'must be a string; the default notification text is used.'
    );
  }
  return fields;
}

/**
 * Flattens the public `TrackingOptions.motionActivity` value into the
 * optional primitive `motion*` keys of the {@link TrackingOptionsSpec}
 * (Codegen does not support nested objects).
 *
 * - `undefined`, `null` or `false`: no `motion*` key at all (feature off).
 * - `true` or a plain object: `motionActivityEnabled: true`, plus every
 *   valid option, clamped to its documented range and rounded to whole
 *   milliseconds.
 * - Malformed values (wrong type, `NaN`, `Infinity`) never cross the bridge:
 *   the affected part falls back to its default or turns off, and a
 *   `__DEV__`-only warning is logged once per field per JS session.
 *
 * Never throws and never fills in defaults: absent options stay absent and
 * the native layers apply the defaults.
 *
 * @internal
 */
export function toMotionSpecFields(value: unknown): MotionSpecFields {
  if (isAbsent(value) || value === false) {
    return {};
  }
  if (value === true) {
    return { motionActivityEnabled: true };
  }
  if (!isPlainObject(value)) {
    warnOnce(
      'motionActivity',
      'must be a boolean or an object; motion activity is disabled.'
    );
    return {};
  }
  return {
    motionActivityEnabled: true,
    ...toSampleIntervalFields(value.sampleInterval),
    ...toReductionFields(value.reduceWhenStationary),
  };
}
