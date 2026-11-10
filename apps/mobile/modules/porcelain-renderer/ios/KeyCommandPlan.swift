import Foundation

struct KeyCommandSpec: Decodable, Equatable {
  let id: String
  let title: String
  let group: String
  let input: String
  let modifiers: [String]
  let whileTyping: Bool
}

struct KeyCommandGroup: Equatable {
  let title: String
  let commands: [KeyCommandSpec]
}

enum KeyCommandPlan {
  static func decode(_ json: String) -> [KeyCommandSpec] {
    guard let data = json.data(using: .utf8),
          let specs = try? JSONDecoder().decode([KeyCommandSpec].self, from: data)
    else { return [] }
    return specs
  }

  static func groups(_ specs: [KeyCommandSpec], typing: Bool) -> [KeyCommandGroup] {
    var order: [String] = []
    var members: [String: [KeyCommandSpec]] = [:]
    for spec in specs where !typing || spec.whileTyping {
      if members[spec.group] == nil { order.append(spec.group) }
      members[spec.group, default: []].append(spec)
    }
    return order.map { KeyCommandGroup(title: $0, commands: members[$0] ?? []) }
  }
}
