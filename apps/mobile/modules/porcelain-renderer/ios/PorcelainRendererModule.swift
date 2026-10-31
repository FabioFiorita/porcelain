import ExpoModulesCore
import SwiftUI

public class PorcelainRendererModule: Module {
  public func definition() -> ModuleDefinition {
    Name("PorcelainRenderer")
    // Expo applies view props on the UI thread. Keep updates synchronous and actor-checked.
    View(CodeSurface.self) {
      Events("onCodeSelect", "onExpand", "onReadingLine")
      Prop("initialLine") { (view: CodeSurface, value: Int?) in MainActor.assumeIsolated { view.model.initialLine = value } }
      Prop("tokens") { (view: CodeSurface, value: String) in MainActor.assumeIsolated { view.model.tokens = RenderTokens.decode(value) } }
      Prop("data") { (view: CodeSurface, value: String) in MainActor.assumeIsolated { view.model.decode(value) } }
      Prop("wrap") { (view: CodeSurface, value: Bool) in MainActor.assumeIsolated { view.model.wrap = value } }
      Prop("lineNumbers") { (view: CodeSurface, value: Bool) in MainActor.assumeIsolated { view.model.lineNumbers = value } }
      Prop("selectable") { (view: CodeSurface, value: Bool) in MainActor.assumeIsolated { view.model.selectable = value } }
      Prop("foreground") { (view: CodeSurface, value: UInt32) in MainActor.assumeIsolated { view.model.foreground = Color(argb: value) } }
      Prop("background") { (view: CodeSurface, value: UInt32) in MainActor.assumeIsolated { view.model.background = Color(argb: value) } }
      Prop("muted") { (view: CodeSurface, value: UInt32) in MainActor.assumeIsolated { view.model.muted = Color(argb: value) } }
      Prop("selection") { (view: CodeSurface, value: String) in MainActor.assumeIsolated { view.model.select(value) } }
    }
    View(HtmlSurface.self) {
      Events("onLink", "onError")
      Prop("html") { (view: HtmlSurface, value: String) in MainActor.assumeIsolated { view.setHTML(value) } }
      Prop("textScale") { (view: HtmlSurface, value: Double) in MainActor.assumeIsolated { view.setTextScale(CGFloat(value)) } }
    }
    View(ImageSurface.self) {
      Events("onLoad")
      Prop("data") { (view: ImageSurface, value: String) in MainActor.assumeIsolated { view.setData(value) } }
    }
    View(MarkdownSurface.self) {
      Events("onLink")
      Prop("tokens") { (view: MarkdownSurface, value: String) in MainActor.assumeIsolated { view.model.tokens = RenderTokens.decode(value) } }
      Prop("data") { (view: MarkdownSurface, value: String) in MainActor.assumeIsolated { view.model.decode(value) } }
    }
  }
}
