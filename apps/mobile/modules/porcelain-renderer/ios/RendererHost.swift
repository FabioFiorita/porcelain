import ExpoModulesCore
import SwiftUI

extension ExpoView {
  func mount<Content: View>(_ content: Content) -> UIHostingController<Content> {
    let controller = UIHostingController(rootView: content)
    controller.view.backgroundColor = .clear
    controller.view.translatesAutoresizingMaskIntoConstraints = false
    addSubview(controller.view)
    NSLayoutConstraint.activate([
      controller.view.leadingAnchor.constraint(equalTo: leadingAnchor),
      controller.view.trailingAnchor.constraint(equalTo: trailingAnchor),
      controller.view.topAnchor.constraint(equalTo: topAnchor),
      controller.view.bottomAnchor.constraint(equalTo: bottomAnchor)
    ])
    return controller
  }
}
