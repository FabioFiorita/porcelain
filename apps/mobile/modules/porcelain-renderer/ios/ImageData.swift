import UIKit

func decodeImage(_ base64: String) -> UIImage? {
  Data(base64Encoded: base64).flatMap(UIImage.init(data:))
}
