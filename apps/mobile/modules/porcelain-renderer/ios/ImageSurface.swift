import ExpoModulesCore
import SwiftUI

@MainActor
final class ImageSurface: ExpoView {
  let model = ImageState()
  let onLoad = EventDispatcher()
  private var host: UIHostingController<ImageContent>?

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    host = mount(ImageContent(model: model))
  }

  func setData(_ value: String) {
    onLoad(["success": model.decode(value)])
  }
}
