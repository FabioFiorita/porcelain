import ExpoModulesCore
import SwiftUI

extension ExpoView {
  func mount<Content: View>(_ content: Content) -> UIHostingController<Content> {
    let controller = UIHostingController(rootView: content)
    controller.view.backgroundColor = .clear
    controller.view.translatesAutoresizingMaskIntoConstraints = false
    addSubview(controller.view)
    NSLayoutConstraint.activate([
      controller.view.leadingAnchor.constraint(equalTo: leadingAnchor),
      controller.view.trailingAnchor.constraint(equalTo: trailingAnchor),
      controller.view.topAnchor.constraint(equalTo: topAnchor),
      controller.view.bottomAnchor.constraint(equalTo: bottomAnchor)
    ])
    return controller
  }
}

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

func isPreviewLink(_ url: URL) -> Bool {
  ["http", "https", "mailto"].contains(url.scheme?.lowercased() ?? "")
}
