# Repo facts and packaging

## Repo facts

- **Packages:** `apps/daemon`, `apps/cli`, `apps/web`, `apps/desktop` (shell), `apps/mobile`,
  plus `packages/contracts`, `packages/client-runtime`, `packages/shared`. See
  `architecture.md`. Root is workspace-only (lint, hooks, release); no root `version`.
- **One product version** on every workspace package that carries `version`. Canonical stamp is
  `apps/desktop/package.json` (electron-builder); `scripts/sync-versions.mjs` aligns all others
  (`pnpm lint` runs `--check`). `release-cut` bumps then syncs.
- **Build outputs** (layout for shell spawn + `porcelain-daemon` npm):
  - `apps/desktop/out/main/index.js` — Electron main
  - `apps/desktop/out/main/daemon/server.js` — esbuild daemon
  - `apps/desktop/out/main/cli/porcelain.js` — esbuild agent CLI (single file)
  - `apps/desktop/out/renderer/` — Vite web client
- **Order:** `pnpm build` → mobile typecheck → web Vite → electron-vite shell → build-node
  (so electron-vite cannot wipe daemon/cli).
- **TRAP — pin `dmg.artifactName`.** electron-builder's `${name}` expands to the raw package name, so
  the scoped `@porcelain/desktop` would put a slash in the artifact filename.
- Path aliases for web: electron-vite (dev HMR), `apps/web/vite.config.ts` (prod), vitest, tsconfigs —
  keep `@renderer`, `@backend`, `@shared`, contracts, client-runtime subpaths in sync when adding.
- `@main` / `@preload` imports in the web client are **type-only** where possible — a runtime import
  of main can leak Node into the bundle.
- **TRAP — the two `createTRPCReact` instances must never share the default TRPC context.** With no
  `context` option it falls back to a module-level singleton, so nesting the shell Provider inside
  the app Provider silently routes ALL app hooks to the shell client ("No procedure found" hang).
- Procedure catalog: `packages/contracts` + `scripts/lint-procedure-contracts.mjs`.
- Daemon `userData/config.json` holds global Remote bind flags only; Project recents are owned by
  the daemon's separate strict-v1 `userData/projects-recents.json` document. Scope and explicit
  overlays live under the daemon root; retired companion files are inert
  without writing them.

## Packaging, release, conventions

`electron-builder.yml`: mac dmg + zip (arm64 — the **zip** is what electron-updater downloads), hardened
runtime, Developer ID signing. Auto-update no-ops unless `app.isPackaged`. Agent CLI is a single
Node-builtins CJS file. Release: `pnpm release:cut` (default **patch**) bumps all package versions,
tags, packages Mac + publishes npm `porcelain-daemon`. Runbook: `releasing`.

- shadcn primitives only; a new primitive needs human approval.
- Strict TS; type escapes lint-enforced. Commit: `pnpm lint`. Before push / CI: `pnpm verify`.
- Managed worktrees are runtime-isolated (unique port, per-slug homes).
  `PORCELAIN_DEV_PLAYGROUND` must stay in `terminal-env.ts`'s scrub list.
