const { getDefaultConfig } = require('expo/metro-config');
const { withUniwindConfig } = require('uniwind/metro');

const config = withUniwindConfig(getDefaultConfig(__dirname), {
  cssEntryFile: './src/app.css',
  dtsFile: './src/config/uniwind-types.d.ts',
});

const ownerSocket = process.env.PORCELAIN_OWNER_SOCKET;
const serverAddress = process.env.PORCELAIN_API_TARGET;
if (process.env.NODE_ENV !== 'production' && ownerSocket && serverAddress) {
  const {
    developmentPairing,
  } = require('@porcelain/server/kit/development-pairing');
  const pairing = developmentPairing({
    ownerSocket,
    serverAddress,
    label: 'Development mobile',
    response: 'link',
  });
  const enhance = config.server.enhanceMiddleware;
  config.server.enhanceMiddleware = (middleware, server) => {
    const next = enhance ? enhance(middleware, server) : middleware;
    return (incoming, out, done) =>
      pairing(incoming, out, () => next(incoming, out, done));
  };
}

module.exports = config;
