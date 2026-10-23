package expo.modules.porcelainrenderer

import androidx.compose.ui.graphics.Color
import org.json.JSONObject

// Unscaled design tokens: Compose applies the user's font scale through sp.
data class RenderTokens(
  val codeSize: Float = 0f, val captionSize: Float = 0f, val bodySize: Float = 0f,
  val headingSize: Float = 0f, val subheadingSize: Float = 0f,
  val spacing: Float = 0f, val inset: Float = 0f, val blockPadding: Float = 0f,
  val pagePadding: Float = 0f, val radius: Float = 0f,
  val foreground: Color = Color.Unspecified, val background: Color = Color.Unspecified,
  val muted: Color = Color.Unspecified, val codeBackground: Color = Color.Unspecified
) {
  companion object {
    fun decode(value: String): RenderTokens = JSONObject(value).let {
      RenderTokens(it.getDouble("codeSize").toFloat(), it.getDouble("captionSize").toFloat(), it.getDouble("bodySize").toFloat(),
        it.getDouble("headingSize").toFloat(), it.getDouble("subheadingSize").toFloat(),
        it.getDouble("spacing").toFloat(), it.getDouble("inset").toFloat(), it.getDouble("blockPadding").toFloat(),
        it.getDouble("pagePadding").toFloat(), it.getDouble("radius").toFloat(),
        Color(it.getLong("foreground").toInt()), Color(it.getLong("background").toInt()),
        Color(it.getLong("muted").toInt()), Color(it.getLong("codeBackground").toInt()))
    }
  }
}
