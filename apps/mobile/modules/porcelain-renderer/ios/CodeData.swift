import Foundation

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

  static func decode(_ value: String) -> [CodeLine] {
    (try? JSONDecoder().decode([CodeLine].self, from: Data(value.utf8))) ?? []
  }
  func location(preferredSide: String? = nil) -> CodeLocation? {
    if kind == "gap" { return nil }
    if kind == "removed" { return oldLine.map { CodeLocation(side: "deletions", line: $0) } }
    if kind == "added" { return newLine.map { CodeLocation(side: "additions", line: $0) } }
    if let oldLine {
      if preferredSide == "deletions" || newLine == nil { return CodeLocation(side: "deletions", line: oldLine) }
      return newLine.map { CodeLocation(side: "additions", line: $0) }
    }
    return newLine.map { CodeLocation(side: nil, line: $0) }
  }
}
struct ReviewSelection: Decodable, Equatable {
  var side: String?
  var startLine: Int
  var endLine: Int

  static func decode(_ value: String) -> ReviewSelection? {
    value.isEmpty ? nil : try? JSONDecoder().decode(ReviewSelection.self, from: Data(value.utf8))
  }
}
struct CodeLocation {
  let side: String?
  let line: Int
}
