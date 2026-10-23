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
      'expo-font',
      {
        android: {
          fonts: [
            {
              fontFamily: 'Geist',
              fontDefinitions: [
                {
                  path: 'node_modules/@expo-google-fonts/geist/400Regular/Geist_400Regular.ttf',
                  weight: 400,
                },
                {
                  path: 'node_modules/@expo-google-fonts/geist/500Medium/Geist_500Medium.ttf',
                  weight: 500,
                },
                {
                  path: 'node_modules/@expo-google-fonts/geist/600SemiBold/Geist_600SemiBold.ttf',
                  weight: 600,
                },
              ],
            },
            {
              fontFamily: 'Geist Mono',
              fontDefinitions: [
                {
                  path: 'node_modules/@expo-google-fonts/geist-mono/400Regular/GeistMono_400Regular.ttf',
                  weight: 400,
                },
                {
                  path: 'node_modules/@expo-google-fonts/geist-mono/500Medium/GeistMono_500Medium.ttf',
                  weight: 500,
                },
              ],
            },
          ],
        },
        ios: {
          fonts: [
            'node_modules/@expo-google-fonts/geist/400Regular/Geist_400Regular.ttf',
            'node_modules/@expo-google-fonts/geist/500Medium/Geist_500Medium.ttf',
            'node_modules/@expo-google-fonts/geist/600SemiBold/Geist_600SemiBold.ttf',
            'node_modules/@expo-google-fonts/geist-mono/400Regular/GeistMono_400Regular.ttf',
            'node_modules/@expo-google-fonts/geist-mono/500Medium/GeistMono_500Medium.ttf',
          ],
        },
      },
    ],
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
