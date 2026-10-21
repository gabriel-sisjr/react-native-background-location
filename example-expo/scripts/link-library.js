#!/usr/bin/env node
/* eslint-env node */
/**
 * Local-workspace bootstrap for `expo prebuild` plugin resolution.
 *
 * Why this exists
 * ---------------
 * `expo prebuild` uses Node's `require.resolve` against `node_modules/` to
 * locate the plugin module. Yarn 3 with `nmHoistingLimits: workspaces` does
 * NOT auto-symlink a workspace's local sibling (the repo-root library) into
 * the consumer workspace's `node_modules`. The bare-workflow `example/`
 * workaround relies on Metro + `react-native-monorepo-config` rewriting the
 * resolver — but that rewrite only applies to the bundler, not to Expo's
 * plugin loader.
 *
 * Real consumers installing from npm get a real `node_modules/<pkg>` directory,
 * so the symlink we create here is the closest possible local emulation of
 * that consumer experience without polluting the monorepo with packed
 * tarballs. The link is created lazily (only when missing) so the script is
 * safe to call from CI and from local `yarn prebuild*` flows alike.
 *
 * The script is intentionally dependency-free (`fs`/`path`/`os` only) so it
 * works the moment `yarn install` finishes — no `node_modules` lookups
 * required.
 */

const fs = require('node:fs');
const path = require('node:path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const WORKSPACE_ROOT = path.resolve(PROJECT_ROOT, '..');
const SCOPE_DIR = path.join(PROJECT_ROOT, 'node_modules', '@gabriel-sisjr');
const LINK_PATH = path.join(SCOPE_DIR, 'react-native-background-location');

const isLinkAlreadyCorrect = () => {
  let stat;
  try {
    stat = fs.lstatSync(LINK_PATH);
  } catch {
    return false;
  }
  if (!stat.isSymbolicLink()) {
    return false;
  }
  const resolved = path.resolve(SCOPE_DIR, fs.readlinkSync(LINK_PATH));
  return resolved === WORKSPACE_ROOT;
};

if (isLinkAlreadyCorrect()) {
  process.stdout.write(
    '[link-library] @gabriel-sisjr/react-native-background-location symlink already in place\n'
  );
  process.exit(0);
}

fs.mkdirSync(SCOPE_DIR, { recursive: true });

try {
  fs.rmSync(LINK_PATH, { recursive: true, force: true });
} catch {
  // Nothing to remove.
}

fs.symlinkSync(WORKSPACE_ROOT, LINK_PATH, 'dir');
process.stdout.write(
  `[link-library] linked ${LINK_PATH} -> ${WORKSPACE_ROOT}\n`
);
