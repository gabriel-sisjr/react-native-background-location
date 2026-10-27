import Foundation

/// Minimal assertion harness (no XCTest). A test passes when none of its checks fail.
final class TestHarness {
  private(set) var passed = 0
  private(set) var failed = 0
  private var failures: [String] = []

  /// Runs one named test and records its outcome.
  func run(_ name: String, _ body: () -> Void) {
    failures = []
    body()
    if failures.isEmpty {
      passed += 1
    } else {
      failed += 1
      print("FAIL \(name)")
      for failure in failures {
        print("  - \(failure)")
      }
    }
  }

  func expect(_ condition: Bool, _ message: @autoclosure () -> String, line: UInt = #line, file: StaticString = #fileID) {
    if !condition {
      failures.append("\(file):\(line) \(message())")
    }
  }

  func expectEqual<T: Equatable>(_ actual: T, _ expected: T, _ note: String = "", line: UInt = #line, file: StaticString = #fileID) {
    if actual != expected {
      failures.append("\(file):\(line) expected \(expected), got \(actual)\(note.isEmpty ? "" : " (\(note))")")
    }
  }
}

/// The shared harness used by every test file.
let harness = TestHarness()

/// A named test case.
typealias TestCase = (name: String, body: () -> Void)
