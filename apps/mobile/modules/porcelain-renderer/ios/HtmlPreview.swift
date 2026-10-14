import WebKit

@MainActor
final class HtmlPreview: NSObject, WKNavigationDelegate {
  var onLink: ((String) -> Void)?
  var onError: ((String) -> Void)?
  let webView: WKWebView
  private var ready = false
  private var html = ""
  override init() {
    let configuration = WKWebViewConfiguration()
    configuration.websiteDataStore = .nonPersistent()
    configuration.defaultWebpagePreferences.allowsContentJavaScript = false
    webView = WKWebView(frame: .zero, configuration: configuration)
    super.init()
    webView.navigationDelegate = self
    webView.isOpaque = false
    webView.backgroundColor = .clear
    let rules = """
    [{"trigger":{"url-filter":".*"},"action":{"type":"block"}},
    {"trigger":{"url-filter":"^data:"},"action":{"type":"ignore-previous-rules"}}]
    """
    WKContentRuleListStore.default().compileContentRuleList(forIdentifier: "porcelain-offline-preview", encodedContentRuleList: rules) { [weak self] ruleList, error in
      Task { @MainActor [weak self] in
        guard let self else { return }
        guard let ruleList, error == nil else { self.onError?("The isolated preview could not be initialized."); return }
        self.webView.configuration.userContentController.add(ruleList)
        self.ready = true
        self.load()
      }
    }
  }
  isolated deinit { webView.stopLoading(); webView.navigationDelegate = nil }
  func setTextScale(_ value: CGFloat) { webView.pageZoom = value }
  func setHTML(_ value: String) { html = value; load() }
  private func load() {
    guard ready else { return }
    let policy = "default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"
    webView.loadHTMLString("<meta http-equiv=\"Content-Security-Policy\" content=\"\(policy)\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">" + html, baseURL: nil)
  }
  func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
    if action.navigationType == .other && action.request.url?.absoluteString == "about:blank" { decisionHandler(.allow); return }
    if let url = action.request.url, action.navigationType == .linkActivated { onLink?(url.absoluteString) }
    decisionHandler(.cancel)
  }
  func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { onError?("The preview could not be displayed.") }
}
