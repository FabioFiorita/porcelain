import ExpoModulesCore
import SwiftUI

@MainActor
final class MarkdownSurface: ExpoView {
  let model = MarkdownState()
  let onLink = EventDispatcher()
  private var host: UIHostingController<MarkdownContent>?

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    host = mount(MarkdownContent(model: model, onLink: { [weak self] url in
      self?.onLink(["url": url])
    }))
  }
}
