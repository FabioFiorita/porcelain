package expo.modules.porcelainrenderer

import android.content.Context
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import androidx.compose.runtime.Composable

class MarkdownSurface(context: Context, appContext: AppContext) : RendererHost(context, appContext) {
  val onLink by EventDispatcher()
  internal val state = MarkdownState()

  @Composable
  override fun RenderContent() {
    MarkdownContent(state.blocks, state.tokens) { url -> onLink(mapOf("url" to url)) }
  }
}
