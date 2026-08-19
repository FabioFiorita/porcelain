# @porcelain/web

React human UI. Served by the daemon to browsers and loaded by the Electron shell.
See [`docs/architecture.md`](../../docs/architecture.md).

Production builds run from this package's `vite.config.ts` into
`apps/desktop/out/renderer`, which is what the daemon serves and the Electron window loads.
For development, `pnpm dev:web` serves this source with HMR and proxies the daemon routes —
see [`docs/development.md`](../../docs/development.md).
