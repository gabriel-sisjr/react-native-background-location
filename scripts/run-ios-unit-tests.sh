#!/usr/bin/env bash
#
# run-ios-unit-tests.sh
#
# Compiles the Foundation-only motion sources of the iOS library together with
# the assertion runner in ios-tests/motion-gate/ and runs it: the reduction
# gate truth table, the CoreMotion normalization, the start preconditions and
# the option clamps. Plain `swiftc` for macOS, with no Xcode project, simulator
# or CocoaPods, so it takes seconds on any Mac. ios-tests/ lies outside the
# podspec glob and the npm `files` list, so none of this ships.
#
# Usage:
#   ./scripts/run-ios-unit-tests.sh      (or: yarn test:ios)
#
# The runner prints "N passed, F failed" and exits non-zero when F > 0 or when
# no case ran; this script exits with the runner's status, or non-zero when a
# source is missing or the compilation fails.
#
# Environment:
#   KEEP_OUTPUT=1  keep the temporary build directory (its path is printed)
#
# Exit codes:
#   0  Compiled, and every case passed.
#   1  Usage or toolchain error, or a missing source.
#   *  Otherwise the status of swiftc or of the runner.

set -euo pipefail

usage() {
  # Print the leading comment block (everything after the shebang up to the
  # first non-comment line) without the "# " prefix.
  awk 'NR == 1 { next } /^#/ { sub(/^# ?/, ""); print; next } { exit }' \
    "${BASH_SOURCE[0]}" >&2
}

die() {
  if [[ -n "${GITHUB_ACTIONS:-}" ]]; then
    echo "::error::$*" >&2
  fi
  echo "FAIL: $*" >&2
  exit 1
}

if [[ $# -ge 1 && ( "$1" == "-h" || "$1" == "--help" ) ]]; then
  usage
  exit 0
fi
if [[ $# -gt 0 ]]; then
  usage
  die "unexpected argument '$1'"
fi

[[ "$(uname -s)" == "Darwin" ]] || die "the iOS unit tests need macOS (xcrun swiftc with the macOS SDK)"
command -v xcrun > /dev/null 2>&1 || die "xcrun not found; install the Xcode command line tools"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

# The pure files compiled into the pod as well: Foundation only, no #if, no
# @objc, no logging seam, so they build for macOS unchanged.
SOURCES=(
  ios/Motion/MotionGate.swift
  ios/Motion/MotionNormalization.swift
  ios/Motion/MotionOptions.swift
  ios/Motion/MotionPreconditions.swift
)
for source in "${SOURCES[@]}"; do
  [[ -f "$source" ]] || die "missing $source"
done
TESTS=()
shopt -s nullglob
for test_source in ios-tests/motion-gate/*.swift; do
  TESTS+=("$test_source")
done
shopt -u nullglob
(( ${#TESTS[@]} > 0 )) || die "no test sources in ios-tests/motion-gate/"

OUT="$(mktemp -d "${TMPDIR:-/tmp}/motion-gate-tests.XXXXXX")"
if [[ "${KEEP_OUTPUT:-}" == "1" ]]; then
  echo "build directory kept: $OUT"
else
  trap 'rm -rf "$OUT"' EXIT
fi

echo "==> $(xcrun --sdk macosx swiftc --version 2>&1 | head -n 1)"
echo "==> compiling ${#SOURCES[@]} library sources + ${#TESTS[@]} test sources"
xcrun --sdk macosx swiftc -swift-version 5 "${SOURCES[@]}" "${TESTS[@]}" -o "$OUT/motion-gate-tests"

echo "==> running motion-gate-tests"
status=0
"$OUT/motion-gate-tests" || status=$?
if (( status != 0 )); then
  if [[ -n "${GITHUB_ACTIONS:-}" ]]; then
    echo "::error::iOS motion unit tests failed (exit $status)" >&2
  fi
  echo "FAIL: iOS motion unit tests failed (exit $status)" >&2
fi
exit "$status"
