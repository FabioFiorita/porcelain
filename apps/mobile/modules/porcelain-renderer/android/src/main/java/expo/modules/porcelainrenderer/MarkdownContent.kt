package expo.modules.porcelainrenderer

import android.graphics.Bitmap
import androidx.compose.foundation.Image
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.net.HttpURLConnection
import java.net.URL
import java.io.IOException
import java.io.ByteArrayOutputStream
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

private fun text(block: MarkdownBlock, codeFamily: FontFamily, onLink: (String) -> Unit): AnnotatedString = buildAnnotatedString {
  block.runs.forEach { run ->
    withStyle(SpanStyle(fontWeight = if (run.bold) FontWeight.Bold else null, fontStyle = if (run.italic) FontStyle.Italic else null, fontFamily = if (run.code) codeFamily else null)) {
      if (run.url != null) withLink(LinkAnnotation.Url(run.url, linkInteractionListener = { onLink(run.url) })) { append(run.text) }
      else append(run.text)
    }
  }
}
@Composable
internal fun MarkdownContent(blocks: List<MarkdownBlock>, tokens: RenderTokens, onLink: (String) -> Unit) {
  val codeFamily = rememberRendererFontFamily("Geist Mono")
  val sansFamily = FontFamily.Default
  LazyColumn(Modifier.fillMaxSize().background(tokens.background), contentPadding = PaddingValues(tokens.pagePadding.dp), verticalArrangement = Arrangement.spacedBy(tokens.pagePadding.dp)) {
    items(blocks, key = { it.id }) { block ->
      SelectionContainer {
        if (block.kind == "image") MarkdownImage(block, tokens)
        else if (block.kind == "code") Text(text(block, codeFamily) {}, Modifier.clip(RoundedCornerShape(tokens.radius.dp)).background(tokens.codeBackground).horizontalScroll(rememberScrollState()).padding(tokens.blockPadding.dp), fontFamily = codeFamily, color = tokens.foreground, fontSize = tokens.codeSize.sp)
        else Text(text(block, codeFamily) { url -> onLink(url) },
          modifier = if (block.kind == "heading") Modifier.semantics { heading() } else Modifier,
          fontSize = (if (block.kind == "heading") if (block.level == 1) tokens.headingSize else if (block.level == 2) tokens.subheadingSize else tokens.bodySize else tokens.bodySize).sp,
          fontFamily = sansFamily,
          fontWeight = if (block.kind == "heading") FontWeight.SemiBold else FontWeight.Normal,
          color = if (block.kind == "quote") tokens.muted else tokens.foreground)
      }
    }
  }
}

@Composable
private fun MarkdownImage(block: MarkdownBlock, tokens: RenderTokens) {
  var loading by remember(block.url) { mutableStateOf(block.url != null) }
  val bitmap by produceState<Bitmap?>(null, block.url) {
    value = withContext(Dispatchers.IO) {
      try {
        block.url?.let { address ->
          val connection = URL(address).openConnection() as HttpURLConnection
          try {
            connection.connectTimeout = 15000
            connection.readTimeout = 15000
            connection.inputStream.use { input ->
              val output = ByteArrayOutputStream()
              val buffer = ByteArray(8192)
              while (true) {
                val count = input.read(buffer)
                if (count < 0) break
                if (output.size() + count > 16 * 1024 * 1024) throw IOException("Image is too large")
                output.write(buffer, 0, count)
              }
              decodeImage(output.toByteArray(), 2048)
            }
          } finally { connection.disconnect() }
        }
      } catch (_: IOException) { null }
    }
    loading = false
  }
  val image = bitmap
  val alt = block.runs.firstOrNull()?.text ?: "Image"
  if (image != null) Image(image.asImageBitmap(), alt, Modifier.fillMaxWidth().aspectRatio(image.width.toFloat() / image.height), contentScale = ContentScale.Fit)
  else Text("${if (loading) "Loading image" else "Image unavailable"} · $alt", color = tokens.muted, fontSize = tokens.bodySize.sp)
}
