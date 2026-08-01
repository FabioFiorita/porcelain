/**
 * This renderer build's version, baked in at build time from package.json
 * (electron.vite.config.ts `define`). Works in both the Electron window and the
 * daemon-served browser client (same dist), so the version-skew guard doesn't have
 * to reach the shell-only updater to learn the app's own version.
 */
export function appVersion(): string {
  return __PORCELAIN_VERSION__
}
