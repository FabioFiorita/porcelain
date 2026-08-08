require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name = 'PorcelainTerminalNative'
  s.version = package['version']
  s.summary = 'Ghostty-backed terminal surface for Porcelain mobile.'
  s.description = 'The isolated native terminal canvas used by the Porcelain React Native client.'
  s.homepage = 'https://github.com/FabioFiorita/porcelain'
  s.license = { :type => 'MIT' }
  s.author = { 'Porcelain contributors' => 'https://github.com/FabioFiorita/porcelain' }
  s.platforms = { :ios => '16.1' }
  s.source = { :path => '.' }
  s.source_files = 'ios/**/*.{h,m,mm,swift}'
  s.vendored_frameworks = 'Vendor/libghostty/GhosttyKit.xcframework'
  # Ghostty currently ships an arm64 simulator slice. Both the pod's XCFramework
  # copy phase and the app target must choose that slice rather than requesting a
  # nonexistent x86_64 variant.
  simulator_arch_config = { 'EXCLUDED_ARCHS[sdk=iphonesimulator*]' => 'x86_64' }
  s.pod_target_xcconfig = simulator_arch_config
  s.user_target_xcconfig = simulator_arch_config
  s.frameworks = 'IOSurface', 'Metal', 'MetalKit', 'QuartzCore', 'UIKit'
  s.libraries = 'c++', 'z'
  s.swift_version = '5.9'
  s.dependency 'ExpoModulesCore'
end
