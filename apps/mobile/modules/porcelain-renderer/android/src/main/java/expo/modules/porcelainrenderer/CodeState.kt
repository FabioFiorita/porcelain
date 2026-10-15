package expo.modules.porcelainrenderer

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue

// The Expo view owns bridge state; composition-local scroll/menu state stays in CodeContent.
internal class CodeState {
  var tokens by mutableStateOf(RenderTokens())
  var options by mutableStateOf(CodeOptions())
  var lines by mutableStateOf(emptyList<CodeLine>())
    private set
  var selection by mutableStateOf<ReviewSelection?>(null)
    private set
  private var anchor: Int? = null
  var selectable by mutableStateOf(false)

  fun updateData(value: String) {
    lines = decodeCodeLines(value)
    anchor = null
  }

  // JavaScript owns the selection; clearing it also drops the anchor.
  fun updateSelection(value: String) {
    selection = decodeReviewSelection(value)
    if (selection == null) anchor = null
  }

  fun choose(side: String?, line: Int, reset: Boolean): ReviewSelection {
    if (reset || anchor == null || selection?.side != side) anchor = line
    val start = anchor ?: line
    val range = ReviewSelection(side, minOf(start, line), maxOf(start, line))
    // A second tap can arrive before the bridge echoes the first selection.
    selection = range
    return range
  }
}
