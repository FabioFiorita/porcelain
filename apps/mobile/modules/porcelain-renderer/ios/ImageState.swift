import Observation
import UIKit

@MainActor
@Observable
final class ImageState {
  private(set) var image: UIImage?
  func decode(_ base64: String) -> Bool {
    image = decodeImage(base64)
    return image != nil
  }
}
