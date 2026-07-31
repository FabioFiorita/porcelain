# @porcelain/contracts

Shapes that cross a **client** boundary — the daemon's wire contract, consumed by
every client (renderer, mobile, CLI) from one definition. `src/shared/` is the
other thing: code shared between the **desktop processes** (main, preload,
renderer, daemon), which a sibling workspace package can't reach and doesn't need.

No build step. `main`/`types` point at TypeScript source and every consumer
bundles it from source through a `@porcelain/contracts` alias (`tsconfig*.json`,
`electron.vite.config.ts`, `vitest.config.ts`). Deliberately **not** a root
`dependencies` entry: electron-vite externalizes declared deps, which would turn
the alias into a bare `require("@porcelain/contracts")` in the dependency-free
CLI and standalone daemon bundles.

Keep it dependency-light (zod only) and Electron-free — it is compiled by React
Native's Metro as well as Vite.
