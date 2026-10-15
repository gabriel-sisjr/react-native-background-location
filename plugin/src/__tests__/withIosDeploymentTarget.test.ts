import * as fs from 'fs';
import { WarningAggregator } from 'expo/config-plugins';
import type { ConfigPlugin } from 'expo/config-plugins';
import {
  MIN_IOS_DEPLOYMENT_TARGET,
  PODFILE_DEPLOYMENT_TARGET_KEY,
  compareIosVersions,
  parseIosVersion,
  raisePodfileDeploymentTarget,
  raiseXcodeBuildConfigurations,
  withIosDeploymentTarget,
} from '../ios/withIosDeploymentTarget';
import { withBackgroundLocation } from '../withBackgroundLocation';
import {
  TEMPLATE_54_55,
  TEMPLATE_56_PLUS,
  createPbxproj,
  createTempIosProject,
  type TempIosProject,
} from './fixtures/iosProject';
import { hasRegisteredIosMod, runIosFinalizedMod } from './utils/makeConfig';

// Newer `expo` builds export `WarningAggregator.addWarningIOS` as a
// non-configurable getter, so `jest.spyOn` would throw there. Replace the
// export through a module mock instead.
jest.mock('expo/config-plugins', () => {
  const actual = jest.requireActual('expo/config-plugins');
  return {
    ...actual,
    WarningAggregator: {
      ...actual.WarningAggregator,
      addWarningIOS: jest.fn(),
    },
  };
});

type ExpoConfig = Parameters<ConfigPlugin<unknown>>[0];

const warn = WarningAggregator.addWarningIOS as unknown as jest.Mock;

const KEY = PODFILE_DEPLOYMENT_TARGET_KEY;

const configForSdk = (sdkMajor: number | undefined): ExpoConfig => ({
  name: 'app',
  slug: 'app',
  ios: {},
  android: {},
  ...(sdkMajor === undefined ? {} : { sdkVersion: `${sdkMajor}.0.0` }),
});

describe('parseIosVersion / compareIosVersions', () => {
  it.each([
    ['16', [16, 0, 0]],
    ['16.0', [16, 0, 0]],
    ['16.0.0', [16, 0, 0]],
    ['16.4.1', [16, 4, 1]],
    ['26', [26, 0, 0]],
    [' 17.0 ', [17, 0, 0]],
    ['"15.1"', [15, 1, 0]],
    [16, [16, 0, 0]],
    [15.1, [15, 1, 0]],
  ])('parses %p', (input, expected) => {
    expect(parseIosVersion(input)).toEqual(expected);
  });

  it.each([
    undefined,
    null,
    '',
    '   ',
    'latest',
    '$(inherited)',
    '16.x',
    '16.0.0.1',
    '-1',
    '1e2',
    NaN,
    Infinity,
    {},
    [],
    true,
  ])('treats %p as unparsable', (input) => {
    expect(parseIosVersion(input)).toBeNull();
  });

  it('compares numerically, not lexicographically', () => {
    expect(compareIosVersions('15.1', '16.0')).toBeLessThan(0);
    expect(compareIosVersions('9.3', '16.0')).toBeLessThan(0);
    expect(compareIosVersions('16.10', '16.4')).toBeGreaterThan(0);
    expect(compareIosVersions('17', '16.9.9')).toBeGreaterThan(0);
    expect(compareIosVersions('16.0.1', '16.0')).toBeGreaterThan(0);
  });

  it('treats "16", "16.0" and "16.0.0" as equal', () => {
    expect(compareIosVersions('16', '16.0')).toBe(0);
    expect(compareIosVersions('16.0', '16.0.0')).toBe(0);
  });

  it('returns null when either side is unparsable', () => {
    expect(compareIosVersions('latest', '16.0')).toBeNull();
    expect(compareIosVersions('16.0', undefined)).toBeNull();
  });
});

describe('raisePodfileDeploymentTarget', () => {
  describe('key absent (template default)', () => {
    it.each([54, 55])(
      'writes 16.0 silently on SDK %i (Podfile fallback is 15.1)',
      (sdk) => {
        const props: Record<string, unknown> = { 'expo.jsEngine': 'hermes' };
        expect(raisePodfileDeploymentTarget(props, sdk)).toBeNull();
        expect(props).toEqual({
          'expo.jsEngine': 'hermes',
          [KEY]: MIN_IOS_DEPLOYMENT_TARGET,
        });
      }
    );

    it.each([56, 57, 58, 59])(
      'leaves the key absent on SDK %i (Podfile fallback is already 16.4)',
      (sdk) => {
        const props: Record<string, unknown> = { 'expo.jsEngine': 'hermes' };
        expect(raisePodfileDeploymentTarget(props, sdk)).toBeNull();
        expect(props).toEqual({ 'expo.jsEngine': 'hermes' });
      }
    );

    it('does nothing when the SDK is unknown (never risk lowering a 16.4 default)', () => {
      const props: Record<string, unknown> = {};
      expect(raisePodfileDeploymentTarget(props, undefined)).toBeNull();
      expect(props).toEqual({});
    });

    it.each([null, ''])('treats %p as absent', (value) => {
      const props: Record<string, unknown> = { [KEY]: value };
      expect(raisePodfileDeploymentTarget(props, 54)).toBeNull();
      expect(props[KEY]).toBe('16.0');
    });
  });

  describe('explicit value below 16.0', () => {
    it.each([54, 55, 56, 58])(
      'raises 15.1 to 16.0 on SDK %i and warns',
      (sdk) => {
        const props: Record<string, unknown> = { [KEY]: '15.1' };
        const warning = raisePodfileDeploymentTarget(props, sdk);
        expect(props[KEY]).toBe('16.0');
        expect(warning).toContain('15.1');
        expect(warning).toContain('16.0');
      }
    );

    it('tells SDK 56+ users that Expo itself needs a newer iOS than 16.0', () => {
      const props56: Record<string, unknown> = { [KEY]: '15.1' };
      const props54: Record<string, unknown> = { [KEY]: '15.1' };
      expect(raisePodfileDeploymentTarget(props56, 56)).toContain(
        'Expo SDK 56+ itself requires'
      );
      expect(raisePodfileDeploymentTarget(props54, 54)).not.toContain(
        'Expo SDK 56+'
      );
    });

    it('raises a numeric value and writes a string back', () => {
      const props: Record<string, unknown> = { [KEY]: 15.1 };
      expect(raisePodfileDeploymentTarget(props, 54)).not.toBeNull();
      expect(props[KEY]).toBe('16.0');
    });

    it('raises "15" (major only)', () => {
      const props: Record<string, unknown> = { [KEY]: '15' };
      raisePodfileDeploymentTarget(props, 54);
      expect(props[KEY]).toBe('16.0');
    });
  });

  describe('explicit value at or above 16.0 is never touched', () => {
    it.each(['16.0', '16', '16.0.0', '16.4', '17.0', '26', '16.10'])(
      'keeps %p',
      (value) => {
        const props: Record<string, unknown> = { [KEY]: value };
        expect(raisePodfileDeploymentTarget(props, 54)).toBeNull();
        expect(props[KEY]).toBe(value);
      }
    );
  });

  describe('garbage', () => {
    it.each(['latest', '16.x', {}, [], true])(
      'discards %p and warns, then applies the absent rule (SDK 54 -> 16.0)',
      (value) => {
        const props: Record<string, unknown> = { [KEY]: value };
        const warning = raisePodfileDeploymentTarget(props, 54);
        expect(warning).toContain('invalid value');
        expect(props[KEY]).toBe('16.0');
      }
    );

    it('discards garbage and leaves the key absent on SDK 58 (default is 16.4)', () => {
      const props: Record<string, unknown> = { [KEY]: 'latest' };
      expect(raisePodfileDeploymentTarget(props, 58)).not.toBeNull();
      expect(KEY in props).toBe(false);
    });
  });

  it('is idempotent', () => {
    const props: Record<string, unknown> = { [KEY]: '15.1' };
    raisePodfileDeploymentTarget(props, 54);
    const snapshot = JSON.stringify(props);
    expect(raisePodfileDeploymentTarget(props, 54)).toBeNull();
    expect(JSON.stringify(props)).toBe(snapshot);
  });

  it('does not touch unrelated keys', () => {
    const props: Record<string, unknown> = {
      'expo.jsEngine': 'hermes',
      'newArchEnabled': 'true',
      [KEY]: '15.1',
    };
    raisePodfileDeploymentTarget(props, 54);
    expect(props['expo.jsEngine']).toBe('hermes');
    expect(props.newArchEnabled).toBe('true');
  });
});

describe('raiseXcodeBuildConfigurations', () => {
  const section = (...targets: unknown[]): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    targets.forEach((value, i) => {
      out[`ID${i}`] = {
        isa: 'XCBuildConfiguration',
        buildSettings: { IPHONEOS_DEPLOYMENT_TARGET: value, OTHER: 'x' },
      };
      out[`ID${i}_comment`] = 'Debug';
    });
    return out;
  };

  const targetsOf = (s: Record<string, unknown>): unknown[] =>
    Object.entries(s)
      .filter(([k]) => !k.endsWith('_comment'))
      .map(
        ([, v]) =>
          (v as { buildSettings: { IPHONEOS_DEPLOYMENT_TARGET: unknown } })
            .buildSettings.IPHONEOS_DEPLOYMENT_TARGET
      );

  it('raises every configuration below 16.0 (project and target level)', () => {
    const s = section('15.1', '15.1', '15.1', '15.1');
    expect(raiseXcodeBuildConfigurations(s)).toBe(4);
    expect(targetsOf(s)).toEqual(['16.0', '16.0', '16.0', '16.0']);
  });

  it('never lowers a higher value and only raises what is below', () => {
    const s = section('15.1', '16.4', '17.0', '16.0', '9.3');
    expect(raiseXcodeBuildConfigurations(s)).toBe(2);
    expect(targetsOf(s)).toEqual(['16.0', '16.4', '17.0', '16.0', '16.0']);
  });

  it('leaves variable references and garbage alone', () => {
    const s = section('"$(inherited)"', 'latest', undefined, 15.1);
    expect(raiseXcodeBuildConfigurations(s)).toBe(1);
    expect(targetsOf(s)).toEqual([
      '"$(inherited)"',
      'latest',
      undefined,
      '16.0',
    ]);
  });

  it('skips comment keys, non-objects and entries without buildSettings', () => {
    const s: Record<string, unknown> = {
      ...section('15.1'),
      NO_SETTINGS: { isa: 'XCBuildConfiguration' },
      NULL_ENTRY: null,
      STRING_ENTRY: 'nope',
      ID9_comment: 'Release',
    };
    expect(raiseXcodeBuildConfigurations(s)).toBe(1);
  });

  it('is idempotent', () => {
    const s = section('15.1', '15.1');
    raiseXcodeBuildConfigurations(s);
    expect(raiseXcodeBuildConfigurations(s)).toBe(0);
  });
});

describe('withIosDeploymentTarget (finalized mod on disk)', () => {
  let project: TempIosProject;

  afterEach(() => {
    project?.cleanup();
  });

  const run = async (
    sdk: number | undefined,
    opts?: { introspect?: boolean }
  ) =>
    runIosFinalizedMod(
      withIosDeploymentTarget(configForSdk(sdk)),
      project.projectRoot,
      opts
    );

  it('registers only a finalized mod (no regular podfileProperties/xcodeproj mod)', () => {
    const config = withIosDeploymentTarget(configForSdk(54));
    expect(hasRegisteredIosMod(config, 'finalized')).toBe(true);
    expect(hasRegisteredIosMod(config, 'podfileProperties')).toBe(false);
    expect(hasRegisteredIosMod(config, 'xcodeproj')).toBe(false);
  });

  it('SDK 54 template: writes 16.0 to Podfile.properties.json and every IPHONEOS_DEPLOYMENT_TARGET, silently', async () => {
    project = createTempIosProject({
      podfileProperties: { 'expo.jsEngine': 'hermes' },
      pbxproj: createPbxproj(TEMPLATE_54_55),
    });
    await run(54);
    expect(project.readPodfileProperties()).toEqual({
      'expo.jsEngine': 'hermes',
      [KEY]: '16.0',
    });
    expect(project.readDeploymentTargets()).toEqual([
      '16.0',
      '16.0',
      '16.0',
      '16.0',
    ]);
    expect(warn).not.toHaveBeenCalled();
  });

  it('SDK 56 template: byte-for-byte no-op', async () => {
    project = createTempIosProject({
      podfileProperties: { 'expo.jsEngine': 'hermes' },
      pbxproj: createPbxproj(TEMPLATE_56_PLUS),
    });
    const podBefore = fs.readFileSync(project.podfilePropertiesPath);
    const pbxBefore = fs.readFileSync(project.pbxprojPath);
    const mtimeBefore = fs.statSync(project.pbxprojPath).mtimeMs;
    await run(56);
    expect(fs.readFileSync(project.podfilePropertiesPath)).toEqual(podBefore);
    expect(fs.readFileSync(project.pbxprojPath)).toEqual(pbxBefore);
    expect(fs.statSync(project.pbxprojPath).mtimeMs).toBe(mtimeBefore);
    expect(warn).not.toHaveBeenCalled();
  });

  it('wins over a lower value written by another plugin (the order-independence contract)', async () => {
    // What expo-build-properties { ios: { deploymentTarget: "15.1" } } leaves
    // behind when it runs after every regular mod of this plugin.
    project = createTempIosProject({
      podfileProperties: { [KEY]: '15.1' },
      pbxproj: createPbxproj({
        projectDebug: '16.0',
        projectRelease: '16.0',
        targetDebug: '15.1',
        targetRelease: '15.1',
      }),
    });
    await run(54);
    expect(project.readPodfileProperties()[KEY]).toBe('16.0');
    expect(project.readDeploymentTargets()).toEqual([
      '16.0',
      '16.0',
      '16.0',
      '16.0',
    ]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      'withIosDeploymentTarget',
      expect.stringContaining('15.1')
    );
  });

  it('never lowers higher values (17.0 target-level, 16.4 project-level)', async () => {
    project = createTempIosProject({
      podfileProperties: { [KEY]: '17.0' },
      pbxproj: createPbxproj({
        projectDebug: '16.4',
        projectRelease: '16.4',
        targetDebug: '17.0',
        targetRelease: '17.0',
      }),
    });
    await run(54);
    expect(project.readPodfileProperties()[KEY]).toBe('17.0');
    expect(project.readDeploymentTargets()).toEqual([
      '17.0',
      '17.0',
      '16.4',
      '16.4',
    ]);
    expect(warn).not.toHaveBeenCalled();
  });

  it('is idempotent: a second run changes nothing and rewrites nothing', async () => {
    project = createTempIosProject({
      podfileProperties: { 'expo.jsEngine': 'hermes' },
      pbxproj: createPbxproj(TEMPLATE_54_55),
    });
    await run(54);
    const podAfterFirst = fs.readFileSync(project.podfilePropertiesPath);
    const pbxAfterFirst = fs.readFileSync(project.pbxprojPath);
    const mtime = fs.statSync(project.pbxprojPath).mtimeMs;
    await run(54);
    expect(fs.readFileSync(project.podfilePropertiesPath)).toEqual(
      podAfterFirst
    );
    expect(fs.readFileSync(project.pbxprojPath)).toEqual(pbxAfterFirst);
    expect(fs.statSync(project.pbxprojPath).mtimeMs).toBe(mtime);
  });

  it('creates Podfile.properties.json when it is missing (SDK 54) and leaves it missing on SDK 58', async () => {
    project = createTempIosProject({
      podfileProperties: null,
      pbxproj: createPbxproj(TEMPLATE_54_55),
    });
    await run(54);
    expect(project.readPodfileProperties()).toEqual({ [KEY]: '16.0' });
    project.cleanup();

    project = createTempIosProject({
      podfileProperties: null,
      pbxproj: createPbxproj(TEMPLATE_56_PLUS),
    });
    await run(58);
    expect(fs.existsSync(project.podfilePropertiesPath)).toBe(false);
  });

  it('does not overwrite an unreadable Podfile.properties.json, warns, and still fixes the pbxproj', async () => {
    project = createTempIosProject({
      podfileProperties: '{ not json',
      pbxproj: createPbxproj(TEMPLATE_54_55),
    });
    await run(54);
    expect(fs.readFileSync(project.podfilePropertiesPath, 'utf8')).toBe(
      '{ not json'
    );
    expect(warn).toHaveBeenCalledWith(
      'withIosDeploymentTarget',
      expect.stringContaining('Could not parse')
    );
    expect(project.readDeploymentTargets()).toEqual([
      '16.0',
      '16.0',
      '16.0',
      '16.0',
    ]);
  });

  it('rejects a Podfile.properties.json that is valid JSON but not an object', async () => {
    project = createTempIosProject({
      podfileProperties: '["a"]',
      pbxproj: createPbxproj(TEMPLATE_54_55),
    });
    await run(54);
    expect(fs.readFileSync(project.podfilePropertiesPath, 'utf8')).toBe(
      '["a"]'
    );
    expect(warn).toHaveBeenCalled();
  });

  it('leaves $(inherited) style values untouched in the pbxproj', async () => {
    project = createTempIosProject({
      podfileProperties: { [KEY]: '16.0' },
      pbxproj: createPbxproj({
        projectDebug: '15.1',
        projectRelease: '15.1',
        targetDebug: '"$(inherited)"',
        targetRelease: '"$(inherited)"',
      }),
    });
    await run(54);
    expect(project.readDeploymentTargets()).toEqual([
      '"$(inherited)"',
      '"$(inherited)"',
      '16.0',
      '16.0',
    ]);
  });

  it('does not crash on a pbxproj without an XCBuildConfiguration section', async () => {
    project = createTempIosProject({
      podfileProperties: { [KEY]: '16.0' },
      pbxproj: `// !$*UTF8*$!\n{\n\tarchiveVersion = 1;\n\tclasses = {\n\t};\n\tobjectVersion = 54;\n\tobjects = {\n\t};\n\trootObject = AAAA000000000000000000C1;\n}\n`,
    });
    await expect(run(54)).resolves.toBeUndefined();
  });

  it('touches nothing in introspection mode', async () => {
    project = createTempIosProject({
      podfileProperties: { 'expo.jsEngine': 'hermes' },
      pbxproj: createPbxproj(TEMPLATE_54_55),
    });
    const podBefore = fs.readFileSync(project.podfilePropertiesPath);
    const pbxBefore = fs.readFileSync(project.pbxprojPath);
    await run(54, { introspect: true });
    expect(fs.readFileSync(project.podfilePropertiesPath)).toEqual(podBefore);
    expect(fs.readFileSync(project.pbxprojPath)).toEqual(pbxBefore);
  });
});

describe('withBackgroundLocation wiring', () => {
  it('registers the deployment-target finalized mod next to the existing mods', () => {
    const config = withBackgroundLocation(configForSdk(54), {});
    expect(hasRegisteredIosMod(config, 'finalized')).toBe(true);
    expect(hasRegisteredIosMod(config, 'infoPlist')).toBe(true);
  });
});
