// Yarn 3 workspace-aware Metro config for the Expo managed-workflow demo.
//
// Mirrors the pattern used by `example/metro.config.js` (which delegates to
// `react-native-monorepo-config`): tell Metro to watch the entire repo root,
// resolve modules from both the local workspace and the hoisted root
// `node_modules/`, and disable the hierarchical lookup so the bundler never
// climbs above the project root.
//
// The Expo CLI defaults are taken via `expo/metro-config` (not
// `@react-native/metro-config`) because the SDK-53 preset wires up Expo's
// asset registry and Hermes transformer.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
