package expo.modules.porcelainrenderer

import android.content.Context
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.platform.ViewCompositionStrategy
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.*
import androidx.compose.ui.text.font.*
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView

data class MarkdownBlock(val text: String, val kind: String, val level: Int = 0)
fun markdownBlocks(source: String): List<MarkdownBlock> {
  val blocks = mutableListOf<MarkdownBlock>()
  val paragraph = mutableListOf<String>()
  var code: MutableList<String>? = null
  var fence = ""
  fun flush() { if (paragraph.isNotEmpty()) { blocks.add(MarkdownBlock(paragraph.joinToString("\n"), "paragraph")); paragraph.clear() } }
  source.replace("\r\n", "\n").split("\n").forEach { line ->
    if (code != null) {
      if (line.startsWith(fence)) { blocks.add(MarkdownBlock(code!!.joinToString("\n"), "code")); code = null } else code!!.add(line)
    } else if (line.startsWith("```") || line.startsWith("~~~")) { flush(); fence = line.take(3); code = mutableListOf() }
    else if (line.isEmpty()) flush()
    else if (Regex("^#{1,6} ").containsMatchIn(line)) { flush(); val level = line.indexOf(' '); blocks.add(MarkdownBlock(line.drop(level + 1), "heading", level)) }
    else if (line.startsWith("> ")) { flush(); blocks.add(MarkdownBlock(line.drop(2), "quote")) }
    else if (line.startsWith("- ") || line.startsWith("* ")) { flush(); blocks.add(MarkdownBlock("• " + line.drop(2), "list")) }
    else paragraph.add(line)
  }
  flush(); code?.let { blocks.add(MarkdownBlock(it.joinToString("\n"), "code")) }
  return blocks
}
private fun inlineMarkdown(text: String, onLink: (String) -> Unit): AnnotatedString = buildAnnotatedString {
  val pattern = Regex("\\[([^\\]]+)\\]\\(([^)]+)\\)|\\*\\*([^*]+)\\*\\*|`([^`]+)`|\\*([^*]+)\\*")
  var at = 0
  pattern.findAll(text).forEach { match ->
    append(text.substring(at, match.range.first))
    val groups = match.groupValues
    when {
      groups[1].isNotEmpty() -> withLink(LinkAnnotation.Url(groups[2], linkInteractionListener = { onLink(groups[2]) })) { append(groups[1]) }
      groups[3].isNotEmpty() -> withStyle(SpanStyle(fontWeight = FontWeight.Bold)) { append(groups[3]) }
      groups[4].isNotEmpty() -> withStyle(SpanStyle(fontFamily = FontFamily.Monospace)) { append(groups[4]) }
      else -> withStyle(SpanStyle(fontStyle = FontStyle.Italic)) { append(groups[5]) }
    }
    at = match.range.last + 1
  }
  append(text.substring(at))
}
class MarkdownSurface(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  val onLink by EventDispatcher()
  var blocks by mutableStateOf(emptyList<MarkdownBlock>())
  init {
    addView(ComposeView(context).apply {
      layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
      setViewCompositionStrategy(ViewCompositionStrategy.DisposeOnDetachedFromWindow)
      setContent { MaterialTheme {
        LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
          itemsIndexed(blocks) { _, block ->
            SelectionContainer {
              if (block.kind == "code") Text(block.text, Modifier.horizontalScroll(rememberScrollState()).padding(12.dp), fontFamily = FontFamily.Monospace, fontSize = 13.sp)
              else Text(inlineMarkdown(block.text) { url -> onLink(mapOf("url" to url)) },
                modifier = if (block.kind == "heading") Modifier.semantics { heading() } else Modifier,
                fontSize = (if (block.kind == "heading") if (block.level == 1) 24 else if (block.level == 2) 20 else 16 else 13).sp,
                fontWeight = if (block.kind == "heading") FontWeight.SemiBold else FontWeight.Normal,
                color = if (block.kind == "quote") MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface)
            }
          }
        }
      } }
    })
  }
}
