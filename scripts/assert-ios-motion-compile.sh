#!/usr/bin/env bash
#
# assert-ios-motion-compile.sh
#
# Proves which way the opt-in CoreMotion code of the BackgroundLocation pod was
# compiled. The Podfile line `$BackgroundLocationMotionActivity = true` (added
# by the Expo config plugin's `motionActivity` prop, or by hand in a bare app)
# makes the podspec link CoreMotion and define the Swift compilation condition
# BACKGROUND_LOCATION_MOTION. Without it, no CoreMotion API may reach the
# library binary, so default apps never need NSMotionUsageDescription. Used by
# the `build-ios` (off) and `expo ios build` (on) jobs in
# .github/workflows/ci.yml.
#
# Usage:
#   ./scripts/assert-ios-motion-compile.sh <on|off> <ios project dir> [--binary]
#
#   <ios project dir>  the directory with the Podfile and, after `pod install`,
#                      Pods/ (e.g. example/ios or example-expo/ios)
#
# Checks (after `pod install`):
#   - Pods/Target Support Files/BackgroundLocation/BackgroundLocation.{debug,release}.xcconfig:
#     OTHER_SWIFT_FLAGS keeps -DRCT_NEW_ARCH_ENABLED in both modes (the podspec
#     must set its xcconfig before install_modules_dependencies merges into it);
#     on: OTHER_SWIFT_FLAGS also has -DBACKGROUND_LOCATION_MOTION;
#     off: BACKGROUND_LOCATION_MOTION appears nowhere in the file.
#   - Pods/Local Podspecs/BackgroundLocation.podspec.json (the podspec as
#     CocoaPods evaluated it for this Podfile): on: `frameworks` lists
#     CoreMotion; off: neither `frameworks` nor `weak_frameworks` mention it.
#   - on only: every aggregate Pods-<target>.{debug,release}.xcconfig that links
#     BackgroundLocation also links -framework "CoreMotion". A static-library pod
#     carries no link flags of its own, so this is where the framework reaches
#     the app. Off skips it: another pod may link CoreMotion for its own reasons.
#
#   --binary (after the Xcode build) also checks the newest built
#   BackgroundLocation product under DerivedData (libBackgroundLocation.a, or
#   BackgroundLocation.framework when the app uses frameworks), preferring the
#   DerivedData folders of the project's .xcworkspace:
#     on:  `nm -u` lists _OBJC_CLASS_$_CMMotionActivityManager;
#     off: `nm -u` lists no CoreMotion class (_OBJC_CLASS_$_CM*).
#   A missing binary is a failure. Linker autolink entries are not inspected:
#   system modules already autolink CoreMotion in every build, so only the
#   referenced symbols tell the two builds apart.
#
# Environment:
#   DERIVED_DATA_DIR  DerivedData root to search with --binary
#                     (default: ~/Library/Developer/Xcode/DerivedData)
#
# Exit codes:
#   0  All checks passed.
#   1  Usage error, missing file, or a failed check.

set -euo pipefail

usage() {
  # Print the leading comment block (everything after the shebang up to the
  # first non-comment line) without the "# " prefix.
  awk 'NR == 1 { next } /^#/ { sub(/^# ?/, ""); print; next } { exit }' \
    "${BASH_SOURCE[0]}" >&2
}

CHECKS=0
FAILURES=0

annotate() {
  if [[ -n "${GITHUB_ACTIONS:-}" ]]; then
    echo "::error::$*" >&2
  fi
}

pass() {
  CHECKS=$((CHECKS + 1))
  echo "  ok   $*"
}

fail() {
  CHECKS=$((CHECKS + 1))
  FAILURES=$((FAILURES + 1))
  annotate "$*"
  echo "FAIL: $*" >&2
}

die() {
  annotate "$*"
  echo "FAIL: $*" >&2
  exit 1
}

if [[ $# -ge 1 && ( "$1" == "-h" || "$1" == "--help" ) ]]; then
  usage
  exit 0
fi

if [[ $# -lt 2 || $# -gt 3 ]]; then
  usage
  exit 1
fi

MODE="$1"
IOS_DIR="$2"
BINARY=0
case "$MODE" in
  on | off) ;;
  *)
    usage
    die "the mode must be 'on' or 'off', got '$MODE'"
    ;;
esac
if [[ $# -eq 3 ]]; then
  if [[ "$3" != "--binary" ]]; then
    usage
    die "unknown option '$3'"
  fi
  BINARY=1
fi

[[ -d "$IOS_DIR" ]] || die "iOS project directory not found: $IOS_DIR"
IOS_DIR="$(cd "$IOS_DIR" && pwd)"
command -v node > /dev/null 2>&1 || die "node is required to read the evaluated podspec"

SUPPORT_DIR="$IOS_DIR/Pods/Target Support Files"
POD_SUPPORT_DIR="$SUPPORT_DIR/BackgroundLocation"
PODSPEC_JSON="$IOS_DIR/Pods/Local Podspecs/BackgroundLocation.podspec.json"

[[ -d "$POD_SUPPORT_DIR" ]] ||
  die "$POD_SUPPORT_DIR not found; run 'pod install' in $IOS_DIR first"

echo "==> BackgroundLocation motion activity compiled $MODE ($IOS_DIR)"

# xcconfig_value <file> <KEY>: the values of every `KEY = ...` line (including
# conditional `KEY[sdk=...] = ...` lines), joined by spaces.
xcconfig_value() {
  local file="$1" key="$2"
  { grep -E "^[[:space:]]*${key}(\\[[^]]*\\])?[[:space:]]*=" "$file" || true; } |
    sed -E 's/^[^=]*=//' | tr '\n' ' '
}

# has_define <flags> <NAME>: true when the flags define the Swift compilation
# condition NAME, written -DNAME or -D NAME. A here-string, not a pipe: `grep -q`
# exiting early must not turn into a SIGPIPE failure under pipefail.
has_define() {
  grep -Eq "[[:space:]]-D[[:space:]]*$2[[:space:]]" <<< " $1 "
}

# --- pod target xcconfig: Swift compilation conditions --------------------------

for config in debug release; do
  xcconfig="$POD_SUPPORT_DIR/BackgroundLocation.$config.xcconfig"
  if [[ ! -f "$xcconfig" ]]; then
    fail "missing $xcconfig"
    continue
  fi
  name="BackgroundLocation.$config.xcconfig"
  flags="$(xcconfig_value "$xcconfig" OTHER_SWIFT_FLAGS)"
  if has_define "$flags" RCT_NEW_ARCH_ENABLED; then
    pass "$name OTHER_SWIFT_FLAGS keeps -DRCT_NEW_ARCH_ENABLED"
  else
    fail "$name OTHER_SWIFT_FLAGS lost -DRCT_NEW_ARCH_ENABLED (the podspec must set pod_target_xcconfig before install_modules_dependencies): $flags"
  fi
  if [[ "$MODE" == "on" ]]; then
    if has_define "$flags" BACKGROUND_LOCATION_MOTION; then
      pass "$name OTHER_SWIFT_FLAGS has -DBACKGROUND_LOCATION_MOTION"
    else
      fail "$name OTHER_SWIFT_FLAGS must contain -DBACKGROUND_LOCATION_MOTION when motion activity is on (is \$BackgroundLocationMotionActivity = true set in the Podfile before the first target?): $flags"
    fi
  else
    if grep -Fq BACKGROUND_LOCATION_MOTION "$xcconfig"; then
      fail "$name must not mention BACKGROUND_LOCATION_MOTION when motion activity is off: $(grep -Fn BACKGROUND_LOCATION_MOTION "$xcconfig" | tr '\n' ' ')"
    else
      pass "$name has no BACKGROUND_LOCATION_MOTION"
    fi
  fi
done

# --- evaluated podspec: frameworks of this pod ---------------------------------

# Prints the frameworks the evaluated podspec declares; exits 0 when they match
# the mode. Arguments: <podspec.json> <on|off>
CHECK_PODSPEC_JS='
const [file, mode] = process.argv.slice(1);
const spec = JSON.parse(require("fs").readFileSync(file, "utf8"));
const list = (value) => (value === undefined || value === null ? [] : [].concat(value));
const pick = (key) => list(spec[key]).concat(list(spec.ios && spec.ios[key]));
const frameworks = pick("frameworks");
const weak = pick("weak_frameworks");
console.log("frameworks [" + frameworks.join(", ") + "]" + (weak.length > 0 ? ", weak_frameworks [" + weak.join(", ") + "]" : ""));
const linked = mode === "on" ? frameworks.includes("CoreMotion") : !frameworks.concat(weak).includes("CoreMotion");
process.exit(linked ? 0 : 1);
'

if [[ ! -f "$PODSPEC_JSON" ]]; then
  fail "missing $PODSPEC_JSON (BackgroundLocation must be a :path pod, as autolinking installs it)"
else
  declared=""
  if declared="$(node -e "$CHECK_PODSPEC_JS" "$PODSPEC_JSON" "$MODE")"; then
    if [[ "$MODE" == "on" ]]; then
      pass "evaluated podspec links CoreMotion: $declared"
    else
      pass "evaluated podspec does not link CoreMotion: $declared"
    fi
  else
    if [[ "$MODE" == "on" ]]; then
      fail "the evaluated podspec must list CoreMotion in frameworks when motion activity is on: ${declared:-unreadable $PODSPEC_JSON}"
    else
      fail "the evaluated podspec must not link CoreMotion when motion activity is off: ${declared:-unreadable $PODSPEC_JSON}"
    fi
  fi
fi

# --- aggregate xcconfig: CoreMotion reaches the app's link (on only) -----------

if [[ "$MODE" == "on" ]]; then
  aggregates=()
  shopt -s nullglob
  for aggregate in "$SUPPORT_DIR"/Pods-*/Pods-*.debug.xcconfig "$SUPPORT_DIR"/Pods-*/Pods-*.release.xcconfig; do
    aggregates+=("$aggregate")
  done
  shopt -u nullglob
  for config in debug release; do
    linking=0
    for aggregate in ${aggregates[@]+"${aggregates[@]}"}; do
      [[ "$aggregate" == *".$config.xcconfig" ]] || continue
      ldflags="$(xcconfig_value "$aggregate" OTHER_LDFLAGS)"
      if [[ "$ldflags" != *'-l"BackgroundLocation"'* && "$ldflags" != *'-framework "BackgroundLocation"'* ]]; then
        continue
      fi
      linking=$((linking + 1))
      if [[ "$ldflags" == *'-framework "CoreMotion"'* ]]; then
        pass "$(basename "$aggregate") links -framework \"CoreMotion\""
      else
        fail "$(basename "$aggregate") links BackgroundLocation but not -framework \"CoreMotion\""
      fi
    done
    if (( linking == 0 )); then
      fail "no aggregate Pods-*.$config.xcconfig under $SUPPORT_DIR links BackgroundLocation"
    fi
  done
fi

# --- built binary: referenced CoreMotion classes (--binary) --------------------

nm_undefined() {
  if command -v xcrun > /dev/null 2>&1; then
    xcrun nm -u "$1"
  else
    nm -u "$1"
  fi
}

if (( BINARY == 1 )); then
  derived_data="${DERIVED_DATA_DIR:-$HOME/Library/Developer/Xcode/DerivedData}"
  workspace=""
  for candidate in "$IOS_DIR"/*.xcworkspace; do
    if [[ -d "$candidate" ]]; then
      workspace="$(basename "$candidate" .xcworkspace)"
      break
    fi
  done
  roots=()
  scope="the $workspace workspace"
  if [[ -n "$workspace" ]]; then
    for root in "$derived_data/$workspace"-*/Build/Products; do
      if [[ -d "$root" ]]; then roots+=("$root"); fi
    done
  fi
  if (( ${#roots[@]} == 0 )); then
    scope="any project"
    for root in "$derived_data"/*/Build/Products; do
      if [[ -d "$root" ]]; then roots+=("$root"); fi
    done
  fi
  binaries=()
  if (( ${#roots[@]} > 0 )); then
    while IFS= read -r -d '' binary; do
      binaries+=("$binary")
    done < <(find "${roots[@]}" \( -path '*/BackgroundLocation/libBackgroundLocation.a' \
      -o -path '*/BackgroundLocation.framework/BackgroundLocation' \) -type f -print0 2> /dev/null)
  fi
  if (( ${#binaries[@]} == 0 )); then
    fail "no built BackgroundLocation binary (libBackgroundLocation.a or BackgroundLocation.framework) for $scope under $derived_data; run the Xcode build first"
  else
    # Newest first; taking the first line by expansion avoids a SIGPIPE under
    # pipefail.
    newest="$(ls -t -- "${binaries[@]}")"
    newest="${newest%%$'\n'*}"
    echo "  binary: $newest (newest of ${#binaries[@]} for $scope)"
    if ! symbols="$(nm_undefined "$newest")"; then
      fail "nm -u failed on $newest"
    elif [[ "$MODE" == "on" ]]; then
      if grep -Fxq '_OBJC_CLASS_$_CMMotionActivityManager' <<< "$symbols"; then
        pass "the binary references _OBJC_CLASS_\$_CMMotionActivityManager"
      else
        fail "$newest does not reference _OBJC_CLASS_\$_CMMotionActivityManager: the CoreMotion source was not compiled in"
      fi
    else
      coremotion="$(grep -E '^_OBJC_CLASS_\$_CM[A-Z]' <<< "$symbols" | sort -u | tr '\n' ' ' || true)"
      if [[ -n "$coremotion" ]]; then
        fail "$newest references CoreMotion classes although motion activity is off: $coremotion"
      else
        pass "the binary references no CoreMotion class"
      fi
    fi
  fi
fi

if (( FAILURES > 0 )); then
  echo "$FAILURES of $CHECKS check(s) failed (ios motion compile: $MODE)" >&2
  exit 1
fi
echo "OK (ios motion compile: $MODE, $CHECKS checks)"
