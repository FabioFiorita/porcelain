import ExpoModulesCore
import SwiftUI

struct MarkdownRun: Decodable {
  var text: String
  var bold: Bool?
  var italic: Bool?
  var code: Bool?
  var url: String?
}
struct MarkdownBlock: Decodable, Identifiable {
  var id: Int
  var kind: String
  var level: Int
  var runs: [MarkdownRun]
}
final class MarkdownModel: ObservableObject {
  @Published var tokens = RenderTokens()
  @Published var blocks: [MarkdownBlock] = []
  var onLink: ((String) -> Void)?
}
final class MarkdownSurface: ExpoView {
  let model = MarkdownModel()
  let onLink = EventDispatcher()
  private var host: UIHostingController<MarkdownContent>?
  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    host = mount(MarkdownContent(model: model))
    model.onLink = { [weak self] url in self?.onLink(["url": url]) }
  }
}
struct MarkdownContent: View {
  @ObservedObject var model: MarkdownModel
  @ScaledMetric(relativeTo: .body) private var textScale: CGFloat = 1
  func fontSize(_ block: MarkdownBlock) -> CGFloat {
    let tokens = model.tokens
    let size = block.kind == "code" ? tokens.codeSize : block.kind == "heading" ? (block.level == 1 ? tokens.headingSize : block.level == 2 ? tokens.subheadingSize : tokens.bodySize) : tokens.bodySize
    return size * textScale
  }
  func text(_ block: MarkdownBlock) -> AttributedString {
    var result = AttributedString()
    for run in block.runs {
      var part = AttributedString(run.text)
      var font = Font.system(size: fontSize(block), design: run.code == true || block.kind == "code" ? .monospaced : .default)
      if run.bold == true || block.kind == "heading" { font = font.bold() }
      if run.italic == true { font = font.italic() }
      part.font = font
      if let value = run.url, let url = URL(string: value) { part.link = url }
      result += part
    }
    return result
  }
  var body: some View {
    ScrollView {
      LazyVStack(alignment: .leading, spacing: model.tokens.pagePadding) {
        ForEach(model.blocks) { block in
          if block.kind == "code" {
            ScrollView(.horizontal) { Text(text(block)).textSelection(.enabled).padding(model.tokens.blockPadding) }
              .background(.secondary.opacity(0.08)).clipShape(RoundedRectangle(cornerRadius: model.tokens.radius))
          } else {
            Text(text(block))
              .foregroundStyle(block.kind == "quote" ? .secondary : .primary)
              .textSelection(.enabled)
              .accessibilityAddTraits(block.kind == "heading" ? .isHeader : [])
          }
        }
      }.frame(maxWidth: .infinity, alignment: .leading).padding(model.tokens.pagePadding)
    }.environment(\.openURL, OpenURLAction { url in
      model.onLink?(url.absoluteString)
      return .handled
    })
  }
}
