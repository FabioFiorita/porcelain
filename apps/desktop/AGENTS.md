# Desktop shell

Applies under `apps/desktop/`. Mobile: `apps/mobile/`. Map: `docs/internals/architecture.md`.

**This package is the Electron shell** (main, preload, packaging). Product runtime is `apps/daemon`,
React UI is `apps/web`. Independent builds emit into `out/` for shell spawn
and packaging: Vite (web), esbuild (daemon/cli), electron-vite (shell only). See
`docs/internals/architecture.md`.

## Boundaries

- **Web (`apps/web`):** shadcn/ui on **Base UI** + Tailwind v4. Composition:
  `docs/internals/composition.md`.
- **Daemon (`apps/daemon`):** Electron-free. Read the owning domain guidance in
  `docs/internals/agent-foundations.md` before git/config/fs/URLs/channels changes.
  Types via `@backend/*`.
- **Shell (`src/main`, `src/preload`):** windows, menu, updater, spawn/bind daemon, shell IPC only.
- **Data flow:** daemon procedures → domain hooks → components. Components never import
  `lib/trpc` or `lib/daemon` (Biome-enforced).
- **Ports / homes:** root `AGENTS.md` → "Prod vs dev" is canonical. Never mix them.

## Proof

- UI: **browser** against the dev daemon. `pnpm test:e2e` for the suite.
- Pure logic: Vitest under `apps/desktop` (globs daemon/cli/web/mobile pure modules).
- Electron-native e2e: local Mac only; not CI / not `pnpm verify`.

## When lost

| Topic | Open |
|-------|------|
| Package map / refactor | `docs/internals/architecture.md` |
| Architecture / data flow | `docs/internals/one-architecture.md` |
| Shell / surfaces | `docs/internals/app-shell.md` |
| Terminal | `docs/internals/terminal.md` |
| Repo / packaging facts | `docs/internals/repo.md` |
| Cross-cutting owner, proof, and gate map | `docs/internals/agent-foundations.md` |
