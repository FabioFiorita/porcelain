import ExpoModulesCore

public class PorcelainRowCanvasModule: Module {
  public func definition() -> ModuleDefinition {
    Name("PorcelainRowCanvas")

    View(PorcelainRowCanvasView.self) {
      Prop("contentKey") { (view: PorcelainRowCanvasView, contentKey: String) in
        view.setContentKey(contentKey)
      }

      Prop("tokensResetKey") { (view: PorcelainRowCanvasView, tokensResetKey: String) in
        view.setTokensResetKey(tokensResetKey)
      }

      Prop("themeJson") { (view: PorcelainRowCanvasView, themeJson: String) in
        view.setThemeJson(themeJson)
      }

      Prop("stateJson") { (view: PorcelainRowCanvasView, stateJson: String) in
        view.setStateJson(stateJson)
      }

      Prop("refreshEnabled") { (view: PorcelainRowCanvasView, refreshEnabled: Bool) in
        view.setRefreshEnabled(refreshEnabled)
      }

      Prop("refreshing") { (view: PorcelainRowCanvasView, refreshing: Bool) in
        view.setRefreshing(refreshing)
      }

      Events("onVisibleRange", "onRowPress", "onRowLongPress", "onRefresh")

      AsyncFunction("setRowsJson") { (view: PorcelainRowCanvasView, rowsJson: String) in
        view.setRowsJson(rowsJson)
      }

      AsyncFunction("setTokensPatchJson") { (view: PorcelainRowCanvasView, tokensPatchJson: String) in
        view.setTokensPatchJson(tokensPatchJson)
      }

      AsyncFunction("scrollToRow") { (view: PorcelainRowCanvasView, rowId: String, animated: Bool) in
        view.scrollToRow(rowId, animated: animated)
      }

      AsyncFunction("scrollToTop") { (view: PorcelainRowCanvasView, animated: Bool) in
        view.scrollToTop(animated: animated)
      }
    }
  }
}
