import ExpoModulesCore
import SwiftUI

// Expo retains the state across prop updates; SwiftUI borrows that same observable owner.
@MainActor
final class CodeSurface: ExpoView {
  let model = CodeState()
  let onSelect = EventDispatcher()
  let onExpand = EventDispatcher()
  private var host: UIHostingController<CodeContent>?

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    host = mount(CodeContent(model: model, choose: { [weak self] side, line, reset in
      guard let self else { return }
      let selection = model.choose(side, line, reset: reset)
      var range: [String: Any] = ["startLine": selection.startLine, "endLine": selection.endLine]
      if let side = selection.side { range["side"] = side }
      onSelect(range)
    }, expand: { [weak self] id in
      self?.onExpand(["id": id])
    }, copy: { text in
      UIPasteboard.general.string = text
    }))
  }
}
