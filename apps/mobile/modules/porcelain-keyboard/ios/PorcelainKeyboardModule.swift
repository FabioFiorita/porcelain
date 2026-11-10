import ExpoModulesCore

public class PorcelainKeyboardModule: Module {
  public func definition() -> ModuleDefinition {
    Name("PorcelainKeyboard")
    Events("onCommand")
    // UIKit owns the main menu, so every change runs on the main queue.
    AsyncFunction("setCommands") { (json: String) in
      MainActor.assumeIsolated {
        KeyCommandMenu.shared.onCommand = { [weak self] id in self?.sendEvent("onCommand", ["id": id]) }
        KeyCommandMenu.shared.update(KeyCommandPlan.decode(json))
      }
    }.runOnQueue(.main)
  }
}
