# Porcelain

Agent-managed foundations document. Claude owns this file: keep it accurate, update it whenever an architectural decision is made, and never let the codebase diverge from it. `AGENTS.md` is a symlink to this file.

## What Porcelain is

A lightweight macOS-first **viewer and agent companion**, not an editor. The user manages coding agents from the terminal; Porcelain fills the gaps that currently force opening Cursor/Zed/GitHub Desktop:

- **File viewer** — read-only, fast, no LSP, no extensions, no editing.
- **Scoped navigation** — works in huge monorepos (~50 GB); folders can be hidden/pinned so only relevant apps are visible. This is a core differentiator: no existing tool lets you hide irrelevant parts of a monorepo.
- **Git** — diffs, worktrees, history.
- **Terminal / agent companion** — a home for the terminal and agent sessions.
- **Flow-ordered review** — review a diff as a *timeline of connected layers*, not an alphabetical file list. A feature change is a straight line (e.g. component → query call → route → controller → service → module → Prisma); Porcelain should order/group changed files along that dependency flow so the reviewer reads the change as a story from entry point to database. Core differentiator alongside folder hiding.

Guiding principle: viewer, not editor. Lightweight always wins. Reject features that turn it into an IDE.

## Stack (decided)

| Area | Decision |
|---|---|
| Shell | Electron via **electron-vite**, React 19, TypeScript (strict) |
| UI | **shadcn/ui** + Tailwind CSS v4 |
| Client architecture | **Vercel composition patterns** everywhere (see below) |
| Package manager | **pnpm** |
| Lint/format | **Biome** (single config, no ESLint/Prettier) |
| Tests | **Vitest** (unit/component) + **Playwright** (Electron e2e) |
| Commits | **Conventional Commits** (`feat:`, `fix:`, `chore:`, `refactor:`, `test:`, `docs:`) |

## Architecture rules

1. **One way to do everything.** Before introducing a new pattern (state management, data fetching, IPC shape, component style, test style), check this file. If the decision isn't recorded here, **stop and ask the user**, then record the answer here. Two coexisting architectures is a failure state.
2. **Composition over configuration.** Follow Vercel composition patterns: small composable components, children/slot-based APIs, compound components over prop-drilled mega-components. No boolean-prop explosions.
3. **shadcn components are the base layer.** Add via the shadcn CLI/registry; customize in place. Don't hand-roll primitives shadcn already provides. Use the `shadcn` and `vercel-composition-patterns` skills in `.agents/skills/`.
4. **Process boundaries.** Main process = OS/git/fs access. Renderer = pure UI, no Node APIs. All IPC through typed, preload-exposed channels — one uniform IPC pattern, defined once.
5. **Read-only by design.** No file-write features in the viewer.
6. **Performance is a feature.** The app must stay fast on a 50 GB monorepo: virtualized lists/trees, lazy fs reads, never index what isn't visible.

## Uniformity rules

- Code, tests, commit messages, file naming: uniform across the repo. Match existing patterns exactly; if something feels like it needs a new pattern, ask first.
- Tests live next to source (`foo.test.ts`), named after the unit under test, written in the same style as existing tests.
- Highest code quality: strict TS, no `any`, no dead code, no commented-out code.

## Decision log

- 2026-06-12: Stack chosen (electron-vite/React/TS, shadcn+Tailwind v4, pnpm, Biome, Vitest+Playwright, Conventional Commits).

## Open decisions (ask before implementing)

- State management approach (zustand? jotai? context-only?)
- Terminal embedding (xterm.js?) and agent-session integration design
- Git backend (shell out to `git` vs library)
- How folder hiding/pinning config is persisted
- Routing/layout structure of the app shell
- Flow-ordered review: how to derive the chain — static import-graph analysis, user-defined layer conventions (e.g. component/route/controller/service/prisma path patterns per repo), agent-assisted ordering, or a hybrid
