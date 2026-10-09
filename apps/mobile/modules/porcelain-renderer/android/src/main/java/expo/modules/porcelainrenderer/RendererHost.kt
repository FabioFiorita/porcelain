package expo.modules.porcelainrenderer

import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.platform.ViewCompositionStrategy
import expo.modules.kotlin.views.ExpoView
import org.json.JSONObject

fun ExpoView.mountContent(content: @Composable () -> Unit) {
  addView(ComposeView(context).apply {
    layoutParams = android.view.ViewGroup.LayoutParams(android.view.ViewGroup.LayoutParams.MATCH_PARENT, android.view.ViewGroup.LayoutParams.MATCH_PARENT)
    setViewCompositionStrategy(ViewCompositionStrategy.DisposeOnDetachedFromWindow)
    setContent { MaterialTheme { content() } }
  })
}

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
fun isPreviewLink(value: String): Boolean = android.net.Uri.parse(value).scheme?.lowercase() in listOf("http", "https", "mailto")
