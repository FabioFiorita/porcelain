import UIKit

@MainActor
final class KeyCommandMenu {
  static let shared = KeyCommandMenu()
  var onCommand: ((String) -> Void)?
  private var specs: [KeyCommandSpec] = []
  private var typing = false
  private var installed = false

  func update(_ next: [KeyCommandSpec]) {
    install()
    guard next != specs else { return }
    specs = next
    UIMainMenuSystem.shared.setNeedsRebuild()
  }

  func fire(_ id: String) {
    onCommand?(id)
  }

  private func setTyping(_ next: Bool) {
    guard next != typing else { return }
    typing = next
    UIMainMenuSystem.shared.setNeedsRebuild()
  }

  private func install() {
    guard !installed else { return }
    installed = true
    let center = NotificationCenter.default
    // Plain keys belong to the text field while one is edited; only Command shortcuts stay in the menu.
    for name in [UITextField.textDidBeginEditingNotification, UITextView.textDidBeginEditingNotification] {
      _ = center.addObserver(forName: name, object: nil, queue: .main) { [weak self] _ in
        MainActor.assumeIsolated { self?.setTyping(true) }
      }
    }
    for name in [UITextField.textDidEndEditingNotification, UITextView.textDidEndEditingNotification] {
      _ = center.addObserver(forName: name, object: nil, queue: .main) { [weak self] _ in
        MainActor.assumeIsolated { self?.setTyping(false) }
      }
    }
    let configuration = UIMainMenuSystem.Configuration()
    configuration.findingPreference = .removed
    UIMainMenuSystem.shared.setBuildConfiguration(configuration) { [weak self] builder in
      MainActor.assumeIsolated { self?.build(builder) }
    }
  }

  private func build(_ builder: any UIMenuBuilder) {
    builder.remove(menu: .preferences)
    builder.remove(menu: .close)
    for group in KeyCommandPlan.groups(specs, typing: typing) {
      let menu = UIMenu(
        title: group.title,
        identifier: UIMenu.Identifier(rawValue: "com.porcelain.keyboard.\(group.title)"),
        children: group.commands.map(Self.command)
      )
      if builder.menu(for: .window) != nil {
        builder.insertSibling(menu, beforeMenu: .window)
      } else {
        builder.insertChild(menu, atEndOfMenu: .root)
      }
    }
  }

  private static func command(_ spec: KeyCommandSpec) -> UIKeyCommand {
    let command = UIKeyCommand(
      title: spec.title,
      image: nil,
      action: #selector(UIApplication.porcelainKeyCommand(_:)),
      input: input(spec.input),
      modifierFlags: modifiers(spec.modifiers),
      propertyList: spec.id,
      alternates: [],
      discoverabilityTitle: spec.title,
      attributes: [],
      state: .off
    )
    command.wantsPriorityOverSystemBehavior = true
    return command
  }

  private static func input(_ name: String) -> String {
    switch name {
    case "up": UIKeyCommand.inputUpArrow
    case "down": UIKeyCommand.inputDownArrow
    case "left": UIKeyCommand.inputLeftArrow
    case "right": UIKeyCommand.inputRightArrow
    case "escape": UIKeyCommand.inputEscape
    case "return": "\r"
    case "tab": "\t"
    case "space": " "
    default: name
    }
  }

  private static func modifiers(_ names: [String]) -> UIKeyModifierFlags {
    names.reduce(into: UIKeyModifierFlags()) { flags, name in
      switch name {
      case "command": flags.insert(.command)
      case "shift": flags.insert(.shift)
      case "option": flags.insert(.alternate)
      case "control": flags.insert(.control)
      default: break
      }
    }
  }
}

extension UIApplication {
  // The application ends every responder chain, so a main menu command reaches it whatever holds focus.
  @objc func porcelainKeyCommand(_ sender: UIKeyCommand) {
    guard let id = sender.propertyList as? String else { return }
    KeyCommandMenu.shared.fire(id)
  }
}
