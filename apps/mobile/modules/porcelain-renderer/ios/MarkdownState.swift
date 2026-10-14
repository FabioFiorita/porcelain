import Observation

@MainActor
@Observable
final class MarkdownState {
  var tokens = RenderTokens()
  private(set) var blocks: [MarkdownBlock] = []

  func decode(_ value: String) {
    blocks = MarkdownBlock.decode(value)
  }
}
