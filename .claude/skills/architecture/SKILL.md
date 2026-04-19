---
name: architecture
description: Porcelain's stack, repo layout, aliases, conventions, and app-shell structure. Read before writing or reviewing any code in this repo.
---

# Porcelain architecture

## Stack

| Area | Decision |
|---|---|
| Shell | Electron via **electron-vite**, React 19, TypeScript (strict) |
| UI | **shadcn/ui on Base UI** (`@base-ui/react`, not Radix) + Tailwind CSS v4, `base-nova` preset, Geist font, dark mode default |
| Client architecture | **Vercel composition patterns** (see `.agents/skills/vercel-composition-patterns/`) |
| Client state | **zustand** — small stores per concern; no other state libraries |
| Git backend | Shell out to `git` CLI from the main process; parse porcelain-format output; no git libraries |
| Terminal | **xterm.js** renderer + **node-pty** in main process |
| Per-repo config | App-side JSON store under `~/Library/Application Support/porcelain`, keyed by repo path; never write into work repos |
| Package manager | **pnpm** |
| Lint/format | **Biome** (no ESLint/Prettier) |
| Tests | **Vitest** (unit/component) + **Playwright** (Electron e2e, not yet wired) |
| Pane resizing | **react-resizable-panels v4** via shadcn `resizable` (v4 API: `orientation`, string sizes like `"20%"`/`"160px"`, no `autoSaveId`) |

## App shell

- Layout: left file-tree sidebar, tabbed center viewer, collapsible bottom terminal pane.
- **One repo per window** — window state is scoped to a single repo/worktree.
- Shell components live in `src/renderer/src/components/shell/`; tab state in `stores/tabs.ts`.

## Repo facts

- Renderer alias `@renderer/*` → `src/renderer/src/*`, defined in FOUR places that must stay in sync: `electron.vite.config.ts`, `tsconfig.web.json`, root `tsconfig.json` (needed by the shadcn CLI), `vitest.config.ts`.
- shadcn components: `src/renderer/src/components/ui/` (excluded from Biome); add via `pnpm dlx shadcn@latest add <name>`. Base UI uses `render` prop, not Radix's `asChild` — see `.agents/skills/shadcn/rules/base-vs-radix.md`.
- Tailwind/theme entry: `src/renderer/src/assets/main.css` (imports `shadcn/tailwind.css` and Geist).
- Main process = OS/git/fs access. Renderer = pure UI, no Node APIs. All IPC through typed, preload-exposed channels — one uniform IPC pattern, defined once (not yet established; ask before creating it).

## Conventions

- Own components: kebab-case filenames, named PascalCase exports, composition-first (no boolean-prop variants). Feature components in `src/renderer/src/components/<area>/`; zustand stores in `src/renderer/src/stores/`, one file per concern.
- Tests live next to source (`foo.test.ts`), named after the unit under test.
- Strict TS, no `any`, no dead code, no commented-out code.
- Conventional Commits (`feat:`, `fix:`, `chore:`, `refactor:`, `test:`, `docs:`).
- Verification gate before any commit: `pnpm lint && pnpm typecheck && pnpm test && pnpm build` must all pass.
