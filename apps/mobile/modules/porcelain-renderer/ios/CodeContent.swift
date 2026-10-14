import SwiftUI

struct CodeContent: View {
  @Bindable var model: CodeState
  let choose: (String?, Int, Bool) -> Void
  let expand: (String) -> Void
  let copy: (String) -> Void
  @Environment(\.fontResolutionContext) private var fontContext
  @ScaledMetric(relativeTo: .body) private var textScale: CGFloat = 1
  private var codeSize: CGFloat { model.tokens.codeSize * textScale }
  private var codeFont: Font { .system(size: codeSize, design: .monospaced) }
  private var captionFont: Font { .system(size: model.tokens.captionSize * textScale) }
  var body: some View {
    let gutterWidth = textWidth(AttributedString(String(repeating: "0", count: model.gutterDigits)), fallbackFont: codeFont) + model.tokens.inset
    GeometryReader { viewport in
      // A lazy stack takes its ideal width from its first row, which can be much shorter than a later code line.
      let contentWidth = model.wrap ? viewport.size.width : model.lines.reduce(viewport.size.width) { width, line in
        max(width, rowWidth(line, gutterWidth: gutterWidth))
      }
      ScrollView(model.wrap ? [.vertical] : [.vertical, .horizontal]) {
        LazyVStack(alignment: .leading, spacing: 0) {
          ForEach(model.lines) { line in
            if line.kind == "gap" {
              Button(line.text) { expand(line.id) }
                .font(captionFont).foregroundStyle(model.muted).padding(model.tokens.blockPadding)
                .buttonStyle(.glass)
            } else {
              row(line, gutterWidth: gutterWidth)
            }
          }
        }
        .frame(width: contentWidth, alignment: .leading)
        .padding(.vertical, model.tokens.spacing)
      }
    }
    .background(model.background)
  }
  private func textWidth(_ text: AttributedString, fallbackFont: Font) -> CGFloat {
    let measured = NSMutableAttributedString(string: "")
    for run in text.runs {
      let font = (run.font ?? fallbackFont).resolve(in: fontContext).ctFont
      measured.append(NSAttributedString(string: String(text[run.range].characters), attributes: [.font: font as UIFont]))
    }
    return ceil(measured.size().width)
  }
  private func rowWidth(_ line: CodeLine, gutterWidth: CGFloat) -> CGFloat {
    if line.kind == "gap" {
      return textWidth(AttributedString(line.text), fallbackFont: captionFont) + 2 * model.tokens.blockPadding
    }
    let marker = line.kind == "added" || line.kind == "removed"
    let gutters = model.lineNumbers ? (line.oldLine != nil || marker ? 2 : 1) : 0
    let gaps = gutters + (marker ? 1 : 0)
    return textWidth(highlight(line), fallbackFont: codeFont)
      + CGFloat(gutters) * gutterWidth
      + (marker ? codeSize : 0)
      + CGFloat(gaps) * model.tokens.spacing
      + 2 * model.tokens.spacing
  }
  func row(_ line: CodeLine, gutterWidth: CGFloat) -> some View {
    let side: String? = line.kind == "removed" ? "deletions" : line.oldLine != nil || line.kind == "added" ? "additions" : nil
    let number = side == "deletions" ? line.oldLine : line.newLine
    let selected: Bool = {
      guard let selection = model.selection, selection.side == side, let number else { return false }
      return (selection.startLine...selection.endLine).contains(number)
    }()
    return HStack(alignment: .top, spacing: model.tokens.spacing) {
      if model.lineNumbers {
        if line.oldLine != nil || line.kind == "added" || line.kind == "removed" {
          Text(line.oldLine.map(String.init) ?? " ").frame(width: gutterWidth, alignment: .leading)
        }
        Text(line.newLine.map(String.init) ?? " ").frame(width: gutterWidth, alignment: .leading)
      }
      if line.kind == "added" || line.kind == "removed" {
        Text(line.kind == "added" ? "+" : "−").frame(width: codeSize)
      }
      Text(highlight(line)).foregroundStyle(model.foreground)
        .textSelection(.enabled)
        .fixedSize(horizontal: !model.wrap, vertical: true)
        .frame(maxWidth: model.wrap ? .infinity : nil, alignment: .leading)
    }
    .font(codeFont)
    .foregroundStyle(model.muted)
    .padding(.horizontal, model.tokens.spacing).padding(.vertical, model.tokens.inset)
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
      Button("Copy line") { copy(line.text) }
      if let number {
        Button("Select for review") { select(side, number, reset: true) }
        Button("Extend review selection") { select(side, number, reset: false) }
      }
    }
  }
  func select(_ side: String?, _ line: Int, reset: Bool) {
    choose(side, line, reset)
  }
  func highlight(_ line: CodeLine) -> AttributedString {
    guard let tokens = line.tokens else { return AttributedString(line.text.isEmpty ? " " : line.text) }
    var result = AttributedString()
    for token in tokens {
      var part = AttributedString(token.text)
      part.foregroundColor = model.foreground
      if let color = token.color { part.foregroundColor = Color(red: Double((color >> 16) & 255) / 255, green: Double((color >> 8) & 255) / 255, blue: Double(color & 255) / 255) }
      if let style = token.fontStyle {
        var font = codeFont
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
