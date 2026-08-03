# Desktop tree (shell + transitional host)

Applies under `apps/desktop/`. Mobile is out of scope — see `apps/mobile/`.
Daemon source: `apps/daemon/`. Map: `.agents/reference/architecture.md`.

**Target:** this package is the **Electron shell only**. Web client still lives here as
`src/renderer` until `apps/web`. Daemon: `apps/daemon`. CLI: `apps/cli`.

## Boundaries

- **Web client (`src/renderer`):** shadcn/ui on **Base UI** (`@base-ui/react`, not Radix) + Tailwind v4.
  Custom triggers use `render`, never `asChild`. Settled config: `components.json`. Composition traps:
  `.agents/reference/composition.md`.
- **Daemon (`apps/daemon`):** Electron-free product runtime. Load the **`audit` skill** before changing
  git, config, file reads, external URLs, packaging, or agent channels. Import types via `@backend/*`.
- **Shell (`src/main`, `src/preload`):** windows, menu, updater, spawn/bind daemon, shell IPC only.
- **CLI (`apps/cli`):** agent binary; Node builtins only.
- **Data flow:** daemon procedures → domain hooks → components. Components never import
  `lib/trpc` or `lib/daemon` (Biome-enforced). One zustand store per client-only concern.
- **Ports:** product work uses dev **43118** (worktrees **43200–43999**). Production is **43117**.
  Never mix data or channels.
- **One home per concern:** Changes owns diffs/stage/commit; Review owns the canvas; Files the tree;
  Board the plan; Terminal/Actions run. Previews hand off via `lib/surface-handoffs.ts` — no second
  Diff panel or commit UX.

## Proof

- Day-to-day UI: **browser** against the dev daemon (same dist Electron loads). Playwright MCP,
  a live tab, or `pnpm test:e2e`.
- Backend / pure logic: Vitest under `apps/desktop` (globs daemon + mobile pure modules).
- Electron-native e2e is local Mac only (`pnpm --dir apps/desktop test:e2e:native*`), not CI or `pnpm verify`.

## When lost

| Topic | Open |
|-------|------|
| Package map / refactor | `.agents/reference/architecture.md` |
| Architecture / data flow | `.agents/reference/one-architecture.md` |
| Shell / surfaces | `.agents/reference/app-shell.md` |
| Terminal | `.agents/reference/terminal.md` |
| Repo / packaging facts | `.agents/reference/repo.md` |
| Tab names / regions | `.agents/reference/nomenclature.md` |
