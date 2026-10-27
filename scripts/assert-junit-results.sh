#!/usr/bin/env bash
#
# assert-junit-results.sh
#
# Zero-test guard over JUnit XML reports. Gradle 8 does not fail a test task
# that ran no tests (a filter that matches nothing, or test sources that were
# never compiled, still exits 0), so CI reads the reports instead of trusting
# the exit code. Used by the `android unit tests` job in
# .github/workflows/ci.yml after `yarn test:android`.
#
# Usage:
#   ./scripts/assert-junit-results.sh <results dir> [<RequiredClass> ...]
#
#   <results dir>    directory with the JUnit XML reports, one TEST-*.xml per
#                    test class (e.g. android/build/test-results/testDebugUnitTest)
#   <RequiredClass>  a test class that must have run: simple name
#                    (MotionGateTest) or fully qualified
#                    (com.backgroundlocation.motion.MotionGateTest)
#
# Fails when:
#   - the directory has no *.xml report, a report has no <testsuite>, or the
#     reports add up to 0 tests (or every test was skipped);
#   - failures + errors > 0 (the failing test cases are listed);
#   - a required class has no report, or its report has no executed test.
#
# Prints one line per test class and the totals, so the CI log shows what ran.
#
# Exit codes:
#   0  All checks passed.
#   1  Usage error or any failed check.

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

if [[ $# -lt 1 ]]; then
  usage
  exit 1
fi

RESULTS_DIR="$1"
shift

# Java class names: identifiers joined by dots; `$` marks a nested class.
CLASS_NAME_RE='^[A-Za-z_][A-Za-z0-9_.$]*$'
for class_name in "$@"; do
  [[ "$class_name" =~ $CLASS_NAME_RE ]] || die "not a test class name: '$class_name'"
done

command -v node > /dev/null 2>&1 || die "node is required to read the JUnit reports"

# Reads every *.xml report in JUNIT_DIR (not recursive) and checks the totals
# and the classes listed in JUNIT_REQUIRED (space-separated).
SUMMARIZE_JS='
const fs = require("fs");
const path = require("path");
const dir = process.env.JUNIT_DIR;
const required = (process.env.JUNIT_REQUIRED || "").split(/\s+/).filter(Boolean);
const annotate = Boolean(process.env.GITHUB_ACTIONS);
const problems = [];

const ATTRIBUTE = /([\w:.-]+)\s*=\s*(?:"([^"]*)"|\x27([^\x27]*)\x27)/g;
const ATTRIBUTES = "((?:\\s+[\\w:.-]+\\s*=\\s*(?:\"[^\"]*\"|\x27[^\x27]*\x27))*)";
const decode = (text) =>
  text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&apos;/g, "\x27")
    .replace(/&amp;/g, "&");
const attributesOf = (text) => {
  const result = {};
  let match;
  ATTRIBUTE.lastIndex = 0;
  while ((match = ATTRIBUTE.exec(text)) !== null) {
    result[match[1]] = decode(match[2] !== undefined ? match[2] : match[3]);
  }
  return result;
};
const count = (attributes, key, file) => {
  if (attributes[key] === undefined) return 0;
  const value = Number(attributes[key]);
  if (!Number.isInteger(value) || value < 0) {
    problems.push(file + ": <testsuite> has a non-numeric " + key + "=\"" + attributes[key] + "\"");
    return 0;
  }
  return value;
};

let files = null;
try {
  files = fs.readdirSync(dir)
    .filter((name) => name.endsWith(".xml") && fs.statSync(path.join(dir, name)).isFile())
    .sort();
} catch (error) {
  problems.push("cannot read the JUnit report directory " + dir + " (" + error.code + "); did the test task run?");
}

const suites = [];
const failedCases = [];
for (const name of files || []) {
  const file = path.join(dir, name);
  // Test output (CDATA) and comments may contain anything, including tags.
  const xml = fs.readFileSync(file, "utf8")
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "");
  const suiteTag = new RegExp("<testsuite" + ATTRIBUTES + "\\s*\\/?>", "g");
  let found = 0;
  let match;
  while ((match = suiteTag.exec(xml)) !== null) {
    found += 1;
    const attributes = attributesOf(match[1]);
    if (attributes.tests === undefined) {
      problems.push(file + ": <testsuite> has no tests attribute");
    }
    suites.push({
      name: attributes.name || name.replace(/^TEST-/, "").replace(/\.xml$/, ""),
      tests: count(attributes, "tests", file),
      failures: count(attributes, "failures", file),
      errors: count(attributes, "errors", file),
      skipped: count(attributes, "skipped", file),
    });
  }
  if (found === 0) problems.push(file + " is not a JUnit report (no <testsuite> element)");
  const caseTag = new RegExp("<testcase" + ATTRIBUTES + "\\s*(\\/>|>([\\s\\S]*?)<\\/testcase>)", "g");
  const outcomeTag = new RegExp("<(failure|error)" + ATTRIBUTES + "\\s*\\/?>");
  while ((match = caseTag.exec(xml)) !== null) {
    const outcome = (match[3] || "").match(outcomeTag);
    if (outcome) {
      const testCase = attributesOf(match[1]);
      const detail = attributesOf(outcome[2]);
      failedCases.push(
        outcome[1] + ": " + (testCase.classname || "?") + " > " + (testCase.name || "?") +
          (detail.message ? " (" + detail.message.split("\n")[0].slice(0, 200) + ")" : "")
      );
    }
  }
}

const total = suites.reduce(
  (sum, suite) => ({
    tests: sum.tests + suite.tests,
    failures: sum.failures + suite.failures,
    errors: sum.errors + suite.errors,
    skipped: sum.skipped + suite.skipped,
  }),
  { tests: 0, failures: 0, errors: 0, skipped: 0 }
);

if (files !== null) {
  console.log("JUnit reports in " + dir + ": " + files.length + " file(s)");
  const width = Math.min(70, Math.max(0, ...suites.map((suite) => suite.name.length)));
  for (const suite of suites) {
    console.log("  " + suite.name.padEnd(width) + "  tests=" + suite.tests + " failures=" + suite.failures +
      " errors=" + suite.errors + " skipped=" + suite.skipped);
  }
  console.log("total: " + total.tests + " tests, " + total.failures + " failures, " + total.errors +
    " errors, " + total.skipped + " skipped in " + suites.length + " classes");
  if (files.length === 0) problems.push("no *.xml report in " + dir);
  else if (total.tests === 0) problems.push("the reports in " + dir + " add up to 0 tests");
  else if (total.tests === total.skipped) problems.push("every test in " + dir + " was skipped (" + total.skipped + ")");
}
if (total.failures + total.errors > 0) {
  problems.push(total.failures + " failure(s) and " + total.errors + " error(s) in " + dir);
  for (const line of failedCases.slice(0, 20)) console.error("  " + line);
  if (failedCases.length > 20) console.error("  ... and " + (failedCases.length - 20) + " more");
}

const present = [];
// Without any report the directory problem above is the whole story.
const checkRequired = files !== null && files.length > 0;
for (const wanted of checkRequired ? required : []) {
  const matches = suites.filter((suite) => suite.name === wanted || suite.name.endsWith("." + wanted));
  const executed = matches.reduce((sum, suite) => sum + suite.tests - suite.skipped, 0);
  if (matches.length === 0) problems.push("required test class " + wanted + " has no report in " + dir);
  else if (executed <= 0) problems.push("required test class " + wanted + " ran no test");
  else present.push(wanted + " (" + executed + ")");
}
if (required.length > 0) {
  console.log("required classes: " + present.length + "/" + required.length + " ran" +
    (present.length > 0 ? ": " + present.join(", ") : ""));
}

if (problems.length > 0) {
  for (const problem of problems) {
    if (annotate) console.error("::error::" + problem);
    console.error("FAIL: " + problem);
  }
  process.exit(1);
}
console.log("OK (junit): " + total.tests + " tests in " + suites.length + " classes, 0 failures");
'

JUNIT_DIR="$RESULTS_DIR" JUNIT_REQUIRED="$*" exec node -e "$SUMMARIZE_JS"
