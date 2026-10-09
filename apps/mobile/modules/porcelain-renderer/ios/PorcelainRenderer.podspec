Pod::Spec.new do |s|
  s.name = 'PorcelainRenderer'
  s.version = '1.0.0'
  s.summary = 'Read-only mobile file rendering primitives'
  s.description = 'SwiftUI code and diff rendering with review selection and isolated file previews.'
  s.author = 'Porcelain'
  s.homepage = 'https://github.com/porcelain'
  s.license = { :type => 'MIT' }
  s.platforms = { :ios => '26.0' }
  s.source = { :git => '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.{h,m,mm,swift}'
end
