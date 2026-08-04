const { getDefaultConfig } = require('expo/metro-config')
const { withNativewind } = require('nativewind/metro')

const config = getDefaultConfig(__dirname)

module.exports = withNativewind(config, {
  globalClassNamePolyfill: true,
  inlineRem: 16,
  inlineVariables: false,
  input: './src/global.css',
})
