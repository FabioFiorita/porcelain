import type { ExpoConfig } from 'expo/config'

import packageJson from './package.json'

type AppVariant = 'development' | 'production'

type Variant = {
  androidPackage: string
  bundleIdentifier: string
  icon: string
  name: string
  scheme: string
  splashIcon: string
}

/**
 * One binary identity per variant, selected by `APP_VARIANT` (set per profile in eas.json).
 *
 * A distinct bundle identifier / Android application id is what lets the dev client and the
 * released app sit side by side on one device instead of replacing each other. The development
 * identity never ships to either store.
 *
 * `production` must stay byte-identical to what shipped: every string here feeds the native
 * fingerprint, and changing one strands the installed app on an unreachable runtime version.
 */
const VARIANTS: Record<AppVariant, Variant> = {
  development: {
    androidPackage: 'com.fabiofiorita.porcelain.dev',
    bundleIdentifier: 'com.fabiofiorita.porcelain.dev',
    icon: './assets/images/icon-dev.png',
    name: 'Porcelain Dev',
    scheme: 'porcelain-dev',
    splashIcon: './assets/images/icon-dev.png',
  },
  production: {
    androidPackage: 'com.fabiofiorita.porcelain',
    bundleIdentifier: 'com.fabiofiorita.porcelain',
    icon: './assets/images/icon.png',
    name: 'Porcelain',
    scheme: 'porcelain',
    splashIcon: './assets/images/splash-icon.png',
  },
}

function resolveVariant(value: string | undefined): AppVariant {
  return value === 'development' ? 'development' : 'production'
}

const variant = VARIANTS[resolveVariant(process.env.APP_VARIANT)]

const config: ExpoConfig = {
  name: variant.name,
  slug: 'porcelain',
  // Same product version as every workspace package (scripts/sync-versions.mjs).
  version: packageJson.version,
  orientation: 'default',
  icon: variant.icon,
  scheme: variant.scheme,
  userInterfaceStyle: 'automatic',
  platforms: ['ios', 'android'],
  android: {
    package: variant.androidPackage,
    adaptiveIcon: {
      backgroundColor: '#090B0C',
      foregroundImage: variant.icon,
    },
    predictiveBackGestureEnabled: false,
    softwareKeyboardLayoutMode: 'resize',
  },
  ios: {
    bundleIdentifier: variant.bundleIdentifier,
    // Product targets iOS 26+ (SplitView inspector, liquid glass tab chrome). No older guards.
    deploymentTarget: '26.0',
    supportsTablet: true,
    infoPlist: {
      NSAppTransportSecurity: {
        NSAllowsArbitraryLoads: true,
      },
      NSLocalNetworkUsageDescription:
        'Porcelain talks to your daemon over the local network or Tailscale, usually at a plain http address.',
      ITSAppUsesNonExemptEncryption: false,
      LSMinimumSystemVersion: '26.0',
    },
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#090B0C',
        image: variant.splashIcon,
        imageWidth: 76,
      },
    ],
    'expo-secure-store',
    [
      // The terminal's face, embedded at build time rather than fetched at runtime: a shell is
      // often the first thing on screen after a cold start, and a terminal that repaints its
      // grid when a font arrives late is a terminal that visibly reflows under you.
      //
      // GeistMono Nerd Font MONO — the Mono variant specifically, because its glyphs are
      // single-cell and align to the grid; the proportional variants render powerline glyphs
      // double-width and shear every column after them. It carries the Nerd Font glyphs INSIDE
      // the same face as the text, so prompts, devicons and powerline fills all come from one
      // metric. Geist Mono is also what the desktop client renders with, so one PTY reads the
      // same on both.
      'expo-font',
      {
        fonts: [
          './assets/fonts/GeistMonoNerdFontMono-Regular.otf',
          './assets/fonts/GeistMonoNerdFontMono-Bold.otf',
        ],
      },
    ],
    [
      'expo-build-properties',
      {
        android: {
          // The daemon's opt-in LAN/Tailscale listener intentionally serves cleartext HTTP.
          usesCleartextTraffic: true,
        },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  runtimeVersion: {
    policy: 'fingerprint',
  },
  extra: {
    router: {},
    eas: {
      projectId: 'e14cdaa2-be46-4c7e-8554-432e5f386871',
    },
  },
  owner: 'fabiofiorita',
  updates: {
    url: 'https://u.expo.dev/e14cdaa2-be46-4c7e-8554-432e5f386871',
  },
}

export default config
