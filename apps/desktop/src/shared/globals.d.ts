// `__PORCELAIN_VERSION__` is replaced at build time with package.json's version
// (electron.vite.config.ts + vitest.config.ts `define`). It's baked into the daemon
// bundle and CLI so the current build can report its own version. Declared in src/shared
// because both tsconfigs (node + web) include this dir.
declare const __PORCELAIN_VERSION__: string
