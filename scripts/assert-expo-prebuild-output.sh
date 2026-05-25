#!/usr/bin/env bash
#
# assert-expo-prebuild-output.sh
#
# Verifies that `expo prebuild` produced the expected native project files for
# the `example-expo/` Yarn workspace. Used by the `expo-prebuild` matrix job in
# .github/workflows/ci.yml to assert that the Expo config plugin emitted the
# correct AndroidManifest permissions, Info.plist usage descriptions, and
# UIBackgroundModes entries. Also asserts that no library service / receiver
# class names are duplicated (a duplicate would indicate the plugin merged
# something the bare autolinking config already provides).
#
# Usage:
#   ./scripts/assert-expo-prebuild-output.sh <android|ios>
#
# Exit codes:
#   0  All assertions passed.
#   1  Usage error, missing file, or assertion failure.

set -euo pipefail

if [[ "${1-}" == "" ]]; then
  echo "Usage: $0 <android|ios>" >&2
  exit 1
fi

PLATFORM="$1"

# Resolve EXAMPLE_DIR relative to this script's location so the assertion works
# regardless of the caller's cwd (CI runs from repo root; humans may run from
# anywhere).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
EXAMPLE_DIR="$REPO_ROOT/example-expo"

assert_contains() {
  local file="$1"
  local needle="$2"
  if ! grep -qF "$needle" "$file"; then
    echo "FAIL: expected '$needle' in $file" >&2
    exit 1
  fi
}

assert_count_exact() {
  local file="$1"
  local needle="$2"
  local expected="$3"
  local actual
  actual=$(grep -cF "$needle" "$file" || true)
  if [[ "$actual" != "$expected" ]]; then
    echo "FAIL: expected '$needle' to appear exactly $expected time(s) in $file, found $actual" >&2
    exit 1
  fi
}

assert_no_duplicate_class() {
  local file="$1"
  local class_name="$2"
  local count
  count=$(grep -cF "$class_name" "$file" || true)
  if (( count > 1 )); then
    echo "FAIL: class '$class_name' appears $count times in $file (expected at most 1)" >&2
    exit 1
  fi
}

case "$PLATFORM" in
  android)
    MANIFEST="$EXAMPLE_DIR/android/app/src/main/AndroidManifest.xml"

    if [[ ! -f "$MANIFEST" ]]; then
      echo "FAIL: AndroidManifest.xml not found at $MANIFEST" >&2
      echo "Hint: run 'yarn expo prebuild --platform android --clean --no-install' inside example-expo/ first." >&2
      exit 1
    fi

    # Required permissions (one assertion per line for readability)
    assert_contains "$MANIFEST" "android.permission.ACCESS_FINE_LOCATION"
    assert_contains "$MANIFEST" "android.permission.ACCESS_COARSE_LOCATION"
    assert_contains "$MANIFEST" "android.permission.ACCESS_BACKGROUND_LOCATION"
    assert_contains "$MANIFEST" "android.permission.FOREGROUND_SERVICE"
    assert_contains "$MANIFEST" "android.permission.FOREGROUND_SERVICE_LOCATION"
    assert_contains "$MANIFEST" "android.permission.POST_NOTIFICATIONS"
    assert_contains "$MANIFEST" "android.permission.RECEIVE_BOOT_COMPLETED"

    # No library service / receiver class names should be duplicated. Autolinking
    # already merges the library AndroidManifest into the app manifest, so the
    # plugin must NOT add these again.
    assert_no_duplicate_class "$MANIFEST" "LocationService"
    assert_no_duplicate_class "$MANIFEST" "NotificationActionReceiver"
    assert_no_duplicate_class "$MANIFEST" "GeofenceBroadcastReceiver"
    assert_no_duplicate_class "$MANIFEST" "BootCompletedReceiver"

    echo "OK ($PLATFORM)"
    ;;

  ios)
    INFO_PLIST=$(find "$EXAMPLE_DIR/ios" -name 'Info.plist' -not -path '*/Pods/*' 2>/dev/null | head -n 1 || true)

    if [[ -z "$INFO_PLIST" || ! -f "$INFO_PLIST" ]]; then
      echo "FAIL: Info.plist not found under $EXAMPLE_DIR/ios" >&2
      echo "Hint: run 'yarn expo prebuild --platform ios --clean --no-install' inside example-expo/ first." >&2
      exit 1
    fi

    # Required location usage description keys
    assert_contains "$INFO_PLIST" "NSLocationWhenInUseUsageDescription"
    assert_contains "$INFO_PLIST" "NSLocationAlwaysAndWhenInUseUsageDescription"
    assert_contains "$INFO_PLIST" "NSLocationAlwaysUsageDescription"

    # UIBackgroundModes must contain `location` exactly once (the plugin must
    # not duplicate it if Expo's default config already declared it).
    assert_count_exact "$INFO_PLIST" "<string>location</string>" 1

    echo "OK ($PLATFORM)"
    ;;

  *)
    echo "ERROR: unknown platform '$PLATFORM' (expected 'android' or 'ios')" >&2
    exit 1
    ;;
esac
