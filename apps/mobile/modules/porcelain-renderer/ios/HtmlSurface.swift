import ExpoModulesCore
import WebKit

final class HtmlSurface: ExpoView, WKNavigationDelegate {
  let onLink = EventDispatcher()
  let onError = EventDispatcher()
  private var webView: WKWebView
  private var ready = false
  private var html = ""
  required init(appContext: AppContext? = nil) {
    let configuration = WKWebViewConfiguration()
    configuration.websiteDataStore = .nonPersistent()
    configuration.defaultWebpagePreferences.allowsContentJavaScript = false
    webView = WKWebView(frame: .zero, configuration: configuration)
    super.init(appContext: appContext)
    webView.navigationDelegate = self
    webView.isOpaque = false
    webView.backgroundColor = .clear
    webView.translatesAutoresizingMaskIntoConstraints = false
    addSubview(webView)
    NSLayoutConstraint.activate([
      webView.leadingAnchor.constraint(equalTo: leadingAnchor), webView.trailingAnchor.constraint(equalTo: trailingAnchor),
      webView.topAnchor.constraint(equalTo: topAnchor), webView.bottomAnchor.constraint(equalTo: bottomAnchor)
    ])
    let rules = """
    [{"trigger":{"url-filter":".*"},"action":{"type":"block"}},
    {"trigger":{"url-filter":"^data:"},"action":{"type":"ignore-previous-rules"}}]
    """
    WKContentRuleListStore.default().compileContentRuleList(forIdentifier: "porcelain-offline-preview", encodedContentRuleList: rules) { [weak self] ruleList, error in
      guard let self else { return }
      guard let ruleList, error == nil else { self.onError(["message": "The isolated preview could not be initialized."]); return }
      self.webView.configuration.userContentController.add(ruleList)
      self.ready = true
      self.load()
    }
  }
  deinit { webView.stopLoading(); webView.navigationDelegate = nil }
  func setHTML(_ value: String) { html = value; load() }
  private func load() {
    guard ready else { return }
    let policy = "default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"
    webView.loadHTMLString("<meta http-equiv=\"Content-Security-Policy\" content=\"\(policy)\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">" + html, baseURL: nil)
  }
  func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
    if action.navigationType == .other && action.request.url?.absoluteString == "about:blank" { decisionHandler(.allow); return }
    if let url = action.request.url, action.navigationType == .linkActivated, isPreviewLink(url) { onLink(["url": url.absoluteString]) }
    decisionHandler(.cancel)
  }
  func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { onError(["message": "The preview could not be displayed."]) }
}
