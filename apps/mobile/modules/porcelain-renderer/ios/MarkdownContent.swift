import SwiftUI

struct MarkdownContent: View {
  @Bindable var model: MarkdownState
  let onLink: (String) -> Void
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
      var font = Font.custom(run.code == true || block.kind == "code" ? "GeistMono-Regular" : "Geist-Regular", fixedSize: fontSize(block))
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
      onLink(url.absoluteString)
      return .handled
    })
  }
}
