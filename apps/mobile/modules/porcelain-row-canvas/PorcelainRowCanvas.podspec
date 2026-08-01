require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name = 'PorcelainRowCanvas'
  s.version = package['version']
  s.summary = package['description']
  s.description = package['description']
  s.license = 'MIT'
  s.author = 'Porcelain'
  s.homepage = 'https://github.com/FabioFiorita/porcelain'
  s.platforms = { :ios => '16.0' }
  s.source = { :path => '.' }
  s.source_files = 'ios/**/*.swift'
  s.frameworks = 'CoreGraphics', 'UIKit'
  s.swift_version = '5.9'
  s.dependency 'ExpoModulesCore'
end
