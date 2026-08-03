# Desktop shell

Applies under `apps/desktop/`. Mobile: `apps/mobile/`. Map: `.agents/reference/architecture.md`.

**This package is the Electron shell** (main, preload, packaging). Product runtime is `apps/daemon`,
agent CLI is `apps/cli`, React UI is `apps/web`. Independent builds emit into `out/` for shell spawn
and packaging: Vite (web), esbuild (daemon/cli), electron-vite (shell only). See
`.agents/reference/architecture.md`.

## Boundaries

- **Web (`apps/web`):** shadcn/ui on **Base UI** + Tailwind v4. Composition:
  `.agents/reference/composition.md`.
- **Daemon (`apps/daemon`):** Electron-free. Load **`audit`** before git/config/fs/URLs/channels.
  Types via `@backend/*`.
- **Shell (`src/main`, `src/preload`):** windows, menu, updater, spawn/bind daemon, shell IPC only.
- **CLI (`apps/cli`):** agent binary; Node builtins only.
- **Data flow:** daemon procedures → domain hooks → components. Components never import
  `lib/trpc` or `lib/daemon` (Biome-enforced).
- **Ports:** dev **43118** (worktrees **43200–43999**); production **43117**. Never mix homes.

## Proof

- UI: **browser** against the dev daemon. `pnpm test:e2e` for the suite.
- Pure logic: Vitest under `apps/desktop` (globs daemon/cli/web/mobile pure modules).
- Electron-native e2e: local Mac only; not CI / not `pnpm verify`.

## When lost

| Topic | Open |
|-------|------|
| Package map / refactor | `.agents/reference/architecture.md` |
| Architecture / data flow | `.agents/reference/one-architecture.md` |
| Shell / surfaces | `.agents/reference/app-shell.md` |
| Terminal | `.agents/reference/terminal.md` |
| Repo / packaging facts | `.agents/reference/repo.md` |
