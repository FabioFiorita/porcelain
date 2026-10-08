import ExpoModulesCore
import SwiftUI

struct MarkdownBlock: Identifiable {
  var id: Int
  var text: String
  var kind: String
  var level: Int = 0
}
func markdownBlocks(_ source: String) -> [MarkdownBlock] {
  var blocks: [MarkdownBlock] = []
  var paragraph: [String] = []
  var code: [String]? = nil
  var fence = ""
  func add(_ text: String, _ kind: String, _ level: Int = 0) { blocks.append(MarkdownBlock(id: blocks.count, text: text, kind: kind, level: level)) }
  func flush() { if !paragraph.isEmpty { add(paragraph.joined(separator: "\n"), "paragraph"); paragraph = [] } }
  for line in source.replacingOccurrences(of: "\r\n", with: "\n").components(separatedBy: "\n") {
    if code != nil {
      if line.hasPrefix(fence) { add(code!.joined(separator: "\n"), "code"); code = nil }
      else { code!.append(line) }
    } else if line.hasPrefix("```") || line.hasPrefix("~~~") {
      flush(); fence = String(line.prefix(3)); code = []
    } else if line.isEmpty { flush() }
    else if let match = line.range(of: "^#{1,6} ", options: .regularExpression) {
      flush(); add(String(line[match.upperBound...]), "heading", line[match].count - 1)
    } else if line.hasPrefix("> ") { flush(); add(String(line.dropFirst(2)), "quote") }
    else if line.hasPrefix("- ") || line.hasPrefix("* ") { flush(); add("• " + line.dropFirst(2), "list") }
    else { paragraph.append(line) }
  }
  flush()
  if let code { add(code.joined(separator: "\n"), "code") }
  return blocks
}
final class MarkdownModel: ObservableObject {
  @Published var blocks: [MarkdownBlock] = []
  var onLink: ((String) -> Void)?
}
final class MarkdownSurface: ExpoView {
  let model = MarkdownModel()
  let onLink = EventDispatcher()
  private var host: UIHostingController<MarkdownContent>?
  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    let controller = UIHostingController(rootView: MarkdownContent(model: model))
    controller.view.backgroundColor = .clear
    controller.view.translatesAutoresizingMaskIntoConstraints = false
    addSubview(controller.view)
    NSLayoutConstraint.activate([
      controller.view.leadingAnchor.constraint(equalTo: leadingAnchor), controller.view.trailingAnchor.constraint(equalTo: trailingAnchor),
      controller.view.topAnchor.constraint(equalTo: topAnchor), controller.view.bottomAnchor.constraint(equalTo: bottomAnchor)
    ])
    host = controller
    model.onLink = { [weak self] url in self?.onLink(["url": url]) }
  }
}
struct MarkdownContent: View {
  @ObservedObject var model: MarkdownModel
  var body: some View {
    ScrollView {
      LazyVStack(alignment: .leading, spacing: 16) {
        ForEach(model.blocks) { block in
          if block.kind == "code" {
            ScrollView(.horizontal) { Text(block.text).font(.system(size: 13, design: .monospaced)).textSelection(.enabled).padding(12) }
              .background(.secondary.opacity(0.08)).clipShape(RoundedRectangle(cornerRadius: 10))
          } else {
            Text((try? AttributedString(markdown: block.text, options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace))) ?? AttributedString(block.text))
              .font(.system(size: block.kind == "heading" ? (block.level == 1 ? 24 : block.level == 2 ? 20 : 16) : 13, weight: block.kind == "heading" ? .semibold : .regular))
              .foregroundStyle(block.kind == "quote" ? .secondary : .primary)
              .textSelection(.enabled)
              .accessibilityAddTraits(block.kind == "heading" ? .isHeader : [])
          }
        }
      }.frame(maxWidth: .infinity, alignment: .leading).padding(16)
    }.environment(\.openURL, OpenURLAction { url in model.onLink?(url.absoluteString); return .handled })
  }
}
