package expo.modules.porcelainrenderer

import android.content.Context
import android.graphics.BitmapFactory
import android.util.Base64
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
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView

class ImageSurface(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  val onLoad by EventDispatcher()
  private var image by mutableStateOf<android.graphics.Bitmap?>(null)
  init {
    mountContent {
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
  }
  fun decode(value: String) {
    image = try {
      val bytes = Base64.decode(value, Base64.DEFAULT)
      val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
      BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
      // Bound decoded pixels to the device viewport, retaining a 2x zoom budget.
      val target = maxOf(resources.displayMetrics.widthPixels, resources.displayMetrics.heightPixels) * 2
      var sample = 1
      while (maxOf(bounds.outWidth, bounds.outHeight) / sample > target) sample *= 2
      BitmapFactory.decodeByteArray(bytes, 0, bytes.size, BitmapFactory.Options().apply { inSampleSize = sample })
    } catch (_: IllegalArgumentException) { null }
    onLoad(mapOf("success" to (image != null)))
  }
}
