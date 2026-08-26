// `__PORCELAIN_VERSION__` is replaced at build time with package.json's version
// (electron.vite.config.ts + vitest.config.ts `define`). It's baked into the daemon
// bundle and CLI so the current build can report its own version. Declared here so
// both tsconfigs (node + web) include it; pure helpers live in packages/shared.
declare const __PORCELAIN_VERSION__: string

// `__PORCELAIN_PLUGIN_VERSION__` comes from `plugins/porcelain/.codex-plugin/plugin.json`, not the
// product version — the shipped plugin is versioned independently so a release that
// changes nothing an agent reads does not claim a new plugin.
declare const __PORCELAIN_PLUGIN_VERSION__: string
