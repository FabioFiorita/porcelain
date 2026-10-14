package expo.modules.porcelainrenderer

import android.content.Context
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView

class HtmlSurface(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  val onLink by EventDispatcher()
  val onError by EventDispatcher()
  private val preview = HtmlPreview(context,
    { url -> onLink(mapOf("url" to url)) },
    { message -> onError(mapOf("message" to message)) })

  init { addView(preview.webView, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)) }

  fun setHTML(value: String) { preview.setHTML(value) }
  fun setTextScale(value: Double) { preview.setTextScale(value) }
  fun destroy() { removeView(preview.webView); preview.destroy() }
}
