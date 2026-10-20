import 'tsx/cjs';
import { type ExpoConfig } from 'expo/config';

import { buildIdentity } from './src/shared/rules/build-identity.ts';

const identity = buildIdentity(process.env.APP_VARIANT);
const projectId = 'e14cdaa2-be46-4c7e-8554-432e5f386871';

const config: ExpoConfig = {
  name: identity.name,
  slug: 'porcelain',
  owner: 'fabiofiorita',
  version: '1.0.0',
  scheme: identity.scheme,
  platforms: ['ios', 'android'],
  userInterfaceStyle: 'automatic',
  icon: './assets/porcelain.icon/Assets/porcelain-logo.png',
  ios: {
    icon: './assets/porcelain.icon',
    bundleIdentifier: identity.bundleIdentifier,
    supportsTablet: true,
    associatedDomains: ['applinks:porcelain.fabiofiorita.com'],
    infoPlist: {
      NSAppTransportSecurity: { NSAllowsLocalNetworking: true },
      NSLocalNetworkUsageDescription:
        'Connect to your Porcelain environments on the local network.',
    },
  },
  android: {
    package: identity.bundleIdentifier,
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [
          {
            scheme: 'https',
            host: 'porcelain.fabiofiorita.com',
            pathPrefix: '/open',
          },
        ],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-foreground.png',
      monochromeImage: './assets/adaptive-foreground.png',
      backgroundColor: '#f5f5f4',
    },
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    [
      'expo-splash-screen',
      {
        image: './assets/splash.png',
        imageWidth: 192,
        resizeMode: 'contain',
        backgroundColor: '#ffffff',
        dark: {
          image: './assets/splash-dark.png',
          backgroundColor: '#0a0a0a',
        },
      },
    ],
    ['expo-build-properties', { ios: { deploymentTarget: '26.0' } }],
  ],
  experiments: { reactCompiler: true },
  runtimeVersion: { policy: 'fingerprint' },
  updates: {
    url: `https://u.expo.dev/${projectId}`,
    fallbackToCacheTimeout: 0,
  },
  extra: { eas: { projectId } },
};

export default config;
