import ExpoModulesCore
import WebKit

@MainActor
final class HtmlSurface: ExpoView {
  let onLink = EventDispatcher()
  let onError = EventDispatcher()
  private let preview = HtmlPreview()

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    let webView = preview.webView
    webView.translatesAutoresizingMaskIntoConstraints = false
    addSubview(webView)
    NSLayoutConstraint.activate([
      webView.leadingAnchor.constraint(equalTo: leadingAnchor), webView.trailingAnchor.constraint(equalTo: trailingAnchor),
      webView.topAnchor.constraint(equalTo: topAnchor), webView.bottomAnchor.constraint(equalTo: bottomAnchor)
    ])
    preview.onLink = { [weak self] url in self?.onLink(["url": url]) }
    preview.onError = { [weak self] message in self?.onError(["message": message]) }
  }

  func setTextScale(_ value: CGFloat) { preview.setTextScale(value) }
  func setHTML(_ value: String) { preview.setHTML(value) }
}
