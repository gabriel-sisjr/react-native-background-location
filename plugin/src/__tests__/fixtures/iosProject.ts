import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * Builds a minimal but parseable `project.pbxproj` whose XCBuildConfiguration
 * section mirrors the Expo template: project-level Debug/Release plus
 * target-level Debug/Release, each carrying an `IPHONEOS_DEPLOYMENT_TARGET`.
 * `values` are written verbatim, so tests can inject `16.4`, `$(inherited)`...
 */
export const createPbxproj = (values: {
  projectDebug: string;
  projectRelease: string;
  targetDebug: string;
  targetRelease: string;
}): string => `// !$*UTF8*$!
{
\tarchiveVersion = 1;
\tclasses = {
\t};
\tobjectVersion = 54;
\tobjects = {

/* Begin XCBuildConfiguration section */
\t\tAAAA000000000000000000A1 /* Debug */ = {
\t\t\tisa = XCBuildConfiguration;
\t\t\tbuildSettings = {
\t\t\t\tIPHONEOS_DEPLOYMENT_TARGET = ${values.targetDebug};
\t\t\t\tPRODUCT_NAME = "$(TARGET_NAME)";
\t\t\t};
\t\t\tname = Debug;
\t\t};
\t\tAAAA000000000000000000A2 /* Release */ = {
\t\t\tisa = XCBuildConfiguration;
\t\t\tbuildSettings = {
\t\t\t\tIPHONEOS_DEPLOYMENT_TARGET = ${values.targetRelease};
\t\t\t\tPRODUCT_NAME = "$(TARGET_NAME)";
\t\t\t};
\t\t\tname = Release;
\t\t};
\t\tAAAA000000000000000000B1 /* Debug */ = {
\t\t\tisa = XCBuildConfiguration;
\t\t\tbuildSettings = {
\t\t\t\tIPHONEOS_DEPLOYMENT_TARGET = ${values.projectDebug};
\t\t\t\tSDKROOT = iphoneos;
\t\t\t};
\t\t\tname = Debug;
\t\t};
\t\tAAAA000000000000000000B2 /* Release */ = {
\t\t\tisa = XCBuildConfiguration;
\t\t\tbuildSettings = {
\t\t\t\tIPHONEOS_DEPLOYMENT_TARGET = ${values.projectRelease};
\t\t\t\tSDKROOT = iphoneos;
\t\t\t};
\t\t\tname = Release;
\t\t};
/* End XCBuildConfiguration section */
\t};
\trootObject = AAAA000000000000000000C1 /* Project object */;
}
`;

export const TEMPLATE_54_55 = {
  projectDebug: '15.1',
  projectRelease: '15.1',
  targetDebug: '15.1',
  targetRelease: '15.1',
} as const;

export const TEMPLATE_56_PLUS = {
  projectDebug: '16.4',
  projectRelease: '16.4',
  targetDebug: '16.4',
  targetRelease: '16.4',
} as const;

export interface TempIosProject {
  projectRoot: string;
  podfilePropertiesPath: string;
  pbxprojPath: string;
  readPodfileProperties: () => Record<string, unknown>;
  readDeploymentTargets: () => string[];
  cleanup: () => void;
}

/**
 * Lays out `<tmp>/ios/Podfile.properties.json` and
 * `<tmp>/ios/App.xcodeproj/project.pbxproj` the way `expo prebuild` does.
 * Pass `podfileProperties: null` to omit the JSON file, or a string to write
 * raw (possibly invalid) content.
 */
export const createTempIosProject = ({
  podfileProperties,
  pbxproj,
}: {
  podfileProperties: Record<string, unknown> | string | null;
  pbxproj: string;
}): TempIosProject => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bg-location-'));
  const iosDir = path.join(projectRoot, 'ios');
  const xcodeprojDir = path.join(iosDir, 'App.xcodeproj');
  fs.mkdirSync(xcodeprojDir, { recursive: true });

  const podfilePropertiesPath = path.join(iosDir, 'Podfile.properties.json');
  if (podfileProperties !== null) {
    fs.writeFileSync(
      podfilePropertiesPath,
      typeof podfileProperties === 'string'
        ? podfileProperties
        : `${JSON.stringify(podfileProperties, null, 2)}\n`
    );
  }
  const pbxprojPath = path.join(xcodeprojDir, 'project.pbxproj');
  fs.writeFileSync(pbxprojPath, pbxproj);

  return {
    projectRoot,
    podfilePropertiesPath,
    pbxprojPath,
    readPodfileProperties: () =>
      JSON.parse(fs.readFileSync(podfilePropertiesPath, 'utf8')),
    readDeploymentTargets: () =>
      [
        ...fs
          .readFileSync(pbxprojPath, 'utf8')
          .matchAll(/IPHONEOS_DEPLOYMENT_TARGET = ([^;]+);/g),
      ].map((m) => m[1] as string),
    cleanup: () => fs.rmSync(projectRoot, { recursive: true, force: true }),
  };
};
