package expo.modules.porcelainrenderer

import android.content.Context
import android.webkit.*
import java.io.ByteArrayInputStream
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView

class HtmlSurface(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  val onLink by EventDispatcher()
  val onError by EventDispatcher()
  private val webView = WebView(context)
  init {
    webView.settings.apply {
      javaScriptEnabled = false
      domStorageEnabled = false
      allowFileAccess = false
      allowContentAccess = false
      blockNetworkLoads = true
      mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
      setSupportMultipleWindows(false)
    }
    webView.webViewClient = object : WebViewClient() {
      override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
        if (request.hasGesture() && request.isForMainFrame && isPreviewLink(request.url.toString())) onLink(mapOf("url" to request.url.toString()))
        return true
      }
      override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
        if (request.url.scheme == "data" || request.url.toString() == "about:blank") return null
        return WebResourceResponse("text/plain", "UTF-8", 403, "Blocked", emptyMap(), ByteArrayInputStream(ByteArray(0)))
      }
      override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
        if (request.isForMainFrame) onError(mapOf("message" to "The preview could not be displayed."))
      }
    }
    addView(webView, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
  }
  fun setHTML(value: String) {
    val policy = "default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"
    webView.loadDataWithBaseURL("about:blank", "<meta http-equiv=\"Content-Security-Policy\" content=\"$policy\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">$value", "text/html", "UTF-8", null)
  }
  fun destroy() { webView.stopLoading(); removeView(webView); webView.destroy() }
  override fun onDetachedFromWindow() { webView.stopLoading(); super.onDetachedFromWindow() }
}
