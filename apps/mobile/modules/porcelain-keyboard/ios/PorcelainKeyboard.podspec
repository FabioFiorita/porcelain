Pod::Spec.new do |s|
  s.name = 'PorcelainKeyboard'
  s.version = '1.0.0'
  s.summary = 'Hardware keyboard shortcuts in the main menu'
  s.description = 'Registers the shortcuts that are live in the app as main menu key commands, so the iPad shows them when Command is held.'
  s.author = 'Porcelain'
  s.homepage = 'https://github.com/porcelain'
  s.license = { :type => 'MIT' }
  s.platforms = { :ios => '26.0' }
  s.source = { :git => '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.{h,m,mm,swift}'
end
