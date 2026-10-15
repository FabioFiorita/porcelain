#if SWIFT_PACKAGE
import Testing
@testable import CodeSelection

@MainActor
struct CodeSelectionTests {
  @Test func firstTapPublishesOneSourceLineImmediately() {
    let state = CodeState()
    let range = state.choose(nil, 7, reset: false)
    #expect(range == ReviewSelection(side: nil, startLine: 7, endLine: 7))
    #expect(state.selection == range)
  }

  @Test func rapidTapsExtendFromTheOriginalAnchorInEitherDirection() {
    let state = CodeState()
    _ = state.choose("additions", 7, reset: false)
    #expect(state.choose("additions", 10, reset: false) == ReviewSelection(side: "additions", startLine: 7, endLine: 10))
    #expect(state.choose("additions", 4, reset: false) == ReviewSelection(side: "additions", startLine: 4, endLine: 7))
    #expect(state.choose("additions", 7, reset: false) == ReviewSelection(side: "additions", startLine: 7, endLine: 7))
  }

  @Test func oppositeDiffSideStartsItsOwnRange() {
    let state = CodeState()
    _ = state.choose("deletions", 30, reset: false)
    #expect(state.choose("additions", 8, reset: false) == ReviewSelection(side: "additions", startLine: 8, endLine: 8))
    #expect(state.choose("additions", 9, reset: false) == ReviewSelection(side: "additions", startLine: 8, endLine: 9))
  }

  @Test func clearAndBridgeEcho() {
    let state = CodeState()
    _ = state.choose(nil, 7, reset: false)
    state.select("{\"startLine\":7,\"endLine\":7}")
    #expect(state.choose(nil, 9, reset: false).startLine == 7)
    state.select("")
    #expect(state.selection == nil)
    #expect(state.choose(nil, 20, reset: false) == ReviewSelection(side: nil, startLine: 20, endLine: 20))
    #expect(state.choose(nil, 22, reset: true) == ReviewSelection(side: nil, startLine: 22, endLine: 22))
  }
}
#endif
