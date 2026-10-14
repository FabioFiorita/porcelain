package expo.modules.porcelainrenderer

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue

internal class MarkdownState {
  var tokens by mutableStateOf(RenderTokens())
  var blocks by mutableStateOf(emptyList<MarkdownBlock>())
    private set

  fun updateData(value: String) { blocks = decodeMarkdownBlocks(value) }
}
