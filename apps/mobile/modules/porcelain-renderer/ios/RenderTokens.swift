import SwiftUI

// Values are resolved from the design tokens in JS, in unscaled points.
struct RenderTokens: Decodable {
  var codeSize: CGFloat = 0
  var captionSize: CGFloat = 0
  var bodySize: CGFloat = 0
  var headingSize: CGFloat = 0
  var subheadingSize: CGFloat = 0
  var spacing: CGFloat = 0
  var inset: CGFloat = 0
  var blockPadding: CGFloat = 0
  var pagePadding: CGFloat = 0
  var radius: CGFloat = 0
  static func decode(_ value: String) -> RenderTokens {
    (try? JSONDecoder().decode(RenderTokens.self, from: Data(value.utf8))) ?? RenderTokens()
  }
}
