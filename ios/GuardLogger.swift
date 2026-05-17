import Foundation

/// Internal seam used by the iOS native nil-guard layer (Workstream A — v0.16.0)
/// to surface degenerate-input observations.
///
/// All `[BackgroundLocation]`-prefixed log lines emitted by the input-validation
/// layer go through this closure. The default implementation forwards to
/// `NSLog`, preserving runtime behavior unchanged from a maintainer's
/// perspective. The seam exists only so that XCTests in Workstream B can swap
/// in a capturing closure to assert log-line shape, count, and ordering.
///
/// - Important: This is an `internal` Swift API. It is intentionally NOT
///   exposed via the Objective-C bridge (`@objc`) and MUST NOT be referenced
///   from JS, the `.mm` transport layer, or any public TypeScript surface.
///   Replacing it from outside the iOS native module is unsupported.
///
/// - Note: The signature is a single `(String) -> Void` closure rather than a
///   protocol/log-level enum to keep the seam absolutely minimal. If
///   structured logging is needed later, this seam can grow without breaking
///   the public API contract.
internal var guardLogger: (String) -> Void = { message in
  NSLog("%@", message)
}
