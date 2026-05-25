import Foundation

/// Internal seam for surfacing degenerate-input observations from the iOS native nil-guard layer.
///
/// Intentionally not exposed via the Objective-C bridge (`@objc`) and must not be referenced
/// from JS, the `.mm` transport layer, or any public TypeScript surface.
internal var guardLogger: (String) -> Void = { message in
  NSLog("%@", message)
}
