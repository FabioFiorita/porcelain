import 'tsx/cjs';
import { type ExpoConfig } from 'expo/config';

import { buildIdentity } from './src/shared/rules/build-identity.ts';

const identity = buildIdentity(process.env.APP_VARIANT);

const config: ExpoConfig = {
  name: identity.name,
  slug: 'porcelain',
  owner: 'fabiofiorita',
  version: '1.0.0',
  scheme: identity.scheme,
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: identity.bundleIdentifier,
    supportsTablet: true,
    infoPlist: {
      NSAppTransportSecurity: { NSAllowsLocalNetworking: true },
      NSLocalNetworkUsageDescription:
        'Connect to your Porcelain environments on the local network.',
    },
  },
  android: { package: identity.bundleIdentifier },
  plugins: [
    'expo-router',
    'expo-secure-store',
    ['expo-build-properties', { ios: { deploymentTarget: '26.0' } }],
  ],
  experiments: { reactCompiler: true },
  extra: { eas: { projectId: 'e14cdaa2-be46-4c7e-8554-432e5f386871' } },
};

export default config;
