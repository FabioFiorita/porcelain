package expo.modules.porcelainrenderer

import android.content.Context
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView

class MarkdownSurface(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  val onLink by EventDispatcher()
  internal val state = MarkdownState()

  init {
    mountContent { MarkdownContent(state.blocks, state.tokens) { url -> onLink(mapOf("url" to url)) } }
  }
}
