# Desktop app and daemon

Applies under `apps/desktop/`. Mobile runtime is out of scope here — see `apps/mobile/`.

## Boundaries

- **Renderer:** shadcn/ui on **Base UI** (`@base-ui/react`, not Radix) + Tailwind v4. Custom triggers
  use `render`, never `asChild`. No hand-rolled primitives when a shadcn component exists. Settled
  config is `apps/desktop/components.json`. Composition traps:
  `.agents/reference/composition.md`.
- **Backend / main:** `src/backend/` owns the daemon and git/config plumbing; `src/main/` is the
  Electron shell. Load the **`audit` skill** before changing IPC, config, git, file reads, external
  URLs, packaging, or agent channels.
- **Data flow:** daemon procedures → domain hooks → components. Components never import
  `lib/trpc` or `lib/daemon` (Biome-enforced). One zustand store per client-only concern.
- **Ports:** product work uses dev **43118** (worktrees **43200–43999**). Production is **43117**.
  Never mix data or channels.
- **One home per concern:** Changes owns diffs/stage/commit; Review owns the canvas; Files the tree;
  Board the plan; Terminal/Actions run. Previews hand off via `lib/surface-handoffs.ts` — no second
  Diff panel or commit UX.

## Proof

- Day-to-day UI: **browser** against the dev daemon (same renderer dist as Electron). Playwright MCP,
  a live tab, or `pnpm test:e2e`.
- Backend / pure logic: Vitest under `apps/desktop` (also globs mobile pure modules).
- Electron-native packaging smoke is optional, not part of `pnpm verify`.

## When lost

| Topic | Open |
|-------|------|
| Architecture / data flow | `.agents/reference/one-architecture.md` |
| Shell / surfaces | `.agents/reference/app-shell.md` |
| Terminal | `.agents/reference/terminal.md` |
| Repo / packaging facts | `.agents/reference/repo.md` |
| Tab names / regions | `.agents/reference/nomenclature.md` |
