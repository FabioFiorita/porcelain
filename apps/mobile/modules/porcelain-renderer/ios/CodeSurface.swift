import ExpoModulesCore
import SwiftUI

// Expo retains the state across prop updates; SwiftUI borrows that same observable owner.
@MainActor
final class CodeSurface: ExpoView {
  let model = CodeState()
  let onCodeSelect = EventDispatcher()
  let onExpand = EventDispatcher()
  private var host: UIHostingController<CodeContent>?

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    host = mount(CodeContent(model: model, choose: { [weak self] line, reset in
      guard let self else { return }
      guard model.selectable, let location = model.location(line) else { return }
      let selection = model.choose(location.side, location.line, reset: reset)
      var range: [String: Any] = ["startLine": selection.startLine, "endLine": selection.endLine]
      if let side = selection.side { range["side"] = side }
      onCodeSelect(range)
    }, expand: { [weak self] id in
      self?.onExpand(["id": id])
    }, copy: { text in
      UIPasteboard.general.string = text
    }))
  }
}
