package expo.modules.porcelainrenderer

import org.json.JSONObject

// Unscaled design tokens: Compose applies the user's font scale through sp.
data class RenderTokens(
  val codeSize: Float = 0f, val captionSize: Float = 0f, val bodySize: Float = 0f,
  val headingSize: Float = 0f, val subheadingSize: Float = 0f,
  val spacing: Float = 0f, val inset: Float = 0f, val blockPadding: Float = 0f,
  val pagePadding: Float = 0f, val radius: Float = 0f
) {
  companion object {
    fun decode(value: String): RenderTokens = JSONObject(value).let {
      RenderTokens(it.getDouble("codeSize").toFloat(), it.getDouble("captionSize").toFloat(), it.getDouble("bodySize").toFloat(),
        it.getDouble("headingSize").toFloat(), it.getDouble("subheadingSize").toFloat(),
        it.getDouble("spacing").toFloat(), it.getDouble("inset").toFloat(), it.getDouble("blockPadding").toFloat(),
        it.getDouble("pagePadding").toFloat(), it.getDouble("radius").toFloat())
    }
  }
}
