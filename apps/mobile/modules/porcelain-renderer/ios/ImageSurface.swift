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
    let controller = UIHostingController(rootView: ImageContent(model: model))
    controller.view.backgroundColor = .clear
    controller.view.translatesAutoresizingMaskIntoConstraints = false
    addSubview(controller.view)
    NSLayoutConstraint.activate([
      controller.view.leadingAnchor.constraint(equalTo: leadingAnchor), controller.view.trailingAnchor.constraint(equalTo: trailingAnchor),
      controller.view.topAnchor.constraint(equalTo: topAnchor), controller.view.bottomAnchor.constraint(equalTo: bottomAnchor)
    ])
    host = controller
    model.loaded = { [weak self] success in self?.onLoad(["success": success]) }
  }
}
struct ImageContent: View {
  @ObservedObject var model: ImageModel
  @State private var scale: CGFloat = 1
  @State private var offset = CGSize.zero
  @GestureState private var magnification: CGFloat = 1
  var body: some View {
    GeometryReader { geometry in
      if let image = model.image {
        Image(uiImage: image).resizable().scaledToFit()
          .frame(width: geometry.size.width, height: geometry.size.height)
          .scaleEffect(min(8, max(1, scale * magnification))).offset(offset)
          .gesture(MagnifyGesture().updating($magnification) { value, state, _ in state = value.magnification }.onEnded { value in scale = min(8, max(1, scale * value.magnification)); if scale == 1 { offset = .zero } })
          .simultaneousGesture(DragGesture().onEnded { value in if scale > 1 { offset.width += value.translation.width; offset.height += value.translation.height } })
          .onTapGesture(count: 2) { scale = scale == 1 ? 2 : 1; offset = .zero }
          .accessibilityLabel("Image preview")
          .accessibilityValue("Zoom \(Int(scale * 100)) percent")
          .accessibilityAction(named: "Zoom in") { scale = min(8, scale * 2) }
          .accessibilityAction(named: "Zoom out") { scale = max(1, scale / 2); if scale == 1 { offset = .zero } }
          .accessibilityAction(named: "Reset zoom") { scale = 1; offset = .zero }
      }
    }.clipped().onChange(of: model.image) { scale = 1; offset = .zero }
  }
}
