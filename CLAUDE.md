# Porcelain

Agent-managed foundations. This file owns project agent guidance; skills live in `.agents/skills/` and are symlinked into `.claude/skills/` for Claude discovery. Keep them accurate and never let the codebase diverge from them. `AGENTS.md` is a symlink to this file. **Keep this file slim — it loads into every session. Detail belongs in skills (loaded on demand); chronology and rationale belong in the `history` skill.**

Porcelain is a lightweight macOS viewer + agent companion (Electron). Not an editor.

## Hard rules

1. **One way to do everything.** Before introducing any new pattern (state, data fetching, IPC shape, component or test style), check the `architecture` skill. If undecided, **stop and ask the user**, then record the answer (an entry in the `history` skill, the *what* in its home skill). Two coexisting architectures is a failure state.
2. **Uniformity everywhere** — code, tests, commits, naming. Match existing patterns exactly.
3. **Verification gate before any commit:** `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
4. **Keep docs in sync:** every architectural/product decision updates the relevant home skill **and** appends an entry to the `history` skill in the same commit (the skill states *what*, the log records *why*).
5. **shadcn primitives only.** Always use shadcn components for UI primitives; never hand-roll one (sidebar, tabs, dialogs, trees, etc.). If a needed primitive doesn't exist in shadcn/registries, **get the user's approval before building it**.
6. **No type escape hatches.** No `any`, no `as unknown as` casts. If type safety requires a different design (e.g. tRPC over a hand-rolled bridge), prefer the safer design.
7. **No `void` on promises.** Never write `void somePromise()` to silence floating promises — use `async`/`await` (or `await Promise.all([...])` when batching). Bare calls like `utils.foo.invalidate()` in sync handlers are fine when you truly don't need to wait.
8. **Commit straight to `main` — never create branches.** Solo developer; `main` is the only branch and committing directly to it (after the verification gate, hard rule 3) is safe and expected. Do NOT open `feat/*`/`fix/*` branches or PRs for changes, and do NOT branch just because you're on the default branch — keep everything on `main`. (This deliberately overrides the generic "branch off the default branch first" default.)

## Skills (in `.agents/skills/`, symlinked at `.claude/skills/`)

Only each skill's one-line description loads up front; the body loads on demand when you read it. Read the relevant skill *before* acting in its area.

- `architecture` — stack, repo facts, aliases, conventions, app shell, client architecture. **Read before writing or reviewing any code.**
- `product` — what Porcelain is, who it's for, core features, product principles. **Read before designing features/UI or prioritizing.**
- `audit` — the security/correctness/performance/type invariants the codebase must not regress, with file pointers. **Read before changing the main process, IPC, config persistence, git plumbing, file reads, external-URL handling, or packaging — and when reviewing a diff for regressions.**
- `history` — the append-only decision log: *why* each decision was made, including rejected paths. **Read when you need the rationale behind an existing decision.** Append an entry per hard rule 4.
- `releasing` — the runbook for cutting a signed + notarized release (bump/tag, the Actions pipeline, secrets, changelog). **Read when publishing a version or touching the release/signing setup.**
- `improve` — read-only senior-advisor audit harness that produces handoff plans for other agents (output in `plans/`).

Vendor skills: `shadcn`, `frontend-design`.

## Nomenclature

Shared vocabulary so a bare noun ("improve the viewer", "the Changes tab is wrong") resolves to one place without asking. Each term maps to real code; when the user uses one, act on the named region — don't re-ask which one. Detail lives in the `architecture` skill's App shell section; this is the lookup table.

**Shell regions (the window, outside-in):**
- **Top bar** — full-width chrome header (`TopBar` in `app-shell.tsx`): traffic lights + project switcher on the left, panel toggles + Update pill on the right.
- **Sidebar** (unqualified = the **left** one) — `app-sidebar.tsx`; the navigation panel. Cmd+B. Header = project switcher, footer = branch/worktree switcher + settings gear.
- **Viewer** — the central panel (`shell/viewer.tsx`, everything under `components/viewer/`). The main content area; renders whatever the active tab is. **Never "editor"** — Porcelain is not an editor.
- **Quick Access** — the **right** panel (`right-sidebar.tsx`). Cmd+. — its contents follow the active sidebar tab.

**Inside the sidebar:**
- **Sidebar tabs** — the three: **Files**, **Changes**, **History** (`sidebarTab` pref; Cmd+1/2/3).
- **File tree** — Files tab body (`file-tree.tsx` / `tree-node.tsx`).
- **Changes list** — Changes tab body (`changes-list.tsx`), grouped by flow layer.
- **History list** — History tab body (`history-list.tsx`).

**Inside the viewer:**
- **Tab bar** — the floating glass capsule of open documents (`tab-bar.tsx`).
- **Tab** — one open document. **Preview tab** = single-click, italic, replaced by the next preview; **pinned tab** = double-click or edit, kept.
- **Split view / pane** — the viewer can split into two side-by-side **panes**, each with its own tab bar and active tab (`panes`/`activePaneIndex` in `stores/tabs.ts`). Open via "Open to the Side" (file-tree row or tab); closing a pane's last tab collapses the split. Details in the `architecture` skill's "Split view" note.
- Tab kinds: **file view** / **source view** (`source-view.tsx`, editable) / **markdown reader** (`markdown-view.tsx`) / **diff view** (`diff-view.tsx`, working-tree) / **commit view** (`commit-view.tsx`, a historical commit) / **search view** (`search-view.tsx`, find-references results) / **feature view** (`feature-view.tsx`, the whole feature — changed + context + agent-fed shipped files in flow order).

**Inside Quick Access (section depends on the sidebar tab):**
- Files → **Pinned** (`pinned-group.tsx`) + **Notes card** (`notes-card.tsx`), wrapped in `files-quick-access.tsx`.
- Changes/History → **Quick commands** (`quick-commands-group.tsx`) + **Suggested** rows.
- Changes → **Commit composer** (`commit-group.tsx`).

**Overlays:**
- **File finder** — Cmd+P fuzzy finder (`file-finder.tsx`).
- **Find bar** — Cmd+F in-viewer search (`find-bar.tsx`).
- **Settings** — gear → `settings-dialog.tsx` (General + Review flow sections).
- **Welcome screen** — the no-repo / repo-picker state (`welcome.tsx`).

**Cross-cutting concepts:**
- **Flow / flow layers** — the architectural-layer grouping of changes (entry-point → data); the heart of "review changes as a story".
- **Feature view / review set** — the change widened into the whole feature, flow-ordered. Files are tagged by **source**: **changed** (working tree), **context** (unchanged, reached by import — the no-MCP baseline), **shipped** (cross-seam files the agent declares). A **review set** is the agent-fed manifest (`~/.porcelain/review-sets.json`) written by the **MCP server** (`src/mcp/`, standalone stdio), distributed as a one-click **Claude Code plugin** (Settings → "Claude Code plugin"). Opened from the Changes tab.
- **Repo / worktree / window** — one repo per window; the worktree switcher sits in the sidebar footer.
- **Glaze / glaze tile / vibrancy void** — the design-system surfaces (floating porcelain tiles over the vibrancy void).
