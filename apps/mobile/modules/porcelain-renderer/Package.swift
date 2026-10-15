// swift-tools-version: 6.0
import PackageDescription

// Run the observable selection owner without Expo or a simulator: swift test --package-path apps/mobile/modules/porcelain-renderer.
let package = Package(
  name: "CodeSelection",
  platforms: [.macOS(.v15)],
  targets: [
    .target(name: "CodeSelection", path: "ios", sources: ["CodeData.swift", "CodeState.swift", "RenderTokens.swift"]),
    .testTarget(name: "CodeSelectionTests", dependencies: ["CodeSelection"], path: "ios", sources: ["CodeSelectionTests.swift"])
  ]
)
