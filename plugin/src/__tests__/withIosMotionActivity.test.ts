import { WarningAggregator } from 'expo/config-plugins';
import type {
  ConfigPlugin,
  ExportedConfigWithProps,
  IOSConfig,
  Mod,
} from 'expo/config-plugins';
import {
  MOTION_ACTIVITY_PODFILE_SNIPPET,
  addMotionActivityFlag,
  withIosMotionActivity,
} from '../ios/withIosMotionActivity';
import { withBackgroundLocation } from '../withBackgroundLocation';

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
type PodfileProjectFile = IOSConfig.Paths.PodfileProjectFile;

const warn = WarningAggregator.addWarningIOS as unknown as jest.Mock;

const FLAG_LINE = '$BackgroundLocationMotionActivity = true';
const FIRST_TARGET_LINE = "target 'exampleexpo' do";

/**
 * Trimmed copy of the `ios/Podfile` Expo SDK 54 generates, plus a second
 * top-level target (as an app extension added by another config plugin
 * would create), so the tests can check that only the first target is used.
 */
const EXPO_SDK_54_PODFILE = `require File.join(File.dirname(\`node --print "require.resolve('expo/package.json')"\`), "scripts/autolinking")
require File.join(File.dirname(\`node --print "require.resolve('react-native/package.json')"\`), "scripts/react_native_pods")

require 'json'
podfile_properties = JSON.parse(File.read(File.join(__dir__, 'Podfile.properties.json'))) rescue {}

ENV['RCT_NEW_ARCH_ENABLED'] ||= '0' if podfile_properties['newArchEnabled'] == 'false'
platform :ios, podfile_properties['ios.deploymentTarget'] || '15.1'

prepare_react_native_project!

target 'exampleexpo' do
  use_expo_modules!

  config = use_native_modules!(config_command)

  use_react_native!(
    :path => config[:reactNativePath],
    :app_path => "#{Pod::Config.instance.installation_root}/..",
  )

  post_install do |installer|
    react_native_post_install(
      installer,
      config[:reactNativePath],
      :mac_catalyst_enabled => false,
    )
  end
end

target 'exampleexpoNotificationService' do
  use_expo_modules!
end
`;

const PODFILE_WITHOUT_TARGET = `require 'json'
platform :ios, '16.0'

prepare_react_native_project!
`;

/** Number of lines that are exactly the flag assignment. */
const countFlagLines = (contents: string): number =>
  contents.split('\n').filter((line) => line === FLAG_LINE).length;

/**
 * `contents` with the snippet inserted before the first occurrence of
 * `anchorLine` (a replacer function, so `$` in the snippet stays literal).
 */
const withSnippetBefore = (contents: string, anchorLine: string): string =>
  contents.replace(
    anchorLine,
    () => `${MOTION_ACTIVITY_PODFILE_SNIPPET}${anchorLine}`
  );

const baseExpoConfig = (): ExpoConfig => ({
  name: 'app',
  slug: 'app',
  ios: {},
  android: {},
});

/**
 * Invokes the registered `mods.ios.podfile` mod against an in-memory Podfile,
 * mirroring the envelope `expo prebuild` passes to `withPodfile` callbacks
 * (same shape as the helpers in `./utils/makeConfig`).
 */
const runPodfileMod = async (
  config: ExpoConfig,
  contents: string
): Promise<string> => {
  const mod = (
    config as ExpoConfig & {
      mods?: { ios?: { podfile?: Mod<PodfileProjectFile> } };
    }
  ).mods?.ios?.podfile;
  if (!mod) {
    throw new Error('Expected config.mods.ios.podfile to be registered');
  }
  const identityNextMod: Mod<PodfileProjectFile> = (cfg) => cfg;
  const expo = baseExpoConfig();
  const envelope: ExportedConfigWithProps<PodfileProjectFile> = {
    ...expo,
    modResults: {
      path: '/tmp/example-expo/ios/Podfile',
      language: 'rb',
      contents,
    },
    modRawConfig: { ...expo },
    modRequest: {
      projectRoot: '/tmp/example-expo',
      platformProjectRoot: '/tmp/example-expo/ios',
      modName: 'podfile',
      platform: 'ios',
      introspect: false,
      projectName: 'example-expo',
      nextMod: identityNextMod,
    },
  };
  const out = await mod(envelope);
  return out.modResults.contents;
};

describe('addMotionActivityFlag', () => {
  it('inserts the comment and the flag once, right before the first target', () => {
    const result = addMotionActivityFlag(EXPO_SDK_54_PODFILE);

    expect(result.status).toBe('added');
    expect(result.contents).toBe(
      withSnippetBefore(EXPO_SDK_54_PODFILE, FIRST_TARGET_LINE)
    );
    expect(countFlagLines(result.contents)).toBe(1);
    expect(result.contents.indexOf(FLAG_LINE)).toBeLessThan(
      result.contents.indexOf(FIRST_TARGET_LINE)
    );
    // The second target is left alone.
    expect(
      result.contents.indexOf("target 'exampleexpoNotificationService' do")
    ).toBeGreaterThan(result.contents.indexOf(FIRST_TARGET_LINE));
  });

  it('uses the exact snippet: comment line, flag line, blank line', () => {
    expect(MOTION_ACTIVITY_PODFILE_SNIPPET).toBe(
      '# Motion activity (CoreMotion) for @gabriel-sisjr/react-native-background-location, added by its config plugin.\n' +
        '$BackgroundLocationMotionActivity = true\n' +
        '\n'
    );
  });

  it.each([
    ['set exactly', FLAG_LINE],
    ['set with extra spaces', '  $BackgroundLocationMotionActivity  =  true  '],
  ])(
    'reports present and changes nothing when the Podfile already has the flag %s',
    (_label, line) => {
      const podfile = `${line}\n\n${EXPO_SDK_54_PODFILE}`;

      expect(addMotionActivityFlag(podfile)).toEqual({
        contents: podfile,
        status: 'present',
      });
    }
  );

  it('reports present when the flag is set after the targets', () => {
    const podfile = `${EXPO_SDK_54_PODFILE}\n${FLAG_LINE}\n`;

    expect(addMotionActivityFlag(podfile).status).toBe('present');
  });

  it.each([
    ['commented out', `# ${FLAG_LINE}`],
    ['set to false', '$BackgroundLocationMotionActivity = false'],
  ])('still adds the flag when the existing line is %s', (_label, line) => {
    const podfile = `${line}\n\n${EXPO_SDK_54_PODFILE}`;
    const result = addMotionActivityFlag(podfile);

    expect(result.status).toBe('added');
    expect(result.contents).toBe(withSnippetBefore(podfile, FIRST_TARGET_LINE));
    expect(countFlagLines(result.contents)).toBe(1);
  });

  it('anchors on a double-quoted target name', () => {
    const podfile = 'platform :ios, "16.0"\n\ntarget "App" do\nend\n';

    expect(addMotionActivityFlag(podfile).contents).toBe(
      `platform :ios, "16.0"\n\n${MOTION_ACTIVITY_PODFILE_SNIPPET}target "App" do\nend\n`
    );
  });

  it('skips indented target lines and anchors on the first top-level target', () => {
    const podfile =
      "abstract_target 'Shared' do\n" +
      "  target 'Nested' do\n" +
      '  end\n' +
      'end\n' +
      '\n' +
      "target 'App' do\n" +
      'end\n';

    const result = addMotionActivityFlag(podfile);

    expect(result.status).toBe('added');
    expect(result.contents).toBe(withSnippetBefore(podfile, "target 'App' do"));
  });

  it('reports no-anchor and changes nothing when the Podfile has no target line', () => {
    expect(addMotionActivityFlag(PODFILE_WITHOUT_TARGET)).toEqual({
      contents: PODFILE_WITHOUT_TARGET,
      status: 'no-anchor',
    });
  });
});

describe('withIosMotionActivity', () => {
  it('adds the flag before the first target through the podfile mod, without a warning', async () => {
    const config = withIosMotionActivity(baseExpoConfig());

    const contents = await runPodfileMod(config, EXPO_SDK_54_PODFILE);

    expect(contents).toBe(addMotionActivityFlag(EXPO_SDK_54_PODFILE).contents);
    expect(countFlagLines(contents)).toBe(1);
    expect(warn).not.toHaveBeenCalled();
  });

  it('is idempotent: a second pass leaves the Podfile byte-identical', async () => {
    const first = await runPodfileMod(
      withIosMotionActivity(baseExpoConfig()),
      EXPO_SDK_54_PODFILE
    );
    const second = await runPodfileMod(
      withIosMotionActivity(baseExpoConfig()),
      first
    );

    expect(second).toBe(first);
    expect(countFlagLines(second)).toBe(1);
    expect(warn).not.toHaveBeenCalled();
  });

  it('leaves a Podfile that already sets the flag unchanged', async () => {
    const podfile = `${FLAG_LINE}\n\n${EXPO_SDK_54_PODFILE}`;

    const contents = await runPodfileMod(
      withIosMotionActivity(baseExpoConfig()),
      podfile
    );

    expect(contents).toBe(podfile);
    expect(warn).not.toHaveBeenCalled();
  });

  it('warns once and leaves the Podfile unchanged when there is no target line', async () => {
    const contents = await runPodfileMod(
      withIosMotionActivity(baseExpoConfig()),
      PODFILE_WITHOUT_TARGET
    );

    expect(contents).toBe(PODFILE_WITHOUT_TARGET);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      'withIosMotionActivity',
      expect.stringContaining(FLAG_LINE)
    );
    expect(warn).toHaveBeenCalledWith(
      'withIosMotionActivity',
      expect.stringContaining('MOTION_ACTIVITY_UNAVAILABLE')
    );
  });

  it('is applied by withBackgroundLocation when the motionActivity prop is present', async () => {
    const config = withBackgroundLocation(baseExpoConfig(), {
      motionActivity: { usageDescription: 'Custom motion copy' },
    });

    const contents = await runPodfileMod(config, EXPO_SDK_54_PODFILE);

    expect(countFlagLines(contents)).toBe(1);
    expect(contents.indexOf(FLAG_LINE)).toBeLessThan(
      contents.indexOf(FIRST_TARGET_LINE)
    );
  });
});
