package expo.modules.porcelainrenderer

import android.content.Context
import android.content.ClipData
import android.content.ClipboardManager
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import androidx.compose.runtime.Composable

class CodeSurface(context: Context, appContext: AppContext) : RendererHost(context, appContext) {
  val onCodeSelect by EventDispatcher()
  val onExpand by EventDispatcher()
  val onReadingLine by EventDispatcher()
  internal val state = CodeState()

  @Composable
  override fun RenderContent() {
    CodeContent(state.lines, state.options, state.tokens, state.selection, state.selectable, state::location, ::select, { id -> onExpand(mapOf("id" to id)) }, ::copy, state.initialLine, { line -> onReadingLine(mapOf("line" to line)) })
  }

  private fun select(line: CodeLine, reset: Boolean) {
    if (!state.selectable) return
    val location = state.location(line) ?: return
    val selection = state.choose(location.side, location.line, reset)
    val range = mutableMapOf<String, Any>("startLine" to selection.startLine, "endLine" to selection.endLine)
    selection.side?.let { range["side"] = it }
    onCodeSelect(range)
  }

  private fun copy(text: String) {
    (context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager).setPrimaryClip(ClipData.newPlainText("Code", text))
  }
}
