package expo.modules.porcelainrenderer

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.util.Base64
import androidx.exifinterface.media.ExifInterface
import java.io.ByteArrayInputStream
import java.io.IOException

internal fun decodeImage(value: String, target: Int): Bitmap? = try {
  decodeImage(Base64.decode(value, Base64.DEFAULT), target)
} catch (_: IllegalArgumentException) { null }

internal fun decodeImage(bytes: ByteArray, target: Int): Bitmap? {
  val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
  BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
  var sample = 1
  while (maxOf(bounds.outWidth, bounds.outHeight) / sample > target) sample *= 2
  val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size, BitmapFactory.Options().apply { inSampleSize = sample }) ?: return null
  val exif = try { ExifInterface(ByteArrayInputStream(bytes)) } catch (_: IOException) { null }
  val transform = Matrix().apply {
    if (exif?.isFlipped == true) postScale(-1f, 1f)
    postRotate((exif?.rotationDegrees ?: 0).toFloat())
  }
  if (transform.isIdentity) return bitmap
  val oriented = Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, transform, true)
  if (oriented !== bitmap) bitmap.recycle()
  return oriented
}
