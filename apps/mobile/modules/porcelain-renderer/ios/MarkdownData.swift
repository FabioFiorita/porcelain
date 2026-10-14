import Foundation

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

  static func decode(_ value: String) -> [MarkdownBlock] {
    (try? JSONDecoder().decode([MarkdownBlock].self, from: Data(value.utf8))) ?? []
  }
}
