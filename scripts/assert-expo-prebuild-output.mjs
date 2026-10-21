#!/usr/bin/env node
/**
 * assert-expo-prebuild-output.mjs
 *
 * Value-level assertions on the native projects produced by `expo prebuild`
 * for an Expo app that uses the `@gabriel-sisjr/react-native-background-location`
 * config plugin. Invoked through `scripts/assert-expo-prebuild-output.sh`, which
 * documents the CLI and is the only entry point CI uses.
 *
 * The expectations are derived from the app's own Expo config (`expo config
 * --json --type prebuild`), never from plugin code, so the plugin is judged
 * against an independent oracle:
 *
 *   iOS usage string = plugin prop ?? ios.infoPlist value ?? library default
 *
 * Dependency-free on purpose (Node >= 18): it must run unchanged in the monorepo
 * workspace, in a scratch app that installed the npm tarball, and on both the
 * Linux and macOS runners.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const PACKAGE_NAME = '@gabriel-sisjr/react-native-background-location';
const MIN_IOS_DEPLOYMENT_TARGET = '16.0';

// The seven permissions owned by android/src/main/AndroidManifest.xml.
// Keep in sync with plugin/src/android/withAndroidPermissions.ts.
const LIBRARY_PERMISSIONS = [
  'android.permission.ACCESS_FINE_LOCATION',
  'android.permission.ACCESS_COARSE_LOCATION',
  'android.permission.ACCESS_BACKGROUND_LOCATION',
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_LOCATION',
  'android.permission.POST_NOTIFICATIONS',
  'android.permission.RECEIVE_BOOT_COMPLETED',
];

// Components the library manifest contributes; they only exist after Gradle
// merges the library manifest into the app manifest (never at prebuild time).
const LIBRARY_COMPONENTS = [
  { tag: 'service', name: 'com.backgroundlocation.LocationService' },
  {
    tag: 'receiver',
    name: 'com.backgroundlocation.NotificationActionReceiver',
  },
  {
    tag: 'receiver',
    name: 'com.backgroundlocation.GeofenceBroadcastReceiver',
  },
  { tag: 'receiver', name: 'com.backgroundlocation.BootCompletedReceiver' },
  {
    tag: 'service',
    name: 'androidx.work.impl.foreground.SystemForegroundService',
  },
];

// Default copy applied by the plugin when neither the plugin props nor the
// app's ios.infoPlist provide a value. Keep in sync with
// plugin/src/ios/withIosUsageStrings.ts.
const IOS_USAGE_KEYS = [
  {
    plist: 'NSLocationWhenInUseUsageDescription',
    prop: 'locationWhenInUseUsageDescription',
    fallback:
      'Allow $(PRODUCT_NAME) to access your location while you use the app.',
  },
  {
    plist: 'NSLocationAlwaysAndWhenInUseUsageDescription',
    prop: 'locationAlwaysAndWhenInUseUsageDescription',
    fallback:
      'Allow $(PRODUCT_NAME) to access your location, even when the app is in the background.',
  },
  {
    plist: 'NSLocationAlwaysUsageDescription',
    prop: 'locationAlwaysUsageDescription',
    fallback: 'Allow $(PRODUCT_NAME) to access your location at all times.',
  },
];

const TEMPORARY_DICTIONARY_KEY =
  'NSLocationTemporaryUsageDescriptionDictionary';

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

const failures = [];
const passes = [];

function check(condition, passMessage, failMessage) {
  if (condition) {
    passes.push(passMessage);
  } else {
    failures.push(failMessage);
  }
}

function die(message) {
  process.stderr.write(`FAIL: ${message}\n`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Small parsers (no dependencies)
// ---------------------------------------------------------------------------

function decodeXmlEntities(text) {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/**
 * Flat list of the elements of an XML document: `{ tag, attrs }`. Comments,
 * CDATA sections, processing instructions and the DOCTYPE are dropped first.
 * Good enough for generated AndroidManifest.xml files, where only element
 * names and attributes matter.
 */
function parseXmlElements(xml) {
  const cleaned = xml
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '')
    .replace(/<\?[\s\S]*?\?>/g, '')
    .replace(/<!DOCTYPE[^>]*>/gi, '');
  const elements = [];
  const tagRe =
    /<([A-Za-z_][\w:.-]*)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*\/?>/g;
  const attrRe = /([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let tagMatch;
  while ((tagMatch = tagRe.exec(cleaned)) !== null) {
    const attrs = {};
    let attrMatch;
    attrRe.lastIndex = 0;
    while ((attrMatch = attrRe.exec(tagMatch[2])) !== null) {
      attrs[attrMatch[1]] = decodeXmlEntities(attrMatch[2] ?? attrMatch[3]);
    }
    elements.push({ tag: tagMatch[1], attrs });
  }
  return elements;
}

/** Parses an XML property list into plain JS values. */
function parsePlist(xml) {
  const body = xml
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\?[\s\S]*?\?>/g, '')
    .replace(/<!DOCTYPE[^>]*>/gi, '');
  const tokenRe =
    /<(\/?)(plist|dict|array|key|string|integer|real|date|data)(\s[^>]*)?(\/?)>|<(true|false)\s*\/>|([^<]+)/g;
  const tokens = [];
  let match;
  while ((match = tokenRe.exec(body)) !== null) {
    if (match[5]) {
      tokens.push({ type: 'bool', value: match[5] === 'true' });
    } else if (match[2]) {
      tokens.push({
        type: match[1] ? 'close' : match[4] ? 'empty' : 'open',
        tag: match[2],
      });
    } else if (match[6] !== undefined && match[6].trim() !== '') {
      tokens.push({ type: 'text', value: match[6] });
    }
  }

  let position = 0;
  const next = () => tokens[position++];
  const peek = () => tokens[position];

  const readText = (tag) => {
    const first = peek();
    let text = '';
    if (first && first.type === 'text') {
      text = decodeXmlEntities(next().value);
    }
    const close = next();
    if (!close || close.type !== 'close' || close.tag !== tag) {
      throw new Error(`malformed plist: expected </${tag}>`);
    }
    return text;
  };

  const readValue = () => {
    const token = next();
    if (!token) throw new Error('malformed plist: unexpected end');
    if (token.type === 'bool') return token.value;
    if (token.type === 'empty') {
      if (token.tag === 'dict') return {};
      if (token.tag === 'array') return [];
      return '';
    }
    if (token.type !== 'open') {
      throw new Error(`malformed plist: unexpected ${token.type}`);
    }
    switch (token.tag) {
      case 'string':
      case 'date':
      case 'data':
        return readText(token.tag);
      case 'integer':
        return parseInt(readText('integer'), 10);
      case 'real':
        return parseFloat(readText('real'));
      case 'array': {
        const items = [];
        while (peek() && peek().type !== 'close') items.push(readValue());
        next();
        return items;
      }
      case 'dict': {
        const result = {};
        while (peek() && peek().type !== 'close') {
          const keyToken = next();
          if (keyToken.type !== 'open' || keyToken.tag !== 'key') {
            throw new Error('malformed plist: expected <key>');
          }
          const key = readText('key');
          result[key] = readValue();
        }
        next();
        return result;
      }
      default:
        throw new Error(`malformed plist: unexpected <${token.tag}>`);
    }
  };

  const root = next();
  if (!root || root.type !== 'open' || root.tag !== 'plist') {
    throw new Error('malformed plist: missing <plist>');
  }
  const value = readValue();
  return value;
}

/** Compares dotted versions numerically: negative, zero or positive. */
function compareVersions(a, b) {
  const pa = String(a)
    .split('.')
    .map((n) => parseInt(n, 10) || 0);
  const pb = String(b)
    .split('.')
    .map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function readFileOrDie(file, hint) {
  if (!fs.existsSync(file)) {
    die(`${file} not found${hint ? `\nHint: ${hint}` : ''}`);
  }
  return fs.readFileSync(file, 'utf8');
}

// ---------------------------------------------------------------------------
// Expo config (oracle for the expected values)
// ---------------------------------------------------------------------------

function readExpoConfig(projectDir) {
  let cli;
  try {
    cli = createRequire(path.join(projectDir, 'package.json')).resolve(
      'expo/bin/cli'
    );
  } catch {
    die(
      `cannot resolve "expo" from ${projectDir}; install dependencies first or pass --props-json`
    );
  }
  let stdout;
  try {
    stdout = execFileSync(
      process.execPath,
      [cli, 'config', '--json', '--type', 'prebuild'],
      {
        cwd: projectDir,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          CI: '1',
          EXPO_NO_TELEMETRY: '1',
          EXPO_NO_GIT_STATUS: '1',
        },
      }
    );
  } catch (error) {
    die(
      `\`expo config\` failed in ${projectDir}: ${error.stderr || error.message}`
    );
  }
  const start = stdout.indexOf('{');
  try {
    return JSON.parse(stdout.slice(start));
  } catch {
    return die(`\`expo config\` did not print JSON: ${stdout.slice(0, 200)}`);
  }
}

function findPluginEntry(plugins) {
  for (const entry of plugins ?? []) {
    const [name, props] = Array.isArray(entry) ? entry : [entry, undefined];
    if (
      typeof name === 'string' &&
      (name === PACKAGE_NAME || name.startsWith(`${PACKAGE_NAME}/`))
    ) {
      return { props: props && typeof props === 'object' ? props : {} };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Android
// ---------------------------------------------------------------------------

/**
 * Names of the permissions the manifest declares. A removal directive
 * (`android.blockedPermissions` emits `tools:node="remove"`) is not a
 * declaration: the merged manifest will not contain that permission.
 */
function permissionNames(elements) {
  return elements
    .filter((e) => e.tag === 'uses-permission')
    .filter((e) => !['remove', 'removeAll'].includes(e.attrs['tools:node']))
    .map((e) => e.attrs['android:name'])
    .filter(Boolean);
}

function countBy(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
}

function assertPermissions(elements, file) {
  const names = permissionNames(elements);
  const counts = countBy(names);
  for (const permission of LIBRARY_PERMISSIONS) {
    const count = counts.get(permission) ?? 0;
    check(
      count === 1,
      `${permission} declared once`,
      `${permission} must be declared exactly once in ${file}, found ${count}`
    );
  }
  const duplicated = [...counts].filter(([, count]) => count > 1);
  check(
    duplicated.length === 0,
    'no duplicated <uses-permission>',
    `duplicated <uses-permission> in ${file}: ${duplicated
      .map(([name, count]) => `${name} x${count}`)
      .join(', ')}`
  );
  const unexpectedLocation = [...counts.keys()].filter(
    (name) => /LOCATION/.test(name) && !LIBRARY_PERMISSIONS.includes(name)
  );
  check(
    unexpectedLocation.length === 0,
    'no unexpected location permission',
    `unexpected location permission(s) in ${file}: ${unexpectedLocation.join(', ')}`
  );
}

function readGradleProperty(file, key) {
  if (!fs.existsSync(file)) return undefined;
  const line = fs
    .readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .find((l) => new RegExp(`^\\s*${key.replace(/\./g, '\\.')}\\s*=`).test(l));
  return line ? line.split('=').slice(1).join('=').trim() : undefined;
}

function assertAndroid(projectDir) {
  const androidDir = path.join(projectDir, 'android');
  const manifestFile = path.join(
    androidDir,
    'app/src/main/AndroidManifest.xml'
  );
  const manifest = readFileOrDie(
    manifestFile,
    `run 'expo prebuild --platform android --clean --no-install' in ${projectDir} first`
  );
  assertPermissions(parseXmlElements(manifest), manifestFile);

  const newArch = readGradleProperty(
    path.join(androidDir, 'gradle.properties'),
    'newArchEnabled'
  );
  check(
    newArch !== 'false',
    `android newArchEnabled=${newArch ?? '(unset, defaults to true)'}`,
    'android/gradle.properties sets newArchEnabled=false; the New Architecture is required'
  );
}

function findMergedManifest(projectDir) {
  const intermediates = path.join(
    projectDir,
    'android/app/build/intermediates'
  );
  const preferred = [
    'packaged_manifests/debug/processDebugManifestForPackage',
    'merged_manifests/debug/processDebugManifest',
    'merged_manifest/debug/processDebugMainManifest',
  ];
  for (const dir of preferred) {
    const candidate = path.join(intermediates, dir, 'AndroidManifest.xml');
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function assertAndroidMerged(projectDir) {
  const manifestFile = findMergedManifest(projectDir);
  if (!manifestFile) {
    die(
      `no merged debug AndroidManifest.xml under ${projectDir}/android/app/build/intermediates\nHint: run './gradlew :app:assembleDebug' in ${projectDir}/android first`
    );
  }
  const elements = parseXmlElements(fs.readFileSync(manifestFile, 'utf8'));
  assertPermissions(elements, manifestFile);
  for (const { tag, name } of LIBRARY_COMPONENTS) {
    const matches = elements.filter(
      (e) => e.tag === tag && e.attrs['android:name'] === name
    );
    check(
      matches.length === 1,
      `<${tag} ${name}> merged once`,
      `<${tag} android:name="${name}"> must appear exactly once in ${manifestFile}, found ${matches.length}`
    );
  }
  const service = elements.find(
    (e) =>
      e.tag === 'service' &&
      e.attrs['android:name'] === 'com.backgroundlocation.LocationService'
  );
  check(
    Boolean(service) &&
      String(service.attrs['android:foregroundServiceType'] ?? '')
        .split('|')
        .includes('location'),
    'LocationService has foregroundServiceType=location',
    'LocationService must declare android:foregroundServiceType="location"'
  );
}

// ---------------------------------------------------------------------------
// iOS
// ---------------------------------------------------------------------------

function findIosProject(projectDir) {
  const iosDir = path.join(projectDir, 'ios');
  if (!fs.existsSync(iosDir)) {
    die(
      `${iosDir} not found\nHint: run 'expo prebuild --platform ios --clean --no-install' in ${projectDir} first`
    );
  }
  const xcodeproj = fs
    .readdirSync(iosDir)
    .find((entry) => entry.endsWith('.xcodeproj'));
  if (!xcodeproj) die(`no .xcodeproj under ${iosDir}`);
  const name = xcodeproj.replace(/\.xcodeproj$/, '');
  return {
    iosDir,
    infoPlist: path.join(iosDir, name, 'Info.plist'),
    pbxproj: path.join(iosDir, xcodeproj, 'project.pbxproj'),
  };
}

/** Deployment target of every build configuration that belongs to an app target. */
function readTargetDeploymentTargets(pbxprojText) {
  const lines = pbxprojText.split(/\r?\n/);
  const result = [];
  let inSection = false;
  let block = null;
  for (const line of lines) {
    if (line.includes('Begin XCBuildConfiguration section')) inSection = true;
    else if (line.includes('End XCBuildConfiguration section'))
      inSection = false;
    if (!inSection) continue;
    const start = line.match(/^\t\t([0-9A-F]{24}) \/\* (.+) \*\/ = \{$/);
    if (start) {
      block = { name: start[2], target: null, isAppTarget: false };
    } else if (block && /^\t\t\};$/.test(line)) {
      if (block.target !== null) result.push(block);
      block = null;
    } else if (block) {
      const target = line.match(/IPHONEOS_DEPLOYMENT_TARGET = "?([\d.]+)"?;/);
      if (target) block.target = target[1];
      // Only the app target's configurations carry these keys; project-level
      // configurations do not.
      if (/INFOPLIST_FILE = |PRODUCT_BUNDLE_IDENTIFIER = /.test(line)) {
        block.isAppTarget = true;
      }
    }
  }
  return result;
}

function assertIos(projectDir, expo, props) {
  const { iosDir, infoPlist, pbxproj } = findIosProject(projectDir);
  const plist = parsePlist(
    readFileOrDie(
      infoPlist,
      `run 'expo prebuild --platform ios --clean --no-install' in ${projectDir} first`
    )
  );
  const userInfoPlist = (expo.ios && expo.ios.infoPlist) || {};

  for (const { plist: key, prop, fallback } of IOS_USAGE_KEYS) {
    const expected = props[prop] ?? userInfoPlist[key] ?? fallback;
    check(
      plist[key] === expected,
      `${key} = expected value`,
      `${key} mismatch in ${infoPlist}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(plist[key])}`
    );
  }

  const expectedTemporary = {
    ...(userInfoPlist[TEMPORARY_DICTIONARY_KEY] ?? {}),
    ...(props.temporaryUsageDescriptions ?? {}),
  };
  if (Object.keys(expectedTemporary).length === 0) {
    check(
      plist[TEMPORARY_DICTIONARY_KEY] === undefined,
      `${TEMPORARY_DICTIONARY_KEY} absent`,
      `${TEMPORARY_DICTIONARY_KEY} must be absent when no temporaryUsageDescriptions are configured, found ${JSON.stringify(plist[TEMPORARY_DICTIONARY_KEY])}`
    );
  } else {
    const actual = plist[TEMPORARY_DICTIONARY_KEY] ?? {};
    for (const [purpose, text] of Object.entries(expectedTemporary)) {
      check(
        actual[purpose] === text,
        `${TEMPORARY_DICTIONARY_KEY}.${purpose} = expected value`,
        `${TEMPORARY_DICTIONARY_KEY}.${purpose} mismatch in ${infoPlist}\n  expected: ${JSON.stringify(text)}\n  actual:   ${JSON.stringify(actual[purpose])}`
      );
    }
  }

  const modes = Array.isArray(plist.UIBackgroundModes)
    ? plist.UIBackgroundModes
    : [];
  const locationCount = modes.filter((mode) => mode === 'location').length;
  check(
    locationCount === 1,
    'UIBackgroundModes contains location once',
    `UIBackgroundModes must contain "location" exactly once in ${infoPlist}, found ${locationCount} (modes: ${JSON.stringify(modes)})`
  );
  for (const mode of userInfoPlist.UIBackgroundModes ?? []) {
    check(
      modes.includes(mode),
      `UIBackgroundModes preserved ${mode}`,
      `UIBackgroundModes lost the pre-existing mode "${mode}" in ${infoPlist}`
    );
  }

  // Deployment target: the effective value CocoaPods uses ...
  const podfileProperties = path.join(iosDir, 'Podfile.properties.json');
  const properties = fs.existsSync(podfileProperties)
    ? JSON.parse(fs.readFileSync(podfileProperties, 'utf8'))
    : {};
  const podfile = path.join(iosDir, 'Podfile');
  const templateMatch = fs.existsSync(podfile)
    ? fs
        .readFileSync(podfile, 'utf8')
        .match(
          /platform\s+:ios\s*,\s*podfile_properties\['ios\.deploymentTarget'\]\s*\|\|\s*'([\d.]+)'/
        )
    : null;
  // The SDK's own default, e.g. 15.1 on SDK 54/55 and 16.4 on SDK 56+.
  const templateDefault = templateMatch ? templateMatch[1] : undefined;
  const configured = properties['ios.deploymentTarget'];
  const effective = configured ?? templateDefault;
  const source =
    configured !== undefined
      ? 'Podfile.properties.json ios.deploymentTarget'
      : 'Podfile platform fallback';
  check(
    effective !== undefined &&
      compareVersions(effective, MIN_IOS_DEPLOYMENT_TARGET) >= 0,
    `CocoaPods deployment target ${effective} >= ${MIN_IOS_DEPLOYMENT_TARGET} (${source})`,
    `CocoaPods deployment target must be >= ${MIN_IOS_DEPLOYMENT_TARGET}, found ${effective ?? '(none)'} via ${source} in ${iosDir}`
  );
  // The plugin may raise the target, never lower the SDK default (pbxproj would
  // keep the SDK value while CocoaPods built the pods for a lower one).
  if (configured !== undefined && templateDefault !== undefined) {
    check(
      compareVersions(configured, templateDefault) >= 0,
      `ios.deploymentTarget ${configured} does not lower the template default ${templateDefault}`,
      `Podfile.properties.json ios.deploymentTarget (${configured}) is lower than the template default (${templateDefault}) in ${podfile}; the plugin must raise the deployment target, never lower it`
    );
  }
  // ... and the app target's own build settings in the Xcode project.
  const configurations = readTargetDeploymentTargets(
    readFileOrDie(pbxproj)
  ).filter((c) => c.isAppTarget);
  check(
    configurations.length > 0,
    'found app target build configurations',
    `no app target build configuration with IPHONEOS_DEPLOYMENT_TARGET found in ${pbxproj}`
  );
  for (const configuration of configurations) {
    check(
      compareVersions(configuration.target, MIN_IOS_DEPLOYMENT_TARGET) >= 0,
      `pbxproj ${configuration.name} IPHONEOS_DEPLOYMENT_TARGET ${configuration.target} >= ${MIN_IOS_DEPLOYMENT_TARGET}`,
      `app target ${configuration.name} IPHONEOS_DEPLOYMENT_TARGET must be >= ${MIN_IOS_DEPLOYMENT_TARGET}, found ${configuration.target} in ${pbxproj}`
    );
  }

  const newArch = properties.newArchEnabled;
  check(
    newArch !== 'false' && newArch !== false,
    `ios newArchEnabled=${newArch ?? '(unset, defaults to true)'}`,
    `Podfile.properties.json sets newArchEnabled=${newArch}; the New Architecture is required`
  );
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const [platform, ...rest] = argv;
  const options = {
    platform,
    projectDir: null,
    propsJson: null,
    verbose: false,
  };
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    const value = () => {
      i += 1;
      if (rest[i] === undefined) die(`${arg} requires a value`);
      return rest[i];
    };
    if (arg === '--project-dir') options.projectDir = path.resolve(value());
    else if (arg === '--props-json') options.propsJson = value();
    else if (arg === '--props-file') {
      options.propsJson = fs.readFileSync(path.resolve(value()), 'utf8');
    } else if (arg === '--verbose') options.verbose = true;
    else die(`unknown option '${arg}'`);
  }
  return options;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const platform = options.platform;
  if (!['android', 'android-merged', 'ios'].includes(platform)) {
    die(
      `unknown platform '${platform}' (expected 'android', 'android-merged' or 'ios')`
    );
  }
  if (!options.projectDir) die('--project-dir is required');
  if (!fs.existsSync(options.projectDir)) {
    die(`project directory ${options.projectDir} does not exist`);
  }

  if (platform === 'android') {
    assertAndroid(options.projectDir);
  } else if (platform === 'android-merged') {
    assertAndroidMerged(options.projectDir);
  } else {
    let expo;
    let props;
    if (options.propsJson !== null) {
      props = JSON.parse(options.propsJson);
      expo = {};
    } else {
      expo = readExpoConfig(options.projectDir);
      const entry = findPluginEntry(expo.plugins);
      if (!entry) {
        die(
          `${PACKAGE_NAME} is not listed in the Expo config plugins of ${options.projectDir}`
        );
      }
      props = entry.props;
    }
    assertIos(options.projectDir, expo, props);
  }

  if (options.verbose) {
    for (const message of passes) process.stdout.write(`  ok   ${message}\n`);
  }
  if (failures.length > 0) {
    for (const message of failures) process.stderr.write(`FAIL: ${message}\n`);
    process.stderr.write(
      `${failures.length} assertion(s) failed (${platform}), ${passes.length} passed\n`
    );
    process.exit(1);
  }
  process.stdout.write(`OK (${platform}, ${passes.length} checks)\n`);
}

main();
