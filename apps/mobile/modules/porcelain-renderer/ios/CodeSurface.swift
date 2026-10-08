import ExpoModulesCore
import SwiftUI

struct CodeToken: Decodable {
  var text: String
  var color: UInt32?
  var fontStyle: Int?
  var changed: Bool?
}
struct CodeLine: Decodable, Identifiable {
  var id: String
  var text: String
  var oldLine: Int?
  var newLine: Int?
  var kind: String?
  var tokens: [CodeToken]?
}
struct ReviewSelection: Decodable, Equatable {
  var side: String?
  var startLine: Int
  var endLine: Int
}
final class CodeModel: ObservableObject {
  @Published var lines: [CodeLine] = []
  @Published var selection: ReviewSelection?
  var anchor: Int?
  @Published var wrap = true
  @Published var lineNumbers = true
  @Published var foreground = Color.primary
  @Published var background = Color.clear
  @Published var muted = Color.secondary
  var onSelect: ((String?, Int, Int) -> Void)?
  var onExpand: ((String) -> Void)?
  func decode(_ value: String) {
    lines = (try? JSONDecoder().decode([CodeLine].self, from: Data(value.utf8))) ?? []
    anchor = nil
  }
  // JavaScript owns the selection; clearing it also drops the anchor so the next tap cannot extend a finished range.
  func select(_ value: String) {
    selection = value.isEmpty ? nil : try? JSONDecoder().decode(ReviewSelection.self, from: Data(value.utf8))
    if selection == nil { anchor = nil }
  }
}

// UIKit supplies only the Expo mounting boundary; all drawing and interaction live in SwiftUI.
final class CodeSurface: ExpoView {
  let model = CodeModel()
  let onSelect = EventDispatcher()
  let onExpand = EventDispatcher()
  private var host: UIHostingController<CodeContent>?

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    let controller = UIHostingController(rootView: CodeContent(model: model))
    controller.view.backgroundColor = .clear
    controller.view.translatesAutoresizingMaskIntoConstraints = false
    addSubview(controller.view)
    NSLayoutConstraint.activate([
      controller.view.leadingAnchor.constraint(equalTo: leadingAnchor),
      controller.view.trailingAnchor.constraint(equalTo: trailingAnchor),
      controller.view.topAnchor.constraint(equalTo: topAnchor),
      controller.view.bottomAnchor.constraint(equalTo: bottomAnchor)
    ])
    host = controller
    model.onSelect = { [weak self] side, start, end in
      var range: [String: Any] = ["startLine": start, "endLine": end]
      if let side { range["side"] = side }
      self?.onSelect(range)
    }
    model.onExpand = { [weak self] id in self?.onExpand(["id": id]) }
  }
}

struct CodeContent: View {
  @ObservedObject var model: CodeModel
  private var gutterWidth: CGFloat {
    CGFloat(String(model.lines.compactMap { max($0.oldLine ?? 0, $0.newLine ?? 0) }.max() ?? 1).count) * 8 + 4
  }
  var body: some View {
    ScrollView(model.wrap ? [.vertical] : [.vertical, .horizontal]) {
      LazyVStack(alignment: .leading, spacing: 0) {
        ForEach(model.lines) { line in
          if line.kind == "gap" {
            Button(line.text) { model.onExpand?(line.id) }
              .font(.system(size: 12.5)).foregroundStyle(model.muted).padding(12)
          } else {
            row(line)
          }
        }
      }
      .frame(maxWidth: model.wrap ? .infinity : nil, alignment: .leading)
      .padding(.vertical, 8)
    }
    .background(model.background)
  }
  func row(_ line: CodeLine) -> some View {
    let side: String? = line.kind == "removed" ? "deletions" : line.oldLine != nil || line.kind == "added" ? "additions" : nil
    let number = side == "deletions" ? line.oldLine : line.newLine
    let selected: Bool = {
      guard let selection = model.selection, selection.side == side, let number else { return false }
      return (selection.startLine...selection.endLine).contains(number)
    }()
    return HStack(alignment: .top, spacing: 8) {
      if model.lineNumbers {
        if line.oldLine != nil || line.kind == "added" || line.kind == "removed" {
          Text(line.oldLine.map(String.init) ?? " ").frame(width: gutterWidth, alignment: .leading)
        }
        Text(line.newLine.map(String.init) ?? " ").frame(width: gutterWidth, alignment: .leading)
      }
      if line.kind == "added" || line.kind == "removed" {
        Text(line.kind == "added" ? "+" : "−").frame(width: 12)
      }
      Text(highlight(line)).foregroundStyle(model.foreground)
        .textSelection(.enabled)
        .fixedSize(horizontal: !model.wrap, vertical: true)
        .frame(maxWidth: model.wrap ? .infinity : nil, alignment: .leading)
    }
    .font(.system(size: 13, design: .monospaced))
    .foregroundStyle(model.muted)
    .padding(.horizontal, 8).padding(.vertical, 4)
    .frame(maxWidth: .infinity, alignment: .leading)
    .background(selected ? Color.accentColor.opacity(0.18) : line.kind == "added" ? Color.green.opacity(0.1) : line.kind == "removed" ? Color.red.opacity(0.1) : .clear)
    .contentShape(Rectangle())
    .onLongPressGesture { if let number { select(side, number, reset: true) } }
    .onTapGesture { if model.selection != nil, let number { select(side, number, reset: false) } }
    .accessibilityElement(children: .combine)
    .accessibilityLabel("\(line.kind ?? "code") \(side ?? "file") line \(number ?? 0): \(line.text)")
    .accessibilityAction(named: "Select for review") { if let number { select(side, number, reset: true) } }
    .accessibilityAction(named: "Extend review selection") { if let number { select(side, number, reset: false) } }
    .contextMenu {
      Button("Copy line") { UIPasteboard.general.string = line.text }
      if let number {
        Button("Select for review") { select(side, number, reset: true) }
        Button("Extend review selection") { select(side, number, reset: false) }
      }
    }
  }
  func select(_ side: String?, _ line: Int, reset: Bool) {
    if reset || model.anchor == nil || model.selection?.side != side { model.anchor = line }
    let anchor = model.anchor ?? line
    model.onSelect?(side, min(anchor, line), max(anchor, line))
  }
  func highlight(_ line: CodeLine) -> AttributedString {
    guard let tokens = line.tokens else { return AttributedString(line.text.isEmpty ? " " : line.text) }
    var result = AttributedString()
    for token in tokens {
      var part = AttributedString(token.text)
      part.foregroundColor = model.foreground
      if let color = token.color { part.foregroundColor = Color(red: Double((color >> 16) & 255) / 255, green: Double((color >> 8) & 255) / 255, blue: Double(color & 255) / 255) }
      if let style = token.fontStyle {
        var font = Font.system(size: 13, design: .monospaced)
        if style & 1 != 0 { font = font.italic() }
        if style & 2 != 0 { font = font.bold() }
        part.font = font
        if style & 4 != 0 { part.underlineStyle = .single }
      }
      if token.changed == true { part.backgroundColor = line.kind == "removed" ? .red.opacity(0.2) : .green.opacity(0.2) }
      result += part
    }
    return result
  }
}
