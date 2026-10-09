package expo.modules.porcelainrenderer

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import androidx.compose.ui.graphics.Color

class PorcelainRendererModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("PorcelainRenderer")
    View(CodeSurface::class) {
      Events("onSelect", "onExpand")
      Prop("tokens") { view: CodeSurface, value: String -> view.tokens = RenderTokens.decode(value) }
      Prop("data") { view: CodeSurface, value: String -> view.updateData(value) }
      Prop("wrap") { view: CodeSurface, value: Boolean -> view.options = view.options.copy(wrap = value) }
      Prop("lineNumbers") { view: CodeSurface, value: Boolean -> view.options = view.options.copy(lineNumbers = value) }
      Prop("foreground") { view: CodeSurface, value: Long -> view.options = view.options.copy(foreground = Color(value.toInt())) }
      Prop("background") { view: CodeSurface, value: Long -> view.options = view.options.copy(background = Color(value.toInt())) }
      Prop("muted") { view: CodeSurface, value: Long -> view.options = view.options.copy(muted = Color(value.toInt())) }
      Prop("selection") { view: CodeSurface, value: String -> view.updateSelection(value) }
    }
    View(HtmlSurface::class) {
      Events("onLink", "onError")
      OnViewDestroys { view: HtmlSurface -> view.destroy() }
      Prop("html") { view: HtmlSurface, value: String -> view.setHTML(value) }
      Prop("textScale") { view: HtmlSurface, value: Double -> view.setTextScale(value) }
    }
    View(ImageSurface::class) {
      Events("onLoad")
      Prop("data") { view: ImageSurface, value: String -> view.decode(value) }
    }
    View(MarkdownSurface::class) {
      Events("onLink")
      Prop("tokens") { view: MarkdownSurface, value: String -> view.tokens = RenderTokens.decode(value) }
      Prop("data") { view: MarkdownSurface, value: String -> view.updateData(value) }
    }
  }
}
