import type { ExpoConfig } from 'expo/config'

import packageJson from './package.json'

type AppVariant = 'development' | 'production'

type Variant = {
  bundleIdentifier: string
  icon: string
  name: string
  scheme: string
  splashIcon: string
}

/**
 * One binary identity per variant, selected by `APP_VARIANT` (set per profile in eas.json).
 *
 * A distinct bundle identifier is what lets the dev client and the released app sit side by
 * side on one device instead of replacing each other. It only creates an App ID in the Apple
 * developer portal — App Store Connect never sees it, so no dev build can disturb TestFlight.
 *
 * `production` must stay byte-identical to what shipped: every string here feeds the native
 * fingerprint, and changing one strands the installed app on an unreachable runtime version.
 */
const VARIANTS: Record<AppVariant, Variant> = {
  development: {
    bundleIdentifier: 'com.fabiofiorita.porcelain.dev',
    icon: './assets/images/icon-dev.png',
    name: 'Porcelain Dev',
    scheme: 'porcelain-dev',
    splashIcon: './assets/images/icon-dev.png',
  },
  production: {
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
  platforms: ['ios'],
  ios: {
    bundleIdentifier: variant.bundleIdentifier,
    supportsTablet: true,
    infoPlist: {
      NSAppTransportSecurity: {
        NSAllowsArbitraryLoads: true,
      },
      NSLocalNetworkUsageDescription:
        'Porcelain talks to your daemon over the local network or Tailscale, usually at a plain http address.',
      ITSAppUsesNonExemptEncryption: false,
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
    'expo-sqlite',
    // Adds the `processing` background mode and `BGTaskSchedulerPermittedIdentifiers`. Needed
    // explicitly — unlike expo-notifications/expo-task-manager, this one is not auto-applied.
    'expo-background-task',
    // Deletes the `aps-environment` entitlement that expo-notifications' auto-applied plugin
    // writes — auto-applied plugins always run before this static array, so position here can't
    // lose to it. Mods are LIFO: a static plugin that writes entitlements must come after this
    // one in the array, or it re-adds the key.
    './plugins/with-local-only-notifications',
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
