package expo.modules.porcelainrenderer

import android.content.Context
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView

class ImageSurface(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  val onLoad by EventDispatcher()
  private val state = ImageState()

  init { mountContent { ImageContent(state.image) } }

  fun decode(value: String) {
    val target = maxOf(resources.displayMetrics.widthPixels, resources.displayMetrics.heightPixels) * 2
    onLoad(mapOf("success" to state.decode(value, target)))
  }
}
