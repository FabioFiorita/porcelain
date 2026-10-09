import ExpoModulesCore
import SwiftUI
import UIKit

final class ImageModel: ObservableObject {
  @Published var image: UIImage?
  var loaded: ((Bool) -> Void)?
  func decode(_ base64: String) {
    image = Data(base64Encoded: base64).flatMap(UIImage.init(data:))
    loaded?(image != nil)
  }
}
final class ImageSurface: ExpoView {
  let model = ImageModel()
  let onLoad = EventDispatcher()
  private var host: UIHostingController<ImageContent>?
  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    host = mount(ImageContent(model: model))
    model.loaded = { [weak self] success in self?.onLoad(["success": success]) }
  }
}
struct ImageContent: View {
  @ObservedObject var model: ImageModel
  @State private var scale: CGFloat = 1
  @State private var offset = CGSize.zero
  @GestureState private var translation = CGSize.zero
  @GestureState private var magnification: CGFloat = 1
  func clamped(_ value: CGSize, to limit: CGSize) -> CGSize {
    CGSize(width: min(limit.width, max(-limit.width, value.width)), height: min(limit.height, max(-limit.height, value.height)))
  }
  var body: some View {
    GeometryReader { geometry in
      if let image = model.image {
        let zoom = min(8, max(1, scale * magnification))
        let fit = min(geometry.size.width / image.size.width, geometry.size.height / image.size.height)
        let limit = CGSize(width: max(0, (image.size.width * fit * zoom - geometry.size.width) / 2), height: max(0, (image.size.height * fit * zoom - geometry.size.height) / 2))
        let position = clamped(CGSize(width: offset.width + translation.width, height: offset.height + translation.height), to: limit)
        Image(uiImage: image).resizable().scaledToFit()
          .frame(width: geometry.size.width, height: geometry.size.height)
          .scaleEffect(zoom).offset(position)
          .gesture(MagnifyGesture().updating($magnification) { value, state, _ in state = value.magnification }.onEnded { value in scale = min(8, max(1, scale * value.magnification)); offset = clamped(offset, to: limit) })
          .simultaneousGesture(DragGesture().updating($translation) { value, state, _ in if zoom > 1 { state = value.translation } }.onEnded { value in offset = clamped(CGSize(width: offset.width + value.translation.width, height: offset.height + value.translation.height), to: limit) })
          .onTapGesture(count: 2) { scale = scale == 1 ? 2 : 1; offset = .zero }
          .onChange(of: scale) { offset = clamped(offset, to: limit) }
          .accessibilityLabel("Image preview")
          .accessibilityValue("Zoom \(Int(scale * 100)) percent")
          .accessibilityAction(named: "Zoom in") { scale = min(8, scale * 2) }
          .accessibilityAction(named: "Zoom out") { scale = max(1, scale / 2); if scale == 1 { offset = .zero } }
          .accessibilityAction(named: "Reset zoom") { scale = 1; offset = .zero }
      }
    }.clipped().onChange(of: model.image) { scale = 1; offset = .zero }
  }
}
