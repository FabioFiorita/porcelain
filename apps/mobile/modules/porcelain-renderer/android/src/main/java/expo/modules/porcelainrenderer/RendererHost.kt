package expo.modules.porcelainrenderer

import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import android.content.Context
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ComposableScope
import expo.modules.kotlin.views.ComposeProps
import expo.modules.kotlin.views.ExpoComposeView

abstract class RendererHost(context: Context, appContext: AppContext) :
  ExpoComposeView<ComposeProps>(context, appContext, withHostingView = true) {
  @Composable
  final override fun ComposableScope.Content() {
    MaterialTheme { RenderContent() }
  }

  @Composable
  protected abstract fun RenderContent()
}
