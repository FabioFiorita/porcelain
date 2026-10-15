package expo.modules.porcelainrenderer

import org.json.JSONArray

data class MarkdownRun(val text: String, val bold: Boolean, val italic: Boolean, val code: Boolean, val url: String?)
data class MarkdownBlock(val id: Int, val kind: String, val level: Int, val runs: List<MarkdownRun>)

internal fun decodeMarkdownBlocks(value: String): List<MarkdownBlock> {
  val array = JSONArray(value)
  return (0 until array.length()).map { index ->
    val block = array.getJSONObject(index)
    val runs = block.getJSONArray("runs")
    MarkdownBlock(block.getInt("id"), block.getString("kind"), block.getInt("level"), (0 until runs.length()).map { at ->
      val run = runs.getJSONObject(at)
      MarkdownRun(run.getString("text"), run.optBoolean("bold"), run.optBoolean("italic"), run.optBoolean("code"), if (run.has("url")) run.getString("url") else null)
    })
  }
}
