package expo.modules.porcelainrenderer

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import kotlinx.coroutines.flow.distinctUntilChanged
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.*
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private fun CodeLine.columns() = text.sumOf { char -> (if (char == '\t') 4 else if (char.code > 0x2E7F) 2 else 1).toInt() }

@OptIn(ExperimentalFoundationApi::class)
@Composable
internal fun CodeContent(lines: List<CodeLine>, options: CodeOptions, tokens: RenderTokens, selection: ReviewSelection?, selectable: Boolean, location: (CodeLine) -> CodeLocation?, choose: (CodeLine, Boolean) -> Unit, expand: (String) -> Unit, copy: (String) -> Unit, initialLine: Int?, reading: (Int) -> Unit) {
  val listState = rememberLazyListState()
  var restored by remember { mutableStateOf(false) }
  LaunchedEffect(initialLine, lines.isEmpty()) {
    if (!restored && initialLine != null && lines.isNotEmpty()) {
      listState.scrollToItem((initialLine - 1).coerceIn(0, lines.lastIndex))
      restored = true
    }
  }
  LaunchedEffect(restored, lines) {
    if (restored) snapshotFlow { listState.firstVisibleItemIndex }
      .distinctUntilChanged()
      .collect { index -> reading(index + 1) }
  }
  val digits = remember(lines) { (lines.maxOfOrNull { maxOf(it.oldLine ?: 0, it.newLine ?: 0) } ?: 1).toString().length }
  val measurer = rememberTextMeasurer()
  val density = LocalDensity.current
  val codeFamily = rememberRendererFontFamily("Geist Mono")
  val sansFamily = FontFamily.Default
  val font = LocalTextStyle.current.merge(TextStyle(fontSize = tokens.codeSize.sp, fontFamily = codeFamily))
  val gutterWidth = with(density) { measurer.measure("0".repeat(digits), font).size.width.toDp() } + tokens.inset.dp
  val scrolling = if (options.wrap) Modifier else Modifier.horizontalScroll(rememberScrollState())
  BoxWithConstraints(Modifier.fillMaxSize().background(options.background)) {
    val viewportWidth = maxWidth
    val contentWidth = if (options.wrap) viewportWidth else remember(lines, options.lineNumbers, font, gutterWidth, viewportWidth, tokens.spacing) {
      val widest = lines.filter { it.kind != "gap" }.maxByOrNull { it.columns() }?.text.orEmpty()
      val marked = lines.any { it.kind in listOf("added", "removed") }
      val gutters = if (!options.lineNumbers) 0 else if (marked || lines.any { it.oldLine != null }) 2 else 1
      val marker = if (marked) measurer.measure("+", font).size.width else 0
      val codeWidth = with(density) { (measurer.measure(widest, font, softWrap = false).size.width + marker).toDp() }
      maxOf(viewportWidth, codeWidth + gutterWidth * gutters + tokens.spacing.dp * (gutters + (if (marked) 1 else 0) + 2))
    }
    // Rows in a horizontal scroller get unbounded width, so fillMaxWidth alone stops each background at its own text.
    val rowWidth = if (options.wrap) Modifier.fillMaxWidth() else Modifier.widthIn(min = contentWidth)
    Box(Modifier.then(scrolling)) {
    LazyColumn(Modifier.fillMaxHeight().then(rowWidth), state = listState) {
      items(lines, key = { it.id }) { line ->
        if (line.kind == "gap") {
          TextButton(onClick = { expand(line.id) }) { Text(line.text, color = options.muted, fontFamily = sansFamily) }
        } else {
          val point = location(line)
          val side = point?.side
          val number = point?.line
          val selected = selection?.let { range -> line.location(range.side)?.let { it.side == range.side && it.line in range.startLine..range.endLine } } ?: false
          var menu by remember { mutableStateOf(false) }
          Box {
            Row(rowWidth.background(if (selected) Color.Blue.copy(alpha = 0.12f) else if (line.kind == "added") Color.Green.copy(alpha = 0.1f) else if (line.kind == "removed") Color.Red.copy(alpha = 0.1f) else Color.Transparent)
              .combinedClickable(onClick = { if (selectable && number != null) choose(line, false) }, onLongClick = { menu = true })
              .semantics { contentDescription = "${line.kind} ${side ?: "file"} line ${number ?: 0}: ${line.text}"; customActions = listOf(CustomAccessibilityAction("Select for review") { if (selectable && number != null) { choose(line, true); true } else false }, CustomAccessibilityAction("Extend review selection") { if (selectable && number != null) { choose(line, false); true } else false }) }
              .padding(horizontal = tokens.spacing.dp, vertical = tokens.inset.dp), horizontalArrangement = Arrangement.spacedBy(tokens.spacing.dp)) {
              if (options.lineNumbers) {
                if (line.oldLine != null || line.kind in listOf("added", "removed")) Text(line.oldLine?.toString() ?: " ", Modifier.width(gutterWidth), color = options.muted, fontSize = tokens.codeSize.sp, fontFamily = codeFamily)
                Text(line.newLine?.toString() ?: " ", Modifier.width(gutterWidth), color = options.muted, fontSize = tokens.codeSize.sp, fontFamily = codeFamily)
              }
              if (line.kind in listOf("added", "removed")) Text(if (line.kind == "added") "+" else "−", color = options.muted, fontSize = tokens.codeSize.sp, fontFamily = codeFamily)
                Text(buildAnnotatedString {
                  if (line.tokens.isEmpty()) append(line.text.ifEmpty { " " })
                  else line.tokens.forEach { token -> withStyle(SpanStyle(fontStyle = if (token.fontStyle and 1 != 0) FontStyle.Italic else FontStyle.Normal, fontWeight = if (token.fontStyle and 2 != 0) FontWeight.Bold else FontWeight.Normal, textDecoration = if (token.fontStyle and 4 != 0) TextDecoration.Underline else TextDecoration.None, color = token.color ?: options.foreground, background = if (token.changed) (if (line.kind == "removed") Color.Red else Color.Green).copy(alpha = 0.2f) else Color.Transparent)) { append(token.text) } }
                }, color = options.foreground, fontSize = tokens.codeSize.sp, fontFamily = codeFamily, softWrap = options.wrap)
            }
            DropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
              DropdownMenuItem(text = { Text("Copy line", fontFamily = sansFamily) }, onClick = { copy(line.text); menu = false })
              if (selectable && number != null) {
                DropdownMenuItem(text = { Text("Select for review", fontFamily = sansFamily) }, onClick = { choose(line, true); menu = false })
                DropdownMenuItem(text = { Text("Extend review selection", fontFamily = sansFamily) }, onClick = { choose(line, false); menu = false })
              }
            }
          }
        }
      }
    }
  }
}
}
