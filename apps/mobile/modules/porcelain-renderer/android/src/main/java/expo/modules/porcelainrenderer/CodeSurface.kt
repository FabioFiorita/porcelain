package expo.modules.porcelainrenderer

import android.content.Context
import android.content.ClipData
import android.content.ClipboardManager
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.platform.ViewCompositionStrategy
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.*
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import org.json.JSONArray
import org.json.JSONObject

data class CodeToken(val text: String, val changed: Boolean, val color: Color?, val fontStyle: Int)
data class CodeLine(val id: String, val text: String, val oldLine: Int?, val newLine: Int?, val kind: String, val tokens: List<CodeToken>)
data class ReviewSelection(val side: String?, val startLine: Int, val endLine: Int)
data class CodeOptions(val wrap: Boolean = true, val lineNumbers: Boolean = true, val foreground: Color = Color.Black, val background: Color = Color.White, val muted: Color = Color.Gray)

class CodeSurface(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  val onSelect by EventDispatcher()
  val onExpand by EventDispatcher()
  var options by mutableStateOf(CodeOptions())
  private var lines by mutableStateOf(emptyList<CodeLine>())
  private var selection by mutableStateOf<ReviewSelection?>(null)
  private var anchor: Int? = null
  init {
    addView(ComposeView(context).apply {
      layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
      setViewCompositionStrategy(ViewCompositionStrategy.DisposeOnDetachedFromWindow)
      setContent { MaterialTheme { CodeContent(lines, options, selection, ::select, { id -> onExpand(mapOf("id" to id)) }, ::copy) } }
    })
  }
  fun updateData(value: String) {
    val array = JSONArray(value)
    lines = (0 until array.length()).map { index ->
      val row = array.getJSONObject(index)
      val tokens = row.optJSONArray("tokens") ?: JSONArray()
      CodeLine(row.getString("id"), row.getString("text"), if (row.has("oldLine")) row.getInt("oldLine") else null, if (row.has("newLine")) row.getInt("newLine") else null, row.optString("kind", "context"), (0 until tokens.length()).map { at ->
        val token = tokens.getJSONObject(at); CodeToken(token.getString("text"), token.optBoolean("changed"), if (token.has("color")) Color(token.getLong("color").toInt()) else null, token.optInt("fontStyle"))
      })
    }
    anchor = null
  }
  // JavaScript owns the selection; clearing it also drops the anchor so the next tap cannot extend a finished range.
  fun updateSelection(value: String) {
    selection = if (value.isEmpty()) null else JSONObject(value).let { ReviewSelection(if (it.has("side")) it.getString("side") else null, it.getInt("startLine"), it.getInt("endLine")) }
    if (selection == null) anchor = null
  }
  private fun select(side: String?, line: Int, reset: Boolean) {
    if (reset || anchor == null || selection?.side != side) anchor = line
    val start = anchor ?: line
    val range = mutableMapOf<String, Any>("startLine" to minOf(start, line), "endLine" to maxOf(start, line))
    side?.let { range["side"] = it }
    onSelect(range)
  }
  private fun copy(text: String) { (context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager).setPrimaryClip(ClipData.newPlainText("Code", text)) }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun CodeContent(lines: List<CodeLine>, options: CodeOptions, selection: ReviewSelection?, choose: (String?, Int, Boolean) -> Unit, expand: (String) -> Unit, copy: (String) -> Unit) {
  val gutterWidth = ((lines.maxOfOrNull { maxOf(it.oldLine ?: 0, it.newLine ?: 0) } ?: 1).toString().length * 8 + 4).dp
  val scrolling = if (options.wrap) Modifier else Modifier.horizontalScroll(rememberScrollState())
  Box(Modifier.fillMaxSize().background(options.background).then(scrolling)) {
    LazyColumn(Modifier.fillMaxHeight().then(if (options.wrap) Modifier.fillMaxWidth() else Modifier.widthIn(min = 300.dp))) {
      items(lines, key = { it.id }) { line ->
        if (line.kind == "gap") {
          TextButton(onClick = { expand(line.id) }) { Text(line.text, color = options.muted) }
        } else {
          val side = if (line.kind == "removed") "deletions" else if (line.oldLine != null || line.kind == "added") "additions" else null
          val number = if (side == "deletions") line.oldLine else line.newLine
          val selected = selection?.let { it.side == side && number != null && number in it.startLine..it.endLine } ?: false
          var menu by remember { mutableStateOf(false) }
          Box {
            Row(Modifier.fillMaxWidth().background(if (selected) Color.Blue.copy(alpha = 0.12f) else if (line.kind == "added") Color.Green.copy(alpha = 0.1f) else if (line.kind == "removed") Color.Red.copy(alpha = 0.1f) else Color.Transparent)
              .combinedClickable(onClick = { if (selection != null && number != null) choose(side, number, false) }, onLongClick = { menu = true })
              .semantics { contentDescription = "${line.kind} ${side ?: "file"} line ${number ?: 0}: ${line.text}"; customActions = listOf(CustomAccessibilityAction("Select for review") { number?.let { choose(side, it, true) }; number != null }, CustomAccessibilityAction("Extend review selection") { number?.let { choose(side, it, false) }; number != null }) }
              .padding(start = 8.dp, end = 8.dp, top = 4.dp, bottom = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
              if (options.lineNumbers) {
                if (line.oldLine != null || line.kind in listOf("added", "removed")) Text(line.oldLine?.toString() ?: " ", Modifier.width(gutterWidth), color = options.muted, fontSize = 13.sp, fontFamily = FontFamily.Monospace)
                Text(line.newLine?.toString() ?: " ", Modifier.width(gutterWidth), color = options.muted, fontSize = 13.sp, fontFamily = FontFamily.Monospace)
              }
              if (line.kind in listOf("added", "removed")) Text(if (line.kind == "added") "+" else "−", color = options.muted, fontSize = 13.sp)
              SelectionContainer {
                Text(buildAnnotatedString {
                  if (line.tokens.isEmpty()) append(line.text.ifEmpty { " " })
                  else line.tokens.forEach { token -> withStyle(SpanStyle(fontStyle = if (token.fontStyle and 1 != 0) FontStyle.Italic else FontStyle.Normal, fontWeight = if (token.fontStyle and 2 != 0) FontWeight.Bold else FontWeight.Normal, textDecoration = if (token.fontStyle and 4 != 0) TextDecoration.Underline else TextDecoration.None, color = token.color ?: options.foreground, background = if (token.changed) (if (line.kind == "removed") Color.Red else Color.Green).copy(alpha = 0.2f) else Color.Transparent)) { append(token.text) } }
                }, color = options.foreground, fontSize = 13.sp, fontFamily = FontFamily.Monospace, softWrap = options.wrap)
              }
            }
            DropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
              DropdownMenuItem(text = { Text("Copy line") }, onClick = { copy(line.text); menu = false })
              if (number != null) {
                DropdownMenuItem(text = { Text("Select for review") }, onClick = { choose(side, number, true); menu = false })
                DropdownMenuItem(text = { Text("Extend review selection") }, onClick = { choose(side, number, false); menu = false })
              }
            }
          }
        }
      }
    }
  }
}
