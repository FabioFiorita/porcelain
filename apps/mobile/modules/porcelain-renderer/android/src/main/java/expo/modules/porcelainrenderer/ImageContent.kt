package expo.modules.porcelainrenderer

import android.graphics.Bitmap
import androidx.compose.foundation.Image
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.*

@Composable
internal fun ImageContent(image: Bitmap?) {
  var scale by remember(image) { mutableFloatStateOf(1f) }
  var offset by remember(image) { mutableStateOf(Offset.Zero) }
  image?.let { bitmap ->
    Image(bitmap.asImageBitmap(), "Image preview", contentScale = ContentScale.Fit,
      modifier = Modifier.fillMaxSize().graphicsLayer { scaleX = scale; scaleY = scale; translationX = offset.x; translationY = offset.y; clip = true }
        .pointerInput(image) { detectTransformGestures { _, pan, zoom, _ -> scale = (scale * zoom).coerceIn(1f, 8f); offset = if (scale > 1) offset + pan else Offset.Zero } }
        .pointerInput(image) { detectTapGestures(onDoubleTap = { scale = if (scale == 1f) 2f else 1f; offset = Offset.Zero }) }
        .semantics { stateDescription = "Zoom ${(scale * 100).toInt()} percent"; customActions = listOf(
          CustomAccessibilityAction("Zoom in") { scale = (scale * 2).coerceAtMost(8f); true },
          CustomAccessibilityAction("Zoom out") { scale = (scale / 2).coerceAtLeast(1f); if (scale == 1f) offset = Offset.Zero; true },
          CustomAccessibilityAction("Reset zoom") { scale = 1f; offset = Offset.Zero; true }
        ) })
  }
}
