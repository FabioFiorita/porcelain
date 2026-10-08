import ExpoModulesCore
import SwiftUI

public class PorcelainRendererModule: Module {
  public func definition() -> ModuleDefinition {
    Name("PorcelainRenderer")
    View(CodeSurface.self) {
      Events("onSelect", "onExpand")
      Prop("data") { (view: CodeSurface, value: String) in view.model.decode(value) }
      Prop("wrap") { (view: CodeSurface, value: Bool) in view.model.wrap = value }
      Prop("lineNumbers") { (view: CodeSurface, value: Bool) in view.model.lineNumbers = value }
      Prop("foreground") { (view: CodeSurface, value: UInt32) in view.model.foreground = Color(argb: value) }
      Prop("background") { (view: CodeSurface, value: UInt32) in view.model.background = Color(argb: value) }
      Prop("muted") { (view: CodeSurface, value: UInt32) in view.model.muted = Color(argb: value) }
    }
    View(HtmlSurface.self) {
      Events("onLink", "onError")
      Prop("html") { (view: HtmlSurface, value: String) in view.setHTML(value) }
    }
    View(ImageSurface.self) {
      Events("onLoad")
      Prop("data") { (view: ImageSurface, value: String) in view.model.decode(value) }
    }
    View(MarkdownSurface.self) {
      Events("onLink")
      Prop("source") { (view: MarkdownSurface, value: String) in view.model.blocks = markdownBlocks(value) }
    }
  }
}

extension Color {
  init(argb: UInt32) {
    self.init(.sRGB, red: Double((argb >> 16) & 255) / 255, green: Double((argb >> 8) & 255) / 255, blue: Double(argb & 255) / 255, opacity: Double((argb >> 24) & 255) / 255)
  }
}
