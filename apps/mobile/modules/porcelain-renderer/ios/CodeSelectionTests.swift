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

  @Test func delayedEchoFromThePreviousSideKeepsTheNativeAnchor() {
    let state = CodeState()
    _ = state.choose("deletions", 30, reset: false)
    _ = state.choose("additions", 8, reset: false)
    state.select("{\"side\":\"deletions\",\"startLine\":30,\"endLine\":30}")
    #expect(state.choose("additions", 9, reset: false) == ReviewSelection(side: "additions", startLine: 8, endLine: 9))
  }

  @Test func highlightingRefreshKeepsTheSourceAnchor() {
    let state = CodeState()
    state.decode("[{\"id\":\"7\",\"text\":\"let ready = true\",\"newLine\":7},{\"id\":\"9\",\"text\":\"return ready\",\"newLine\":9}]")
    _ = state.choose(nil, 7, reset: false)
    state.decode("[{\"id\":\"7\",\"text\":\"let ready = true\",\"newLine\":7,\"tokens\":[{\"text\":\"let ready = true\",\"color\":255}]},{\"id\":\"9\",\"text\":\"return ready\",\"newLine\":9}]")
    #expect(state.choose(nil, 9, reset: false) == ReviewSelection(side: nil, startLine: 7, endLine: 9))
    // A changed source still ends the old anchor, even if its line numbers match.
    state.decode("[{\"id\":\"7\",\"text\":\"let ready = false\",\"newLine\":7},{\"id\":\"9\",\"text\":\"return ready\",\"newLine\":9}]")
    #expect(state.choose(nil, 9, reset: false) == ReviewSelection(side: nil, startLine: 9, endLine: 9))
  }

  @Test func contextUsesTheActiveSourceSideAndItsActualLineNumber() {
    let state = CodeState()
    let context = CodeLine(id: "context", text: "return ready", oldLine: 9, newLine: 6, kind: "context", tokens: nil)
    let added = CodeLine(id: "added", text: "let ready = true", oldLine: nil, newLine: 8, kind: "added", tokens: nil)
    _ = state.choose("deletions", 7, reset: false)
    #expect(state.location(context)?.side == "deletions")
    #expect(state.location(context)?.line == 9)
    #expect(added.location(preferredSide: "deletions")?.side == "additions")
    _ = state.choose("additions", 8, reset: false)
    state.select("{\"side\":\"deletions\",\"startLine\":7,\"endLine\":7}")
    #expect(state.location(context)?.side == "additions")
    #expect(state.location(context)?.line == 6)
    #expect(context.location(preferredSide: "deletions")?.line == 9)
  }
}
#endif
