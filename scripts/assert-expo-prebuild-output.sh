#!/usr/bin/env bash
#
# assert-expo-prebuild-output.sh
#
# Value-level assertions on the native projects that `expo prebuild` generated
# for an Expo app using the @gabriel-sisjr/react-native-background-location
# config plugin. Used by:
#   - the `expo prebuild (android|ios)` jobs in .github/workflows/ci.yml
#     (target: the example-expo/ Yarn workspace),
#   - the `expo android build` job (merged manifest, after Gradle),
#   - scripts/verify-expo-tarball.sh (target: a scratch app that installed the
#     npm tarball).
#
# The assertions live in scripts/assert-expo-prebuild-output.mjs (Node >= 18, no
# dependencies); this wrapper only resolves paths and forwards the arguments.
#
# Usage:
#   ./scripts/assert-expo-prebuild-output.sh <android|android-merged|ios> \
#       [--project-dir <dir>] [--props-json <json> | --props-file <file>] [--verbose]
#
#   android         app AndroidManifest.xml right after `expo prebuild`:
#                   the 7 library permissions each declared exactly once, no
#                   duplicated <uses-permission>, no unexpected location
#                   permission, the motion permissions (below), and
#                   newArchEnabled is not false.
#   android-merged  the manifest Gradle produced (after `./gradlew
#                   :app:assembleDebug`): the 7 permissions once each, the
#                   motion permissions (below), the library service/receivers
#                   merged exactly once (the motion receiver with
#                   android:exported="false"), and the library module's own
#                   merged manifest (android/build/intermediates/merged_manifest/
#                   debug/processDebugManifest) never mentions
#                   ACTIVITY_RECOGNITION. The library manifest is merged by
#                   Gradle, never at prebuild time, so this is the only place
#                   those components can be asserted.
#   ios             Info.plist usage strings (expected value = plugin prop, else
#                   the app's ios.infoPlist value, else the library default),
#                   NSLocationTemporaryUsageDescriptionDictionary, UIBackgroundModes
#                   containing "location" exactly once, CocoaPods deployment target
#                   >= 16.0 and never lowered below the SDK default
#                   (Podfile.properties.json / Podfile fallback), app target
#                   IPHONEOS_DEPLOYMENT_TARGET >= 16.0 in project.pbxproj, the
#                   motion usage string and Podfile flag (below), and
#                   newArchEnabled is not false.
#
#   Motion activity follows the `motionActivity` plugin prop:
#     set      android.permission.ACTIVITY_RECOGNITION and
#              com.google.android.gms.permission.ACTIVITY_RECOGNITION each
#              declared once, the Play services one with
#              android:maxSdkVersion="28" unless the app declares it itself;
#              NSMotionUsageDescription = prop usageDescription, else the app's
#              ios.infoPlist value, else the library default; the Podfile sets
#              `$BackgroundLocationMotionActivity = true` exactly once, before
#              the first target.
#     not set  neither permission and no NSMotionUsageDescription unless the app
#              declares them (then exactly its own value, once); the Podfile
#              never mentions BackgroundLocationMotionActivity.
#
# Options:
#   --project-dir <dir>  Expo project root. Default: $EXPO_PROJECT_DIR, else
#                        <repo>/example-expo.
#   --props-json <json>  Expected plugin props as JSON (any platform; the app's
#                        own android.permissions and ios.infoPlist are then
#                        taken as empty). Default: read from the project's own
#                        config via `expo config --json --type prebuild`, so the
#                        expectation follows app.json / app.config.ts and never
#                        drifts from it.
#   --props-file <file>  Same as --props-json, read from a file.
#   --verbose            Print every passed check, not only failures.
#
# Exit codes:
#   0  All assertions passed.
#   1  Usage error, missing file, or assertion failure.

set -euo pipefail

usage() {
  # Print the leading comment block (everything after the shebang up to the
  # first non-comment line) without the "# " prefix.
  awk 'NR == 1 { next } /^#/ { sub(/^# ?/, ""); print; next } { exit }' \
    "${BASH_SOURCE[0]}" >&2
}

if [[ $# -ge 1 && ( "$1" == "-h" || "$1" == "--help" ) ]]; then
  usage
  exit 0
fi

if [[ $# -lt 1 ]]; then
  usage
  exit 1
fi

PLATFORM="$1"
shift

case "$PLATFORM" in
  android | android-merged | ios) ;;
  *)
    echo "ERROR: unknown platform '$PLATFORM' (expected 'android', 'android-merged' or 'ios')" >&2
    exit 1
    ;;
esac

# Resolve paths relative to this script so the assertion works regardless of the
# caller's cwd (CI runs from the repo root; humans may run from anywhere).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_DIR="${EXPO_PROJECT_DIR:-$REPO_ROOT/example-expo}"

if ! command -v node > /dev/null 2>&1; then
  echo "ERROR: node is required to run the assertions" >&2
  exit 1
fi

# --project-dir given on the command line wins over the environment default.
ARGS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --project-dir)
      if [[ $# -lt 2 ]]; then
        echo "ERROR: --project-dir requires a value" >&2
        exit 1
      fi
      PROJECT_DIR="$2"
      shift 2
      ;;
    *)
      ARGS+=("$1")
      shift
      ;;
  esac
done

# "${ARGS[@]+...}" keeps `set -u` happy on bash 3.2 when ARGS is empty.
exec node "$SCRIPT_DIR/assert-expo-prebuild-output.mjs" "$PLATFORM" \
  --project-dir "$PROJECT_DIR" ${ARGS[@]+"${ARGS[@]}"}
