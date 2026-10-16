import * as fs from 'fs';
import * as path from 'path';
import {
  IOSConfig,
  WarningAggregator,
  withFinalizedMod,
  type ConfigPlugin,
} from 'expo/config-plugins';
import { getExpoSdkMajor } from '../utils/expoSdk';

/**
 * Minimum iOS deployment target required by `BackgroundLocation.podspec`
 * (`s.platforms = { :ios => '16.0' }`).
 */
export const MIN_IOS_DEPLOYMENT_TARGET = '16.0';

/** Key read by Expo's generated Podfile: `podfile_properties['ios.deploymentTarget']`. */
export const PODFILE_DEPLOYMENT_TARGET_KEY = 'ios.deploymentTarget';

/**
 * First Expo SDK whose prebuild template already ships an iOS deployment
 * target (16.4) above {@link MIN_IOS_DEPLOYMENT_TARGET}. SDK 54 and 55 ship
 * 15.1 in the Podfile fallback and in every `IPHONEOS_DEPLOYMENT_TARGET`.
 * Only a fallback: the generated `ios/Podfile` is read first, and this number
 * decides only when that file cannot be read or parsed.
 */
const FIRST_SDK_WITH_DEFAULT_TARGET_ABOVE_MINIMUM = 56;

const WARNING_SCOPE = 'withIosDeploymentTarget';

type IosVersion = readonly [major: number, minor: number, patch: number];

const VERSION_PATTERN = /^(\d+)(?:\.(\d+))?(?:\.(\d+))?$/;

/**
 * Parses `"major"`, `"major.minor"` or `"major.minor.patch"` (a finite number
 * and a value wrapped in double quotes, as the `xcode` parser may return, are
 * accepted too). Anything else - `undefined`, `"latest"`, `"$(inherited)"`,
 * `"16.x"`, objects - is "unparsable" and yields `null`.
 */
export function parseIosVersion(value: unknown): IosVersion | null {
  const text =
    typeof value === 'number' && Number.isFinite(value) ? String(value) : value;
  if (typeof text !== 'string') return null;
  const match = VERSION_PATTERN.exec(text.trim().replace(/^"(.*)"$/, '$1'));
  if (!match) return null;
  return [Number(match[1]), Number(match[2] ?? 0), Number(match[3] ?? 0)];
}

/**
 * Numeric (not lexicographic) comparison: negative when `a < b`, `0` when
 * equal (`"16"` equals `"16.0"` equals `"16.0.0"`), positive when `a > b`.
 * Returns `null` when either side is unparsable.
 */
export function compareIosVersions(a: unknown, b: unknown): number | null {
  const left = parseIosVersion(a);
  const right = parseIosVersion(b);
  if (!left || !right) return null;
  const [aMajor, aMinor, aPatch] = left;
  const [bMajor, bMinor, bPatch] = right;
  return aMajor - bMajor || aMinor - bMinor || aPatch - bPatch;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * `platform :ios, podfile_properties['ios.deploymentTarget'] || '15.1'`: the
 * line of Expo's generated Podfile (identical on SDK 54-58 apart from the
 * version) that holds the value CocoaPods uses when the key is absent. Anchored
 * to the start of a line so that a commented-out copy is never read.
 */
const PODFILE_FALLBACK_PATTERN =
  /^[ \t]*platform\s+:ios\s*,\s*podfile_properties\['ios\.deploymentTarget'\]\s*\|\|\s*'([\d.]+)'/m;

/**
 * The fallback version in `<platformProjectRoot>/Podfile`; `undefined` when the
 * file cannot be read or does not contain the expected line.
 */
export function readPodfileFallback(
  platformProjectRoot: string
): string | undefined {
  try {
    const podfile = fs.readFileSync(
      path.join(platformProjectRoot, 'Podfile'),
      'utf8'
    );
    return PODFILE_FALLBACK_PATTERN.exec(podfile)?.[1];
  } catch {
    return undefined;
  }
}

/**
 * Whether the Podfile fallback (the value used when `ios.deploymentTarget` is
 * absent from `Podfile.properties.json`) is below the library minimum.
 *
 * The generated Podfile is the ground truth, because the template comes from
 * the installed `expo` package. `config.sdkVersion` (which can be
 * `UNVERSIONED`, missing or stale) only decides when the Podfile cannot be
 * parsed. An unknown SDK then answers `false` on purpose: writing 16.0 where
 * the template already defaults to 16.4 would LOWER the target below what Expo
 * itself needs (`Expo.podspec` requires 16.4 from SDK 56) and break
 * `pod install`.
 */
function templateDefaultIsBelowMinimum(
  sdkMajor: number | undefined,
  podfileFallback: string | undefined
): boolean {
  const cmp = compareIosVersions(podfileFallback, MIN_IOS_DEPLOYMENT_TARGET);
  if (cmp !== null) return cmp < 0;
  return (
    sdkMajor !== undefined &&
    sdkMajor < FIRST_SDK_WITH_DEFAULT_TARGET_ABOVE_MINIMUM
  );
}

/**
 * Raises `ios.deploymentTarget` in the parsed `Podfile.properties.json`.
 *
 * - absent / `null` / `""`: written as 16.0 only when the template default
 *   (`podfileFallback`, read from the generated Podfile, else inferred from the
 *   SDK: 54/55) is below 16.0, otherwise left absent (the default is already
 *   >= 16.0, 16.4 from SDK 56);
 * - present and below 16.0: raised to 16.0 (a higher value is never touched);
 * - present but unparsable: discarded, then handled as absent.
 *
 * Mutates `podfileProperties` and returns a warning text when a value that
 * somebody explicitly wrote was overridden (`null` otherwise).
 */
export function raisePodfileDeploymentTarget(
  podfileProperties: Record<string, unknown>,
  sdkMajor: number | undefined,
  podfileFallback?: string
): string | null {
  const current = podfileProperties[PODFILE_DEPLOYMENT_TARGET_KEY];
  const isAbsent = current === undefined || current === null || current === '';
  const cmp = isAbsent
    ? null
    : compareIosVersions(current, MIN_IOS_DEPLOYMENT_TARGET);

  if (cmp !== null && cmp >= 0) return null;

  if (cmp !== null) {
    podfileProperties[PODFILE_DEPLOYMENT_TARGET_KEY] =
      MIN_IOS_DEPLOYMENT_TARGET;
    return (
      `\`${PODFILE_DEPLOYMENT_TARGET_KEY}\` was ${String(current)}, but ` +
      `@gabriel-sisjr/react-native-background-location needs iOS ` +
      `${MIN_IOS_DEPLOYMENT_TARGET} or newer. It was raised to ` +
      `${MIN_IOS_DEPLOYMENT_TARGET}. Set \`ios.deploymentTarget\` to ` +
      `${MIN_IOS_DEPLOYMENT_TARGET} or higher (expo-build-properties on ` +
      `Expo SDK 54/55, app config on SDK 56+) to silence this warning.` +
      (sdkMajor !== undefined &&
      sdkMajor >= FIRST_SDK_WITH_DEFAULT_TARGET_ABOVE_MINIMUM
        ? ` Expo SDK ${FIRST_SDK_WITH_DEFAULT_TARGET_ABOVE_MINIMUM}+ itself ` +
          `requires a newer iOS than ${MIN_IOS_DEPLOYMENT_TARGET} (16.4 on SDK ` +
          `56-58), so remove \`ios.deploymentTarget\` to use the SDK default.`
        : '')
    );
  }

  // Absent, or present but unparsable (discard the garbage first).
  if (!isAbsent) delete podfileProperties[PODFILE_DEPLOYMENT_TARGET_KEY];
  if (templateDefaultIsBelowMinimum(sdkMajor, podfileFallback)) {
    podfileProperties[PODFILE_DEPLOYMENT_TARGET_KEY] =
      MIN_IOS_DEPLOYMENT_TARGET;
  }
  return isAbsent
    ? null
    : `\`${PODFILE_DEPLOYMENT_TARGET_KEY}\` held an invalid value ` +
        `(${JSON.stringify(current)}) and was discarded.`;
}

/**
 * Raises every `IPHONEOS_DEPLOYMENT_TARGET` below 16.0 found in the
 * `XCBuildConfiguration` section of a parsed `project.pbxproj` (project-level
 * and target-level, Debug and Release). Values that are not plain versions
 * (`$(inherited)`, other build-setting references) and values already >= 16.0
 * are left untouched. Mutates `section` and returns how many were raised.
 */
export function raiseXcodeBuildConfigurations(
  section: Record<string, unknown>
): number {
  let raised = 0;
  for (const [key, entry] of Object.entries(section)) {
    if (key.endsWith('_comment') || !isRecord(entry)) continue;
    const buildSettings = entry.buildSettings;
    if (!isRecord(buildSettings)) continue;
    const cmp = compareIosVersions(
      buildSettings.IPHONEOS_DEPLOYMENT_TARGET,
      MIN_IOS_DEPLOYMENT_TARGET
    );
    if (cmp === null || cmp >= 0) continue;
    buildSettings.IPHONEOS_DEPLOYMENT_TARGET = MIN_IOS_DEPLOYMENT_TARGET;
    raised += 1;
  }
  return raised;
}

function enforceOnPodfileProperties(
  platformProjectRoot: string,
  sdkMajor: number | undefined
): void {
  const file = path.join(platformProjectRoot, 'Podfile.properties.json');
  let properties: Record<string, unknown> = {};
  if (fs.existsSync(file)) {
    try {
      const parsed: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (!isRecord(parsed)) throw new Error('not a JSON object');
      properties = parsed;
    } catch {
      // Never rewrite a file we cannot read faithfully.
      WarningAggregator.addWarningIOS(
        WARNING_SCOPE,
        `Could not parse ${file}; the iOS deployment target was not verified. ` +
          `@gabriel-sisjr/react-native-background-location needs iOS ` +
          `${MIN_IOS_DEPLOYMENT_TARGET} or newer.`
      );
      return;
    }
  }
  const before = JSON.stringify(properties);
  const warning = raisePodfileDeploymentTarget(
    properties,
    sdkMajor,
    readPodfileFallback(platformProjectRoot)
  );
  if (warning) WarningAggregator.addWarningIOS(WARNING_SCOPE, warning);
  if (JSON.stringify(properties) !== before) {
    fs.writeFileSync(file, `${JSON.stringify(properties, null, 2)}\n`);
  }
}

interface XcodeProjectLike {
  filepath: string;
  pbxXCBuildConfigurationSection(): Record<string, unknown>;
  writeSync(): string;
}

function enforceOnXcodeProject(projectRoot: string): void {
  const project = IOSConfig.XcodeUtils.getPbxproj(
    projectRoot
  ) as XcodeProjectLike;
  const raised = raiseXcodeBuildConfigurations(
    project.pbxXCBuildConfigurationSection() ?? {}
  );
  if (raised > 0) fs.writeFileSync(project.filepath, project.writeSync());
}

/**
 * Guarantees an iOS deployment target of at least 16.0, the minimum in
 * `BackgroundLocation.podspec`, so `expo-build-properties` is no longer needed
 * for it. Both places the iOS build reads are covered: the `ios.deploymentTarget`
 * key of `ios/Podfile.properties.json` (the Pods project) and every
 * `IPHONEOS_DEPLOYMENT_TARGET` of `project.pbxproj` (the app).
 *
 * Runs as a *finalized* mod. Expo runs mods last-registered-first, so a regular
 * mod would be overwritten by `expo-build-properties` whenever this plugin is
 * listed after it; finalized mods run after every regular mod, so the result
 * does not depend on where this plugin sits relative to `expo-build-properties`
 * or any other plugin that uses regular mods. Finalized mods of different
 * plugins still run last-registered-first, so a plugin that writes the target
 * from its own finalized mod and is listed before this one runs after it. A
 * value that is already higher is never lowered, and the pass is idempotent
 * (files are rewritten only when they change).
 *
 * Whether `ios.deploymentTarget` has to be written at all depends on the
 * template default, which is read from the generated `ios/Podfile` (the
 * `|| '15.1'` fallback of the `platform :ios` line) and only inferred from
 * `config.sdkVersion` when that line cannot be parsed.
 */
export const withIosDeploymentTarget: ConfigPlugin = (config) =>
  withFinalizedMod(config, [
    'ios',
    async (cfg) => {
      const { introspect, projectRoot, platformProjectRoot } = cfg.modRequest;
      // Introspection must not touch the file system. Defensive; Expo drops
      // finalized mods during introspection.
      if (introspect) return cfg;
      enforceOnPodfileProperties(
        platformProjectRoot,
        getExpoSdkMajor(cfg.sdkVersion)
      );
      enforceOnXcodeProject(projectRoot);
      return cfg;
    },
  ]);
