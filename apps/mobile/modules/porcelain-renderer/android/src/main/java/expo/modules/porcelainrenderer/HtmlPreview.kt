package expo.modules.porcelainrenderer

import android.content.Context
import android.webkit.*
import java.io.ByteArrayInputStream

internal class HtmlPreview(context: Context, private val onLink: (String) -> Unit, private val onError: (String) -> Unit) {
  val webView = WebView(context)
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
        if (request.hasGesture() && request.isForMainFrame) onLink(request.url.toString())
        return true
      }
      override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
        if (request.url.scheme == "data" || request.url.toString() == "about:blank") return null
        return WebResourceResponse("text/plain", "UTF-8", 403, "Blocked", emptyMap(), ByteArrayInputStream(ByteArray(0)))
      }
      override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
        if (request.isForMainFrame) onError("The preview could not be displayed.")
      }
    }
  }
  fun setHTML(value: String) {
    val policy = "default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"
    webView.loadDataWithBaseURL("about:blank", "<meta http-equiv=\"Content-Security-Policy\" content=\"$policy\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">$value", "text/html", "UTF-8", null)
  }
  fun destroy() { webView.stopLoading(); webView.destroy() }
  fun setTextScale(value: Double) { webView.settings.textZoom = (value * 100).toInt() }
}
