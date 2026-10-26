package expo.modules.porcelainrenderer

import android.content.Context
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import androidx.compose.runtime.Composable

class ImageSurface(context: Context, appContext: AppContext) : RendererHost(context, appContext) {
  val onLoad by EventDispatcher()
  private val state = ImageState()

  @Composable
  override fun RenderContent() { ImageContent(state.image) }

  fun decode(value: String) {
    val target = maxOf(resources.displayMetrics.widthPixels, resources.displayMetrics.heightPixels) * 2
    onLoad(mapOf("success" to state.decode(value, target)))
  }
}
