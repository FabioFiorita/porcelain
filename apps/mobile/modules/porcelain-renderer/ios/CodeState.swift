import Observation
import SwiftUI

@MainActor
@Observable
final class CodeState {
  var tokens = RenderTokens()
  private(set) var gutterDigits = 1
  private(set) var lines: [CodeLine] = []
  private(set) var selection: ReviewSelection?
  @ObservationIgnored private var anchor: CodeLocation?
  var wrap = true
  var lineNumbers = true
  var selectable = false
  var foreground = Color.primary
  var background = Color.clear
  var muted = Color.secondary
  func decode(_ value: String) {
    let next = CodeLine.decode(value)
    // Token/color updates do not change the source the user tapped.
    if lines.count != next.count || !zip(lines, next).allSatisfy({ before, after in
      before.id == after.id && before.text == after.text && before.oldLine == after.oldLine && before.newLine == after.newLine && before.kind == after.kind
    }) { anchor = nil }
    lines = next
    gutterDigits = String(lines.compactMap { max($0.oldLine ?? 0, $0.newLine ?? 0) }.max() ?? 1).count
  }
  // JavaScript owns the selection; clearing it also drops the anchor so the next tap cannot extend a finished range.
  func select(_ value: String) {
    selection = ReviewSelection.decode(value)
    if selection == nil { anchor = nil }
  }
  func location(_ line: CodeLine) -> CodeLocation? {
    line.location(preferredSide: anchor?.side ?? selection?.side)
  }
  func choose(_ side: String?, _ line: Int, reset: Bool) -> ReviewSelection {
    if reset || anchor == nil || anchor?.side != side { anchor = CodeLocation(side: side, line: line) }
    let start = anchor?.line ?? line
    let range = ReviewSelection(side: side, startLine: min(start, line), endLine: max(start, line))
    // A second tap can arrive before the bridge echoes the first selection.
    selection = range
    return range
  }
}
