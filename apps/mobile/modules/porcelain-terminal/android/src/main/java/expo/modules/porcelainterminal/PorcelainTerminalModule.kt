package expo.modules.porcelainterminal

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class PorcelainTerminalModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("PorcelainTerminalSurface")

    // Bumped when native hardware-keyboard handling changes; surfaced in the JS debug
    // logs so a stale native binary is distinguishable from a broken key pipeline.
    Constants(
      "hardwareKeyRevision" to 3,
    )

    View(PorcelainTerminalView::class) {
      Prop("terminalKey") { view: PorcelainTerminalView, terminalKey: String ->
        view.terminalKey = terminalKey
      }

      Prop("initialBuffer") { view: PorcelainTerminalView, initialBuffer: String ->
        view.initialBuffer = initialBuffer
      }

      Prop("fontSize") { view: PorcelainTerminalView, fontSize: Double ->
        view.fontSize = fontSize.toFloat()
      }

      Prop("focusRequest") { view: PorcelainTerminalView, focusRequest: Double ->
        view.focusRequest = focusRequest
      }

      Prop("scrollLines") { view: PorcelainTerminalView, scrollLines: Int ->
        view.scrollLines = scrollLines
      }

      Prop("scrollRequest") { view: PorcelainTerminalView, scrollRequest: Double ->
        view.scrollRequest = scrollRequest
      }

      Prop("autoFocus") { view: PorcelainTerminalView, autoFocus: Boolean ->
        view.autoFocus = autoFocus
      }

      Prop("appearanceScheme") { view: PorcelainTerminalView, appearanceScheme: String ->
        view.appearanceScheme = appearanceScheme
      }

      Prop("themeConfig") { view: PorcelainTerminalView, themeConfig: String ->
        view.themeConfig = themeConfig
      }

      Prop("backgroundColor") { view: PorcelainTerminalView, backgroundColor: String ->
        view.backgroundColorHex = backgroundColor
      }

      Prop("foregroundColor") { view: PorcelainTerminalView, foregroundColor: String ->
        view.foregroundColorHex = foregroundColor
      }

      Prop("mutedForegroundColor") { view: PorcelainTerminalView, mutedForegroundColor: String ->
        view.mutedForegroundColorHex = mutedForegroundColor
      }

      Events("onInput", "onResize", "onScroll", "onKey")

      OnViewDestroys { view: PorcelainTerminalView ->
        view.cleanup()
      }
    }
  }
}
