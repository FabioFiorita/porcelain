package expo.modules.porcelainrenderer

import android.graphics.Typeface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import com.facebook.react.common.assets.ReactFontManager

@Composable
internal fun rememberRendererFontFamily(name: String): FontFamily {
  val assets = LocalContext.current.assets
  return remember(name, assets) {
    FontFamily(ReactFontManager.getInstance().getTypeface(name, Typeface.NORMAL, assets))
  }
}
