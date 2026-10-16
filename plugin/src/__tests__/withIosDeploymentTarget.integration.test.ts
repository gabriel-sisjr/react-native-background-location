import {
  compileModsAsync,
  withPodfileProperties,
  withXcodeProject,
  type ConfigPlugin,
} from 'expo/config-plugins';
import { withIosDeploymentTarget } from '../ios/withIosDeploymentTarget';
import {
  TEMPLATE_54_55,
  createPbxproj,
  createTempIosProject,
  podfileWithFallback,
  type TempIosProject,
} from './fixtures/iosProject';

type ExpoConfig = Parameters<ConfigPlugin<unknown>>[0];

/**
 * Stand-in for `expo-build-properties { ios: { deploymentTarget } }`. The real
 * package (1.0.10 ... 58.0.10) registers one regular `podfileProperties` mod
 * and one regular `xcodeproj` mod, which is all that matters for ordering.
 */
const withFakeBuildProperties: ConfigPlugin<string> = (config, target) => {
  config = withPodfileProperties(config, (cfg) => {
    cfg.modResults['ios.deploymentTarget'] = target;
    return cfg;
  });
  return withXcodeProject(config, (cfg) => {
    const section = cfg.modResults.pbxXCBuildConfigurationSection() as Record<
      string,
      { buildSettings?: Record<string, unknown> }
    >;
    for (const entry of Object.values(section)) {
      if (entry?.buildSettings?.IPHONEOS_DEPLOYMENT_TARGET) {
        entry.buildSettings.IPHONEOS_DEPLOYMENT_TARGET = target;
      }
    }
    return cfg;
  });
};

const baseConfig = (): ExpoConfig => ({
  name: 'app',
  slug: 'app',
  sdkVersion: '54.0.0',
  ios: {},
  android: {},
});

/**
 * Runs Expo's real mod compiler (`compileModsAsync`), so regular mods, the
 * `xcodeproj` precedence and the *finalized* ordering are the ones a prebuild
 * uses, instead of calling the finalized mod by hand on a pre-seeded project.
 * It uses `withIosDeploymentTarget` directly, not `withBackgroundLocation`: the
 * fixture pbxproj has no PBXNativeTarget, which the infoPlist base mod needs.
 * The wiring is covered by 'registers the deployment-target finalized mod next
 * to the existing mods' in withIosDeploymentTarget.test.ts.
 */
describe('deployment target through the real Expo mod compiler', () => {
  let project: TempIosProject;

  afterEach(() => {
    project?.cleanup();
  });

  const prebuild = async (
    ebpTarget: string,
    ebpFirst: boolean
  ): Promise<void> => {
    project = createTempIosProject({
      podfileProperties: { 'expo.jsEngine': 'hermes' },
      pbxproj: createPbxproj(TEMPLATE_54_55),
      // The SDK 54/55 template, as a real prebuild writes it.
      podfile: podfileWithFallback('15.1'),
    });
    const ours: ConfigPlugin = withIosDeploymentTarget;
    const ebp = (c: ExpoConfig) => withFakeBuildProperties(c, ebpTarget);
    const config = ebpFirst ? ours(ebp(baseConfig())) : ebp(ours(baseConfig()));
    await compileModsAsync(config, {
      projectRoot: project.projectRoot,
      platforms: ['ios'],
    });
  };

  it.each([
    ['listed before the plugin', true],
    ['listed after the plugin', false],
  ])('raises 15.1 to 16.0 with expo-build-properties %s', async (_l, first) => {
    await prebuild('15.1', first);
    expect(project.readPodfileProperties()['ios.deploymentTarget']).toBe(
      '16.0'
    );
    expect(project.readDeploymentTargets()).toEqual([
      '16.0',
      '16.0',
      '16.0',
      '16.0',
    ]);
  });

  it.each([
    ['listed before the plugin', true],
    ['listed after the plugin', false],
  ])('keeps 17.0 with expo-build-properties %s', async (_l, first) => {
    await prebuild('17.0', first);
    expect(project.readPodfileProperties()['ios.deploymentTarget']).toBe(
      '17.0'
    );
  });
});
