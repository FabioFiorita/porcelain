import ExpoModulesCore
import SwiftUI

// Expo retains the state across prop updates; SwiftUI borrows that same observable owner.
@MainActor
final class CodeSurface: ExpoView {
  let model = CodeState()
  let onCodeSelect = EventDispatcher()
  let onExpand = EventDispatcher()
  let onReadingLine = EventDispatcher()
  private var host: UIHostingController<CodeContent>?
  private var fittedHeight: CGFloat = -1

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
    }, reading: { [weak self] line in
      self?.onReadingLine(["line": line])
    }, copy: { text in
      UIPasteboard.general.string = text
    }, fit: { [weak self] height in
      guard let self else { return }
      let rounded = ceil(height)
      guard rounded != fittedHeight else { return }
      fittedHeight = rounded
      // A negative width leaves the width to the parent layout.
      setViewSize(CGSize(width: -1, height: rounded))
    }))
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    if model.viewportWidth != bounds.width { model.viewportWidth = bounds.width }
  }
}
