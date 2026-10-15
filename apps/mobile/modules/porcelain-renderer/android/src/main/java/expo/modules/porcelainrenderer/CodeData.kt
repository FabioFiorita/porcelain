package expo.modules.porcelainrenderer

import androidx.compose.ui.graphics.Color
import org.json.JSONArray
import org.json.JSONObject

data class CodeToken(val text: String, val changed: Boolean, val color: Color?, val fontStyle: Int)
data class CodeLine(val id: String, val text: String, val oldLine: Int?, val newLine: Int?, val kind: String, val tokens: List<CodeToken>) {
  fun location(preferredSide: String? = null): CodeLocation? {
    if (kind == "gap") return null
    if (kind == "removed") return oldLine?.let { CodeLocation("deletions", it) }
    if (kind == "added") return newLine?.let { CodeLocation("additions", it) }
    if (oldLine != null) {
      if (preferredSide == "deletions" || newLine == null) return CodeLocation("deletions", oldLine)
      return newLine?.let { CodeLocation("additions", it) }
    }
    return newLine?.let { CodeLocation(null, it) }
  }
}
data class ReviewSelection(val side: String?, val startLine: Int, val endLine: Int)
data class CodeLocation(val side: String?, val line: Int)
data class CodeOptions(val wrap: Boolean = true, val lineNumbers: Boolean = true, val foreground: Color = Color.Black, val background: Color = Color.White, val muted: Color = Color.Gray)

internal fun decodeCodeLines(value: String): List<CodeLine> {
  val array = JSONArray(value)
  return (0 until array.length()).map { index ->
    val row = array.getJSONObject(index)
    val tokens = row.optJSONArray("tokens") ?: JSONArray()
    CodeLine(row.getString("id"), row.getString("text"), if (row.has("oldLine")) row.getInt("oldLine") else null, if (row.has("newLine")) row.getInt("newLine") else null, row.optString("kind", "context"), (0 until tokens.length()).map { at ->
      val token = tokens.getJSONObject(at); CodeToken(token.getString("text"), token.optBoolean("changed"), if (token.has("color")) Color(token.getLong("color").toInt()) else null, token.optInt("fontStyle"))
    })
  }
}

internal fun decodeReviewSelection(value: String): ReviewSelection? =
  if (value.isEmpty()) null else JSONObject(value).let { ReviewSelection(if (it.has("side")) it.getString("side") else null, it.getInt("startLine"), it.getInt("endLine")) }
