// `__PORCELAIN_VERSION__` is replaced at build time with package.json's version
// (electron.vite.config.ts + vitest.config.ts `define`). It's baked into both the
// daemon bundle and the renderer bundle so each can report/compare its own build
// version for the version-skew guard. Declared in src/shared because both tsconfigs
// (node + web) include this dir, so the one global is visible to backend and renderer.
declare const __PORCELAIN_VERSION__: string
