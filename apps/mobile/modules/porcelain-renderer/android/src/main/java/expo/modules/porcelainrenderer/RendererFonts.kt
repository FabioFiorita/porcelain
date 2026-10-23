package expo.modules.porcelainrenderer

import android.content.Context
import android.graphics.Typeface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.text.font.AndroidFont
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontLoadingStrategy
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import com.facebook.react.common.assets.ReactFontManager

private data class RendererFont(
  val name: String,
  override val weight: FontWeight,
  override val style: FontStyle
) : AndroidFont(FontLoadingStrategy.Blocking, RendererTypefaceLoader, FontVariation.Settings())

private object RendererTypefaceLoader : AndroidFont.TypefaceLoader {
  override fun loadBlocking(context: Context, font: AndroidFont): Typeface {
    val registered = font as RendererFont
    return ReactFontManager.getInstance().getTypeface(registered.name, registered.weight.weight, registered.style == FontStyle.Italic, context.assets)
  }

  override suspend fun awaitLoad(context: Context, font: AndroidFont): Typeface = loadBlocking(context, font)
}

@Composable
internal fun rememberRendererFontFamily(name: String): FontFamily = remember(name) {
  FontFamily((100..900 step 100).flatMap { weight ->
    listOf(FontStyle.Normal, FontStyle.Italic).map { style -> RendererFont(name, FontWeight(weight), style) }
  })
}
