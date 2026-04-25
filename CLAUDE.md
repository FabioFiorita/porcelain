# Porcelain

Agent-managed foundations. Claude owns this file and the skills under `.claude/skills/` — keep them accurate and never let the codebase diverge from them. `AGENTS.md` is a symlink to this file. Keep this file slim: detail belongs in skills.

Porcelain is a lightweight macOS viewer + agent companion (Electron). Not an editor.

## Hard rules

1. **One way to do everything.** Before introducing any new pattern (state, data fetching, IPC shape, component or test style), check the `architecture` skill. If undecided, **stop and ask the user**, then record the answer (decision log here, detail in the skill). Two coexisting architectures is a failure state.
2. **Uniformity everywhere** — code, tests, commits, naming. Match existing patterns exactly.
3. **Verification gate before any commit:** `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
4. **Keep docs in sync:** every architectural/product decision updates the relevant skill and the decision log below in the same commit.
5. **shadcn primitives only.** Always use shadcn components for UI primitives; never hand-roll one (sidebar, tabs, dialogs, trees, etc.). If a needed primitive doesn't exist in shadcn/registries, **get the user's approval before building it**.
6. **No type escape hatches.** No `any`, no `as unknown as` casts. If type safety requires a different design (e.g. tRPC over a hand-rolled bridge), prefer the safer design.

## Skills (in `.claude/skills/`)

- `architecture` — stack, repo facts, aliases, conventions, app shell. Read before writing any code.
- `product` — what Porcelain is, core features, product principles. Read before designing features/UI.

Vendor skills in `.agents/skills/`: `shadcn`, `vercel-composition-patterns`, `frontend-design`.

## Decision log
- 2026-06-12: Stack: electron-vite/React 19/TS strict, shadcn+Tailwind v4, pnpm, Biome, Vitest+Playwright, Conventional Commits.
- 2026-06-12: shadcn on **Base UI** instead of Radix (user choice), `base-nova` preset.
- 2026-06-12: zustand; git via CLI shell-out; xterm.js + node-pty; per-repo config in app-side store.
- 2026-06-12: App shell = sidebar + tabs + collapsible bottom terminal; one repo per window; react-resizable-panels.
- 2026-06-12: Docs split: slim CLAUDE.md + project skills in `.claude/skills/`.
- 2026-06-12: IPC = **tRPC over electron-trpc** (user choice over hand-rolled bridge: no casts, zod-validated inputs). File tree = lazy per-directory reads.
- 2026-06-12: shadcn `sidebar` primitive for the app sidebar (user feedback → hard rule 5); sidebar collapses to rail, no drag-resize.
- 2026-06-12: Folder hiding: right-click Hide/Unhide + eye toggle (dimmed in show-hidden mode); filtering in MAIN process. Recents on welcome screen (app config store in userData/config.json).

- 2026-06-12: Auto-open last repo on startup. Git diffs: working-tree first, sidebar Files/Changes tabs, unified + split rendering (user toggle).

## Open decisions (ask before implementing)

- Agent-session integration design (beyond a plain terminal)
- Flow-ordered review: how to derive the chain — static import-graph analysis, user-defined layer conventions per repo, agent-assisted, or hybrid
- Syntax highlighting for the file viewer (currently plain text)
