package expo.modules.porcelainrenderer

import android.content.Context
import android.content.ClipData
import android.content.ClipboardManager
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView

class CodeSurface(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  val onSelect by EventDispatcher()
  val onExpand by EventDispatcher()
  internal val state = CodeState()

  init {
    mountContent { CodeContent(state.lines, state.options, state.tokens, state.selection, ::select, { id -> onExpand(mapOf("id" to id)) }, ::copy) }
  }

  private fun select(side: String?, line: Int, reset: Boolean) {
    val selection = state.choose(side, line, reset)
    val range = mutableMapOf<String, Any>("startLine" to selection.startLine, "endLine" to selection.endLine)
    selection.side?.let { range["side"] = it }
    onSelect(range)
  }

  private fun copy(text: String) {
    (context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager).setPrimaryClip(ClipData.newPlainText("Code", text))
  }
}
