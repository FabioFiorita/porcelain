package expo.modules.porcelainrenderer

import android.graphics.Bitmap
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue

internal class ImageState {
  var image by mutableStateOf<Bitmap?>(null)
    private set

  fun decode(value: String, target: Int): Boolean {
    image = decodeImage(value, target)
    return image != null
  }
}
