#if SWIFT_PACKAGE
import Testing
@testable import KeyCommands

struct KeyCommandPlanTests {
  let json = """
  [{"id":"back","title":"Back","group":"Go","input":"[","modifiers":["command"],"whileTyping":true},
   {"id":"next","title":"Next","group":"List","input":"down","modifiers":[],"whileTyping":false},
   {"id":"settings","title":"Settings","group":"Go","input":",","modifiers":["command"],"whileTyping":true}]
  """

  @Test func decodesTheCommandsJavaScriptSends() {
    let specs = KeyCommandPlan.decode(json)
    #expect(specs.map(\.id) == ["back", "next", "settings"])
    #expect(specs[1] == KeyCommandSpec(id: "next", title: "Next", group: "List", input: "down", modifiers: [], whileTyping: false))
  }

  @Test func unreadablePayloadClearsTheMenu() {
    #expect(KeyCommandPlan.decode("not json").isEmpty)
  }

  @Test func groupsKeepTheOrderTheyFirstAppearIn() {
    let groups = KeyCommandPlan.groups(KeyCommandPlan.decode(json), typing: false)
    #expect(groups.map(\.title) == ["Go", "List"])
    #expect(groups[0].commands.map(\.id) == ["back", "settings"])
  }

  @Test func typingLeavesOnlyTheCommandsThatFireInATextField() {
    let groups = KeyCommandPlan.groups(KeyCommandPlan.decode(json), typing: true)
    #expect(groups.map(\.title) == ["Go"])
    #expect(groups[0].commands.map(\.id) == ["back", "settings"])
  }
}
#endif
