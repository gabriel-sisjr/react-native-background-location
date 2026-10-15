// Metro config for the Expo demo app inside this Yarn workspace.
//
// Since SDK 52, `expo/metro-config` detects the workspace by itself: it sets
// `watchFolders` for the workspace packages and
// `resolver.nodeModulesPaths = [<app>/node_modules, <root>/node_modules]`.
// Two things are specific to this repository, where the library under test
// is the workspace ROOT package (not a `packages/*` workspace):
//
// 1. The root has to be watched, otherwise Metro cannot resolve the library
//    that `scripts/link-library.js` symlinks into `node_modules`.
// 2. The root also owns its own `react` / `react-native` devDependencies
//    (a different version than the app's). Hierarchical lookup would let the
//    library resolve those and bundle a second copy of React Native, so it is
//    disabled to force every import onto the app's copy.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const config = getDefaultConfig(__dirname);

config.watchFolders = [
  ...(config.watchFolders ?? []),
  path.resolve(__dirname, '..'),
];
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
