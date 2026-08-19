/**
 * The version baked into THIS client bundle (`__PORCELAIN_VERSION__`, replaced by the Vite
 * `define` in apps/web and apps/desktop). Wrapped in a function rather than read inline so
 * a test can mock this module instead of depending on the build-time define.
 */
export function clientVersion(): string {
  return __PORCELAIN_VERSION__
}
