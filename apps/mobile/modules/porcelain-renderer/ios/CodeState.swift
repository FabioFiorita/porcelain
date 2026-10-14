import Observation
import SwiftUI

@MainActor
@Observable
final class CodeState {
  var tokens = RenderTokens()
  private(set) var gutterDigits = 1
  private(set) var lines: [CodeLine] = []
  private(set) var selection: ReviewSelection?
  @ObservationIgnored private var anchor: Int?
  var wrap = true
  var lineNumbers = true
  var foreground = Color.primary
  var background = Color.clear
  var muted = Color.secondary
  func decode(_ value: String) {
    lines = CodeLine.decode(value)
    gutterDigits = String(lines.compactMap { max($0.oldLine ?? 0, $0.newLine ?? 0) }.max() ?? 1).count
    anchor = nil
  }
  // JavaScript owns the selection; clearing it also drops the anchor so the next tap cannot extend a finished range.
  func select(_ value: String) {
    selection = ReviewSelection.decode(value)
    if selection == nil { anchor = nil }
  }
  func choose(_ side: String?, _ line: Int, reset: Bool) -> ReviewSelection {
    if reset || anchor == nil || selection?.side != side { anchor = line }
    let start = anchor ?? line
    return ReviewSelection(side: side, startLine: min(start, line), endLine: max(start, line))
  }
}
