// `__PORCELAIN_VERSION__` is replaced at build time with package.json's version
// (electron.vite.config.ts `define`), so it's baked into the daemon bundle and
// travels into the standalone `porcelain-daemon` package unchanged — no runtime
// package.json read (the out/ vs dist-daemon layouts differ in depth, so a fixed
// relative path can't serve both) and nothing Electron-specific.
export function daemonVersion(): string {
  return __PORCELAIN_VERSION__
}
