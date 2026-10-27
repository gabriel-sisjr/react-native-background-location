import Foundation

// Runner for the pure motion files (gate, normalization, options, preconditions).
// Prints "N passed, F failed" and exits 1 when F > 0 or N == 0.

let suites: [[TestCase]] = [
  motionGateTests,
  motionNormalizationTests,
  motionPreconditionsTests,
  motionOptionsTests,
]

for suite in suites {
  for test in suite {
    harness.run(test.name, test.body)
  }
}

print("\(harness.passed) passed, \(harness.failed) failed")
exit(harness.failed > 0 || harness.passed == 0 ? 1 : 0)
