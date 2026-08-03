# @porcelain/contracts

Shapes that cross a **client** boundary — the daemon's wire contract, consumed by
every client (web, mobile, CLI) from one definition. Target: full public procedure
I/O schemas live here so no client invents parallel types (see
`.agents/reference/architecture.md`).

`apps/desktop/src/shared/` (future `packages/shared`) is the other thing: code
shared between processes that is not the wire contract.

No build step. `main`/`types` point at TypeScript source and every consumer
bundles it from source through a `@porcelain/contracts` alias (`tsconfig*.json`,
`electron.vite.config.ts`, `vitest.config.ts`). Deliberately **not** a root
`dependencies` entry of the electron-vite app while that bundler still owns
CLI/daemon outputs: it externalizes declared deps, which would turn the alias
into a bare `require("@porcelain/contracts")` in the dependency-free CLI and
standalone daemon bundles.

Keep it dependency-light (zod only) and Electron-free — it is compiled by React
Native's Metro as well as Vite. **Never import from `apps/*`.**
