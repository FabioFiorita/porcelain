import ExpoModulesCore

public class PorcelainTerminalModule: Module {
  public func definition() -> ModuleDefinition {
    Name("PorcelainTerminalSurface")

    // Bumped when native hardware-keyboard handling changes; surfaced in the JS debug
    // logs so a stale native binary is distinguishable from a broken key pipeline.
    Constants([
      "hardwareKeyRevision": 4,
    ])

    View(PorcelainTerminalView.self) {
      Prop("terminalKey") { (view: PorcelainTerminalView, terminalKey: String) in
        view.terminalKey = terminalKey
      }

      Prop("initialBuffer") { (view: PorcelainTerminalView, initialBuffer: String) in
        view.initialBuffer = initialBuffer
      }

      Prop("fontSize") { (view: PorcelainTerminalView, fontSize: Double) in
        view.fontSize = CGFloat(fontSize)
      }

      Prop("focusRequest") { (view: PorcelainTerminalView, focusRequest: Double) in
        view.focusRequest = focusRequest
      }

      // Android uses this request pair after JS resolves normal versus alternate-buffer pans.
      // iOS's Ghostty surface already owns its pan recognizer, so these preserve one API shape.
      Prop("scrollLines") { (_: PorcelainTerminalView, _: Int) in }
      Prop("scrollRequest") { (_: PorcelainTerminalView, _: Double) in }

      Prop("autoFocus") { (view: PorcelainTerminalView, autoFocus: Bool) in
        view.autoFocus = autoFocus
      }

      Prop("appearanceScheme") { (view: PorcelainTerminalView, appearanceScheme: String) in
        view.appearanceScheme = appearanceScheme
      }

      Prop("themeConfig") { (view: PorcelainTerminalView, themeConfig: String) in
        view.themeConfig = themeConfig
      }

      Prop("backgroundColor") { (view: PorcelainTerminalView, backgroundColor: String) in
        view.backgroundColorHex = backgroundColor
      }

      Prop("foregroundColor") { (view: PorcelainTerminalView, foregroundColor: String) in
        view.foregroundColorHex = foregroundColor
      }

      Prop("mutedForegroundColor") { (view: PorcelainTerminalView, mutedForegroundColor: String) in
        view.mutedForegroundColorHex = mutedForegroundColor
      }

      Events("onInput", "onResize", "onScroll", "onKey")
    }
  }
}
