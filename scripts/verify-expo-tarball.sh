#!/usr/bin/env bash
#
# verify-expo-tarball.sh
#
# Consumes the npm tarball of @gabriel-sisjr/react-native-background-location the
# way an Expo user does and proves that the config plugin works from the packed
# artifact (files, package.json exports, app.plugin.js, peer resolution and the
# generated native projects), not only from the monorepo workspace.
#
# Commands:
#   contents <tarball>
#       Static checks on the tarball (seconds, offline): required files shipped,
#       sources/tests/tooling not shipped, package.json contract (exports map,
#       `expo` is an optional peer, no `@expo/config-plugins` peer, react-native
#       peer untouched, no install-time scripts), the plugin build imports
#       `expo/config-plugins`, and ios/PrivacyInfo.xcprivacy declares the
#       UserDefaults required-reason API with reason CA92.1 in that entry's own
#       reasons (and no C56D anywhere).
#
#   consumer --sdk <54|55|56|57|58|latest> [--tarball <file>] [--workdir <dir>]
#            [--platforms android,ios] [--variants defaults,props,preexisting]
#            [--keep]
#       Creates an app from expo-template-blank-typescript@sdk-N, installs the
#       tarball with PLAIN `npm install` (no --legacy-peer-deps, so peer
#       resolution errors surface), checks the package exports and TypeScript
#       types as a consumer sees them, then for every variant x platform runs
#       `expo prebuild --clean --no-install` and
#       scripts/assert-expo-prebuild-output.sh against the generated project.
#
#       Variants (the plugin entry in app.json):
#         defaults     no props -> library default usage strings
#         props        every prop set -> overrides win
#         preexisting  no props, but ios.infoPlist and android.permissions
#                      already declare overlapping values -> no duplicates, the
#                      app's own values and background modes are preserved
#         newarch-off  opt-in, SDK 54 only (later SDKs cannot disable the New
#                      Architecture): `newArchEnabled: false` must make
#                      prebuild fail with a plugin error (the guard)
#
#   all --sdk <...> [consumer options]
#       `contents` followed by `consumer` on the same tarball.
#
# Without --tarball the current checkout is packed (run `yarn prepare` first so
# lib/ and plugin/build/ exist). Nothing tracked is written inside the repository:
# the tarball and the scratch app live in --workdir (npm 10, the Node in .nvmrc,
# re-runs `prepare` during `npm pack` even with --ignore-scripts, which only
# rebuilds the gitignored lib/ and plugin/build/). The default --workdir is a
# fresh temp dir that is removed on success (unless --keep is given) and kept on
# failure; a directory passed with --workdir is never removed.
#
# Environment:
#   CREATE_EXPO_VERSION      create-expo version to use (default: 5.1.5). This is the
#                            generator that really runs: the create-expo-app wrapper
#                            only depends on the open range ">=5.0.1", so pinning the
#                            wrapper would pin nothing. The sdk-N template tags and
#                            the Expo packages they install still float by design.
#   MAX_TARBALL_BYTES        size guard for `contents` (default: 1048576)
#
# Examples:
#   yarn prepare
#   ./scripts/verify-expo-tarball.sh all --sdk 54
#   ./scripts/verify-expo-tarball.sh consumer --sdk 58 --variants props --platforms ios
#   ./scripts/verify-expo-tarball.sh contents path/to/package.tgz
#
# Exit codes:
#   0  Everything passed.
#   1  Usage error or any failed check.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PACKAGE_NAME="@gabriel-sisjr/react-native-background-location"
CREATE_EXPO_VERSION="${CREATE_EXPO_VERSION:-5.1.5}"
MAX_TARBALL_BYTES="${MAX_TARBALL_BYTES:-1048576}"

# Paths removed on exit (temp files, extracted tarballs, packed tarball dir).
CLEANUP_PATHS=()
# Scratch app directory: removed on success only, kept for debugging on failure.
WORKDIR_TO_REMOVE=""
GROUP_OPEN=0

cleanup() {
  local status=$?
  local path
  for path in ${CLEANUP_PATHS[@]+"${CLEANUP_PATHS[@]}"}; do
    rm -rf "$path"
  done
  if [[ -n "$WORKDIR_TO_REMOVE" ]]; then
    if (( status == 0 )); then
      rm -rf "$WORKDIR_TO_REMOVE"
    else
      echo "workdir kept for debugging: $WORKDIR_TO_REMOVE" >&2
    fi
  fi
}
trap cleanup EXIT

usage() {
  awk 'NR == 1 { next } /^#/ { sub(/^# ?/, ""); print; next } { exit }' \
    "${BASH_SOURCE[0]}" >&2
}

log() {
  echo "==> $*"
}

# Collapsible log groups on GitHub Actions, plain headings elsewhere.
group() {
  GROUP_OPEN=1
  if [[ -n "${GITHUB_ACTIONS:-}" ]]; then
    echo "::group::$*"
  else
    echo
    log "$*"
  fi
}

endgroup() {
  GROUP_OPEN=0
  if [[ -n "${GITHUB_ACTIONS:-}" ]]; then
    echo "::endgroup::"
  fi
}

die() {
  # Close the open group first so the failure is visible without expanding it.
  if (( GROUP_OPEN == 1 )) && [[ -n "${GITHUB_ACTIONS:-}" ]]; then
    echo "::endgroup::"
  fi
  GROUP_OPEN=0
  if [[ -n "${GITHUB_ACTIONS:-}" ]]; then
    echo "::error::$*" >&2
  fi
  echo "FAIL: $*" >&2
  exit 1
}

abs_path() {
  (cd "$(dirname "$1")" && printf '%s/%s\n' "$(pwd)" "$(basename "$1")")
}

need() {
  command -v "$1" > /dev/null 2>&1 || die "'$1' is required but was not found on PATH"
}

# Packs the current checkout into <dir> and prints the tarball path. <dir> is a
# directory this script owns (a fresh temp dir, or <workdir>/tarball), so
# tarballs left in it by an earlier run are removed first: a reused --workdir
# must not yield two paths.
pack_checkout() {
  local dir="$1"
  [[ -f "$REPO_ROOT/plugin/build/index.js" && -f "$REPO_ROOT/lib/module/index.js" ]] ||
    die "plugin/build and lib/ are missing; run 'yarn prepare' first or pass --tarball"
  need npm
  mkdir -p "$dir"
  rm -f "$dir"/*.tgz
  # npm 10 (the Node in .nvmrc) re-runs `prepare` for `npm pack` even with
  # --ignore-scripts (npm >= 11 honours it) and that output lands on stdout, so
  # never parse `--json`: <dir> then holds exactly one tarball.
  (cd "$REPO_ROOT" && npm pack --ignore-scripts --pack-destination "$dir" > /dev/null) ||
    die "npm pack failed"
  printf '%s\n' "$dir"/*.tgz
}

# ---------------------------------------------------------------------------
# contents
# ---------------------------------------------------------------------------

REQUIRED_FILES=(
  package/package.json
  package/README.md
  package/LICENSE
  package/app.plugin.js
  package/app.plugin.d.ts
  package/plugin/build/index.js
  package/plugin/build/index.d.ts
  package/lib/module/index.js
  package/lib/typescript/src/index.d.ts
  package/BackgroundLocation.podspec
  package/android/build.gradle
  package/android/src/main/AndroidManifest.xml
  package/ios/BackgroundLocation.mm
  package/ios/PrivacyInfo.xcprivacy
)

# Regular expressions (grep -E) for paths that must never be shipped.
FORBIDDEN_PATTERNS=(
  '^package/plugin/src/'
  '^package/plugin/tsconfig'
  # Defense in depth: only the "files" allow-list keeps plugin/README.md out.
  '^package/plugin/README\.md$'
  '/__tests__/'
  '/__fixtures__/'
  '/__mocks__/'
  '^package/(example|example-expo|website|scripts|coverage|node_modules)/'
  '^package/lib/typescript/(example|example-expo|website)/'
  '^package/\.'
  # react-native.config.js is schema-invalid for the React Native CLI
  # (ios.podspecPath) and must not ship; package.json "files" still names it, so
  # this gate is the only guard.
  '^package/react-native\.config\.js$'
  '^package/android/(build|gradle)/'
  '^package/android/gradlew'
  '^package/ios/build/'
  '(^|/)\.DS_Store$'
)

# package.json contract + plugin build, evaluated on the extracted tarball.
# Argument: <extracted package dir>
CHECK_PACKAGE_JS='
const fs = require("fs");
const path = require("path");
const root = process.argv[1];
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const problems = [];
const exp = pkg.exports || {};
for (const key of [".", "./app.plugin", "./app.plugin.js", "./package.json"]) {
  if (!(key in exp)) problems.push("package.json exports is missing \"" + key + "\"");
}
const peers = pkg.peerDependencies || {};
const meta = pkg.peerDependenciesMeta || {};
if (!peers.expo) problems.push("peerDependencies.expo is missing");
if (!(meta.expo && meta.expo.optional === true)) problems.push("peerDependenciesMeta.expo.optional must be true");
if ("@expo/config-plugins" in peers) problems.push("peerDependencies must not list @expo/config-plugins");
if (peers["react-native"] !== ">=0.73.0") problems.push("peerDependencies.react-native must stay \">=0.73.0\", found " + peers["react-native"]);
for (const hook of ["preinstall", "install", "postinstall"]) {
  if (pkg.scripts && pkg.scripts[hook]) problems.push("scripts." + hook + " would run on every consumer install");
}
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
const sources = walk(path.join(root, "plugin/build")).filter((f) => f.endsWith(".js")).map((f) => fs.readFileSync(f, "utf8")).join("\n");
if (/require\(["\x27]@expo\/config-plugins["\x27]\)/.test(sources)) problems.push("plugin/build still requires @expo/config-plugins (it must use expo/config-plugins)");
if (!/require\(["\x27]expo\/config-plugins["\x27]\)/.test(sources)) problems.push("plugin/build does not require expo/config-plugins");
if (problems.length) { problems.forEach((p) => console.error("FAIL: " + p)); process.exit(1); }
console.log("package.json contract OK (" + pkg.name + "@" + pkg.version + ")");
'

# Exit 0 only when the manifest (read from stdin, XML comments dropped) is a
# complete plist whose NSPrivacyAccessedAPICategoryUserDefaults entry lists
# CA92.1 among its own reasons; a CA92.1 under another category does not count.
CHECK_USERDEFAULTS_JS='
const xml = require("fs").readFileSync(0, "utf8").replace(/<!--[\s\S]*?-->/g, "");
const entries = xml.match(/<dict>(?:(?!<\/?dict>)[\s\S])*<\/dict>/g) || [];
const ok = /<\/plist>\s*$/.test(xml) && entries.some((dict) =>
  /<key>NSPrivacyAccessedAPIType<\/key>\s*<string>NSPrivacyAccessedAPICategoryUserDefaults<\/string>/.test(dict) &&
  /<key>NSPrivacyAccessedAPITypeReasons<\/key>\s*<array>(?:\s*<string>[^<]*<\/string>)*?\s*<string>\s*CA92\.1\s*<\/string>/.test(dict));
process.exit(ok ? 0 : 1);
'

# The iOS privacy manifest must declare the UserDefaults required-reason API with
# reason CA92.1 (data private to the app): the library reads and writes
# UserDefaults.standard. The SDK-wrapper reasons (C56D.*) do not apply to it and
# must never be declared. The needle checks are cheap and give specific messages;
# CHECK_USERDEFAULTS_JS then proves the pairing (CA92.1 belongs to the UserDefaults
# entry, outside any XML comment, in a complete plist). Prints its own OK line;
# returns 1 on any problem.
# Argument: <tarball>
check_privacy_manifest() {
  local tarball="$1" entry="package/ios/PrivacyInfo.xcprivacy"
  local manifest needle status=0
  manifest="$(tar -xOzf "$tarball" "$entry")" || {
    echo "FAIL: could not read $entry from the tarball" >&2
    return 1
  }
  for needle in NSPrivacyAccessedAPICategoryUserDefaults CA92.1; do
    if [[ "$manifest" != *"$needle"* ]]; then
      echo "FAIL: $entry does not declare $needle" >&2
      status=1
    fi
  done
  if [[ "$manifest" == *C56D* ]]; then
    echo "FAIL: $entry must not contain C56D (the UserDefaults reason is CA92.1)" >&2
    status=1
  fi
  # The needles above can sit anywhere (another category, an XML comment); also
  # require the structure: the UserDefaults entry itself lists CA92.1.
  if (( status == 0 )) && ! printf '%s' "$manifest" | node -e "$CHECK_USERDEFAULTS_JS"; then
    echo "FAIL: $entry: the NSPrivacyAccessedAPICategoryUserDefaults entry does not list CA92.1 as its own reason (or the plist is incomplete)" >&2
    status=1
  fi
  if (( status == 0 )); then
    echo "privacy manifest OK (NSPrivacyAccessedAPICategoryUserDefaults, CA92.1)"
  fi
  return "$status"
}

cmd_contents() {
  local tarball="$1"
  [[ -f "$tarball" ]] || die "tarball not found: $tarball"
  need tar
  need node

  group "Tarball contents: $(basename "$tarball")"
  local listing extract
  listing="$(mktemp "${TMPDIR:-/tmp}/tarball-listing.XXXXXX")"
  extract="$(mktemp -d "${TMPDIR:-/tmp}/tarball-extract.XXXXXX")"
  CLEANUP_PATHS+=("$listing" "$extract")
  tar -tzf "$tarball" > "$listing"
  echo "entries: $(wc -l < "$listing" | tr -d ' ')"

  local failed=0 file pattern hits size
  for file in "${REQUIRED_FILES[@]}"; do
    if ! grep -Fxq "$file" "$listing"; then
      echo "FAIL: missing from tarball: $file" >&2
      failed=1
    fi
  done
  for pattern in "${FORBIDDEN_PATTERNS[@]}"; do
    hits="$(grep -E "$pattern" "$listing" || true)"
    if [[ -n "$hits" ]]; then
      echo "FAIL: forbidden paths shipped (pattern $pattern):" >&2
      echo "$hits" | head -n 5 | sed 's/^/        /' >&2
      failed=1
    fi
  done

  size="$(wc -c < "$tarball" | tr -d ' ')"
  echo "size: $size bytes (limit $MAX_TARBALL_BYTES)"
  if (( size > MAX_TARBALL_BYTES )); then
    echo "FAIL: tarball is $size bytes, over the $MAX_TARBALL_BYTES guard" >&2
    failed=1
  fi

  # A missing manifest is already reported by the required-files check above.
  if grep -Fxq 'package/ios/PrivacyInfo.xcprivacy' "$listing"; then
    check_privacy_manifest "$tarball" || failed=1
  fi

  if (( failed == 0 )); then
    tar -xzf "$tarball" -C "$extract" package/package.json package/plugin/build
    node -e "$CHECK_PACKAGE_JS" "$extract/package" || failed=1
  fi

  if (( failed != 0 )); then
    die "tarball content checks failed"
  fi
  endgroup
  echo "OK (contents)"
}

# ---------------------------------------------------------------------------
# consumer
# ---------------------------------------------------------------------------

# Rewrites the plugin entry (and the fields that make the three variants differ)
# in app.json. Arguments: <app.json> <variant>
APPLY_VARIANT_JS='
const fs = require("fs");
const [file, variant] = process.argv.slice(1);
const PLUGIN = "@gabriel-sisjr/react-native-background-location";
const config = JSON.parse(fs.readFileSync(file, "utf8"));
const expo = config.expo;
expo.ios = { ...(expo.ios || {}), bundleIdentifier: "com.example.tarballcheck" };
expo.android = { ...(expo.android || {}), package: "com.example.tarballcheck" };
delete expo.ios.infoPlist;
delete expo.android.permissions;
expo.plugins = (expo.plugins || []).filter((entry) => {
  const name = Array.isArray(entry) ? entry[0] : entry;
  return !String(name).startsWith(PLUGIN);
});
if (variant === "defaults") {
  expo.plugins.push(PLUGIN);
} else if (variant === "props") {
  expo.plugins.push([PLUGIN, {
    locationWhenInUseUsageDescription: "Tarball check: location while in use.",
    locationAlwaysAndWhenInUseUsageDescription: "Tarball check: location in the background.",
    locationAlwaysUsageDescription: "Tarball check: location at all times.",
    temporaryUsageDescriptions: {
      AccurateFix: "Tarball check: accurate fix.",
      Navigation: "Tarball check: navigation."
    }
  }]);
} else if (variant === "newarch-off") {
  expo.newArchEnabled = false;
  expo.plugins.push(PLUGIN);
} else if (variant === "preexisting") {
  expo.ios.infoPlist = {
    UIBackgroundModes: ["location", "fetch"],
    NSLocationWhenInUseUsageDescription: "Declared by the app in ios.infoPlist."
  };
  expo.android.permissions = [
    "android.permission.ACCESS_FINE_LOCATION",
    "android.permission.ACCESS_COARSE_LOCATION",
    "android.permission.POST_NOTIFICATIONS"
  ];
  expo.plugins.push(PLUGIN);
} else {
  throw new Error("unknown variant " + variant);
}
fs.writeFileSync(file, JSON.stringify(config, null, 2) + "\n");
'

# Resolves the package the way Node and Expo do, from inside the scratch app.
CHECK_EXPORTS_JS='
const fs = require("fs");
const path = require("path");
const assert = require("assert");
const name = "@gabriel-sisjr/react-native-background-location";
const resolved = (sub) => require.resolve(name + sub);
const root = path.dirname(resolved("/package.json"));
assert.strictEqual(resolved("/app.plugin.js"), resolved("/app.plugin"), "app.plugin and app.plugin.js must resolve to the same file");
const mod = require(name + "/app.plugin.js");
const plugin = typeof mod === "function" ? mod : mod && mod.default;
assert.strictEqual(typeof plugin, "function", "app.plugin.js must export a config plugin function");
const pkg = require(name + "/package.json");
for (const rel of [pkg.main, pkg.types, "BackgroundLocation.podspec"]) {
  assert.ok(fs.existsSync(path.join(root, rel)), rel + " is listed by package.json but missing on disk");
}
console.log("exports OK: " + name + "@" + pkg.version);
'

TYPES_SMOKE_TS="import plugin from '@gabriel-sisjr/react-native-background-location/app.plugin';
import type { BackgroundLocationPluginProps } from '@gabriel-sisjr/react-native-background-location/app.plugin';

export const props: BackgroundLocationPluginProps = {
  locationWhenInUseUsageDescription: 'types smoke',
  temporaryUsageDescriptions: { AccurateFix: 'types smoke' },
};
export default plugin;
"

# in_dir <dir> <command...>: run a command from another directory (subshell).
in_dir() {
  local dir="$1"
  shift
  (cd "$dir" && "$@")
}

# run_logged <logfile> <command...>: output goes to the log, the tail is shown on failure.
run_logged() {
  local logfile="$1"
  shift
  if ! "$@" > "$logfile" 2>&1; then
    echo "---- last 60 lines of $logfile ----" >&2
    tail -n 60 "$logfile" >&2
    echo "------------------------------------" >&2
    return 1
  fi
}

cmd_consumer() {
  local sdk="" tarball="" workdir="" keep=0
  local platforms="android,ios" variants="defaults,props,preexisting"
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --sdk) sdk="${2:-}"; shift 2 ;;
      --tarball) tarball="${2:-}"; shift 2 ;;
      --workdir) workdir="${2:-}"; shift 2 ;;
      --platforms) platforms="${2:-}"; shift 2 ;;
      --variants) variants="${2:-}"; shift 2 ;;
      --keep) keep=1; shift ;;
      *) usage; die "unknown option '$1'" ;;
    esac
  done
  [[ -n "$sdk" ]] || { usage; die "--sdk is required"; }
  [[ "$sdk" == "latest" || "$sdk" =~ ^[0-9]+$ ]] ||
    die "--sdk must be a number (54, 55, ...) or 'latest', got '$sdk'"
  need node
  need npm
  need npx

  if [[ -z "$workdir" ]]; then
    workdir="$(mktemp -d "${TMPDIR:-/tmp}/verify-expo-tarball.XXXXXX")"
    if (( keep == 0 )); then
      WORKDIR_TO_REMOVE="$workdir"
    fi
  else
    mkdir -p "$workdir"
    workdir="$(cd "$workdir" && pwd)"
  fi
  local logs="$workdir/logs"
  mkdir -p "$logs"

  if [[ -z "$tarball" ]]; then
    group "Packing the current checkout"
    tarball="$(pack_checkout "$workdir/tarball")"
    endgroup
  fi
  tarball="$(abs_path "$tarball")"
  [[ -f "$tarball" ]] || die "tarball not found: $tarball"
  log "tarball: $tarball"

  local template
  if [[ "$sdk" == "latest" ]]; then
    template="blank-typescript@latest"
  else
    template="blank-typescript@sdk-$sdk"
  fi
  local app="$workdir/app"

  # Never prompt, never phone home, and ride out registry hiccups.
  export CI=1 EXPO_NO_TELEMETRY=1 EXPO_NO_GIT_STATUS=1
  export npm_config_fetch_retries=5 npm_config_fetch_retry_mintimeout=2000
  export npm_config_fetch_retry_maxtimeout=30000 npm_config_update_notifier=false

  group "Creating the app from $template"
  run_logged "$logs/create.log" in_dir "$workdir" \
    npx --yes "create-expo@$CREATE_EXPO_VERSION" app \
    --template "$template" --no-install --no-agents-md --yes ||
    die "create-expo failed (log above)"
  [[ -f "$app/app.json" ]] || die "create-expo did not produce $app/app.json"
  endgroup

  group "npm install (template dependencies)"
  run_logged "$logs/npm-install-template.log" in_dir "$app" \
    npm install --no-audit --no-fund --ignore-scripts ||
    die "npm install of the template dependencies failed"
  local expo_version rn_version
  expo_version="$(node -p 'require(process.argv[1] + "/node_modules/expo/package.json").version' "$app")"
  rn_version="$(node -p 'require(process.argv[1] + "/node_modules/react-native/package.json").version' "$app")"
  echo "expo $expo_version, react-native $rn_version"
  endgroup

  group "npm install of the tarball (plain npm, peer dependencies enforced)"
  run_logged "$logs/npm-install-tarball.log" in_dir "$app" \
    npm install --no-audit --no-fund --ignore-scripts "$tarball" ||
    die "npm install of the tarball failed; an ERESOLVE above means a peerDependencies range does not cover expo $expo_version"
  tail -n 4 "$logs/npm-install-tarball.log"
  endgroup

  group "Package exports and plugin entry as a consumer sees them"
  (cd "$app" && node -e "$CHECK_EXPORTS_JS") || die "package exports / app.plugin.js check failed"
  if [[ -x "$app/node_modules/.bin/tsc" ]]; then
    # One tsconfig per resolution mode: TypeScript 6 (Expo SDK 56+ templates)
    # refuses `tsc <file>` when a tsconfig.json exists, so never pass files.
    local pair module resolution smoke
    for pair in "esnext:bundler" "node16:node16"; do
      module="${pair%%:*}"
      resolution="${pair##*:}"
      smoke="$app/.types-smoke-$resolution"
      mkdir -p "$smoke"
      printf '%s' "$TYPES_SMOKE_TS" > "$smoke/consumer.ts"
      printf '{ "compilerOptions": { "noEmit": true, "strict": true, "skipLibCheck": true, "target": "es2022", "module": "%s", "moduleResolution": "%s", "types": [] }, "files": ["consumer.ts"] }\n' \
        "$module" "$resolution" > "$smoke/tsconfig.json"
      in_dir "$app" node_modules/.bin/tsc -p "$smoke/tsconfig.json" ||
        die "TypeScript cannot resolve the app.plugin types of $PACKAGE_NAME (moduleResolution=$resolution)"
      echo "types OK (moduleResolution=$resolution, typescript $(node -p 'require(process.argv[1] + "/node_modules/typescript/package.json").version' "$app"))"
    done
  else
    echo "typescript is not installed in the template; skipping the types smoke"
  fi
  endgroup

  local variant platform ran=0 old_ifs="$IFS"
  local -a variant_list platform_list
  IFS=','
  # shellcheck disable=SC2206
  variant_list=($variants)
  # shellcheck disable=SC2206
  platform_list=($platforms)
  IFS="$old_ifs"
  for variant in "${variant_list[@]}"; do
    (cd "$app" && node -e "$APPLY_VARIANT_JS" app.json "$variant") ||
      die "could not apply variant '$variant' to app.json"
    for platform in "${platform_list[@]}"; do
      if [[ "$variant" == "newarch-off" ]]; then
        if [[ "$sdk" == "latest" ]] || (( sdk > 54 )); then
          echo "[$variant] skipped: newArchEnabled=false is only supported on SDK 54"
          continue
        fi
        group "[$variant] expo prebuild --platform $platform (must fail)"
        if in_dir "$app" npx --no-install expo prebuild --platform "$platform" --clean --no-install \
          > "$logs/prebuild-$variant-$platform.log" 2>&1; then
          die "expo prebuild must abort when newArchEnabled is false ($platform), but it succeeded"
        fi
        grep -q '\[react-native-background-location/plugin\]' "$logs/prebuild-$variant-$platform.log" || {
          tail -n 30 "$logs/prebuild-$variant-$platform.log" >&2
          die "expo prebuild failed for newArchEnabled=false ($platform), but not with a plugin error"
        }
        echo "prebuild aborted with a plugin error, as expected"
        ran=$((ran + 1))
        endgroup
        continue
      fi
      group "[$variant] expo prebuild --platform $platform"
      run_logged "$logs/prebuild-$variant-$platform.log" in_dir "$app" \
        npx --no-install expo prebuild --platform "$platform" --clean --no-install ||
        die "expo prebuild failed for variant '$variant' on $platform"
      bash "$SCRIPT_DIR/assert-expo-prebuild-output.sh" "$platform" --project-dir "$app" ||
        die "assertions failed for variant '$variant' on $platform"
      ran=$((ran + 1))
      endgroup
    done
  done

  echo
  echo "OK (consumer): expo $expo_version / react-native $rn_version, $ran prebuild+assert runs"
  if (( keep == 1 )); then
    echo "workdir kept: $workdir"
  fi
}

# ---------------------------------------------------------------------------
# entry point
# ---------------------------------------------------------------------------

if [[ $# -lt 1 ]]; then
  usage
  exit 1
fi

COMMAND="$1"
shift
case "$COMMAND" in
  -h | --help)
    usage
    exit 0
    ;;
  contents)
    [[ $# -eq 1 ]] || { usage; die "contents takes exactly one argument: the tarball"; }
    cmd_contents "$(abs_path "$1")"
    ;;
  consumer)
    cmd_consumer "$@"
    ;;
  all)
    # Pack once so both phases look at the same file.
    tarball=""
    consumer_args=()
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --tarball) tarball="${2:-}"; shift 2 ;;
        *) consumer_args+=("$1"); shift ;;
      esac
    done
    if [[ -z "$tarball" ]]; then
      pack_dir="$(mktemp -d "${TMPDIR:-/tmp}/verify-expo-tarball-pack.XXXXXX")"
      CLEANUP_PATHS+=("$pack_dir")
      tarball="$(pack_checkout "$pack_dir")"
    fi
    tarball="$(abs_path "$tarball")"
    cmd_contents "$tarball"
    cmd_consumer --tarball "$tarball" ${consumer_args[@]+"${consumer_args[@]}"}
    ;;
  *)
    usage
    die "unknown command '$COMMAND'"
    ;;
esac
