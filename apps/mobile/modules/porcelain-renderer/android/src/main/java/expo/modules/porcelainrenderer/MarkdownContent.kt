package expo.modules.porcelainrenderer

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.*
import androidx.compose.ui.text.font.*
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private fun text(block: MarkdownBlock, onLink: (String) -> Unit): AnnotatedString = buildAnnotatedString {
  block.runs.forEach { run ->
    withStyle(SpanStyle(fontWeight = if (run.bold) FontWeight.Bold else null, fontStyle = if (run.italic) FontStyle.Italic else null, fontFamily = if (run.code) FontFamily.Monospace else null)) {
      if (run.url != null) withLink(LinkAnnotation.Url(run.url, linkInteractionListener = { onLink(run.url) })) { append(run.text) }
      else append(run.text)
    }
  }
}
@Composable
internal fun MarkdownContent(blocks: List<MarkdownBlock>, tokens: RenderTokens, onLink: (String) -> Unit) {
  LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(tokens.pagePadding.dp), verticalArrangement = Arrangement.spacedBy(tokens.pagePadding.dp)) {
    items(blocks, key = { it.id }) { block ->
      SelectionContainer {
        if (block.kind == "code") Text(text(block) {}, Modifier.clip(RoundedCornerShape(tokens.radius.dp)).background(MaterialTheme.colorScheme.surfaceVariant).horizontalScroll(rememberScrollState()).padding(tokens.blockPadding.dp), fontFamily = FontFamily.Monospace, fontSize = tokens.codeSize.sp)
        else Text(text(block) { url -> onLink(url) },
          modifier = if (block.kind == "heading") Modifier.semantics { heading() } else Modifier,
          fontSize = (if (block.kind == "heading") if (block.level == 1) tokens.headingSize else if (block.level == 2) tokens.subheadingSize else tokens.bodySize else tokens.bodySize).sp,
          fontWeight = if (block.kind == "heading") FontWeight.SemiBold else FontWeight.Normal,
          color = if (block.kind == "quote") MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface)
      }
    }
  }
}
