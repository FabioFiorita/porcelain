# Porcelain

Agent-managed foundations. This file owns project agent guidance; skills live in `.agents/skills/` and are symlinked into `.claude/skills/` for Claude discovery. Keep them accurate and never let the codebase diverge from them. `AGENTS.md` is a symlink to this file. **Keep this file slim — it loads into every session. Detail belongs in skills (loaded on demand).**

Porcelain is a lightweight macOS viewer + agent companion (Electron). Not an editor.

## Hard rules

1. **One architecture — but think freely.** Default to the existing pattern (state, data fetching, IPC shape, component/test style): check the `architecture` skill and match what's there, so the codebase stays uniform. But if you think a genuinely better approach exists, **propose it with the tradeoff before building** — don't silently fork the architecture, and don't be timid about suggesting one. The failure state is *two patterns nobody chose*; a considered switch (recorded in the home skill) is not. Outside-the-box thinking is wanted — it just gets surfaced, not smuggled in.
2. **Match the local idiom.** When you write code, make it read like the code around it — naming, test shape, file layout, commit format. This is small-scale consistency (so the result looks like one author), not a constraint on *what* you build.
3. **Verification gate before any commit:** `pnpm lint && pnpm typecheck && pnpm test && pnpm build` (= `pnpm verify`). **Hook-enforced** — the `PreToolUse` git-guard (`.claude/settings.json`) blocks any commit until the gate passes, so a failing gate is a loop to fix, not a suggestion to skip.
4. **Docs say what the code can't.** A skill carries decisions, the *why*, the deliberately-absent, and the traps — **not** a paraphrase of how a file works today. For current mechanics, read the file (it never goes stale); the skill points you to the entry file and tells you what a fresh read won't. So: when you change a decision or hit a new trap, update its home skill in the same commit; when you find a skill describing mechanics the code already shows, *cut it*; and prefer enforcing a rule in Biome over writing it in prose (a lint rule can't rot or be ignored). No decision log, no redundant guides.
5. **shadcn primitives only — and load the `shadcn` skill first.** Always use shadcn components for UI primitives; never hand-roll one (sidebar, tabs, dialogs, trees, etc.). **Before any UI work, load the `shadcn` skill** and check whether shadcn/registries already provide something that fits — search there before building. If a needed primitive doesn't exist in shadcn/registries, **get the user's approval before building it**.
6. **Let type-safety drive the design.** When types fight you, change the design — don't escape it. `any` is already a Biome error (the gate enforces it), so this rule is the half lint can't: reach for the safer shape (e.g. tRPC over a hand-rolled bridge) instead of an `as unknown as` cast (banned repo-wide).
7. **No `void` on promises.** Never write `void somePromise()` to silence floating promises — use `async`/`await` (or `await Promise.all([...])` when batching). Bare calls like `utils.foo.invalidate()` in sync handlers are fine when you truly don't need to wait.
8. **Commit straight to `main` — never create branches.** Solo developer; `main` is the only branch and committing directly to it (after the verification gate, hard rule 3) is safe and expected. Do NOT open `feat/*`/`fix/*` branches or PRs for changes, and do NOT branch just because you're on the default branch — keep everything on `main`. (This deliberately overrides the generic "branch off the default branch first" default.) The git-guard hook **hard-blocks** branch creation, so this is enforced, not just convention.

**Verifying live with computer-use:** run `pnpm dev` (opens the dev Electron on `~/Code/porcelain-playground` with isolated config) and request computer-use access for the **dev app — it shows up as "Electron"**, bundle id `com.github.Electron`. NEVER request the installed **"Porcelain"** app: that's the user's real work (their SOAPHEALTH repo) and it doesn't have your changes anyway. Screenshot/drive the dev "Electron" window.

## Skills (in `.agents/skills/`, symlinked at `.claude/skills/`)

Only each skill's one-line description loads up front; the body loads on demand when you read it. Read the relevant skill *before* acting in its area.

- `architecture` — stack, repo facts, aliases, conventions, app shell, client architecture. **Read before writing or reviewing any code.**
- `product` — what Porcelain is, who it's for, core features, product principles. **Read before designing features/UI or prioritizing.**
- `audit` — the security/correctness/performance/type invariants the codebase must not regress, with file pointers. **Read before changing the main process, IPC, config persistence, git plumbing, file reads, external-URL handling, or packaging — and when reviewing a diff for regressions.**
- `releasing` — the runbook for cutting a signed + notarized release (bump/tag, the Actions pipeline, secrets, changelog). **Read when publishing a version or touching the release/signing setup.**
- `shadcn` — vendored UI-primitive skill (also in `.agents/skills/`).

Also available, but **not** vendored in this repo (globally installed, listed here only so you know they exist): `improve` (read-only senior-advisor audit harness → plans in `plans/`) and `frontend-design`.

## Agentic enforcement

The advisory layer above (CLAUDE.md + skills) is backed by a deterministic layer in `.claude/` so the project can run unattended:
- **`.claude/settings.json`** — a `PreToolUse` git-guard hook (`.claude/hooks/git-guard.sh`) that hard-blocks branch creation (rule 8) and runs the `pnpm verify` gate before any commit (rule 3), plus a dev-loop permission allowlist (lint/typecheck/test/build + local git). `git push` is deliberately left to prompt (the one outward-facing action).
- **`invariant-reviewer` agent** (`.claude/agents/`) — read-only; reviews a diff against the `audit` invariants and the one architecture. Delegate to it before committing non-trivial changes ("use the invariant-reviewer on this diff").

## Nomenclature

Shared vocabulary so a bare noun ("improve the viewer", "the Changes tab is wrong") resolves to one place without asking. Each term maps to real code; when the user uses one, act on the named region — don't re-ask which one. The file in parens is the **entry point** — read it for current mechanics; the `architecture` skill holds the cross-cutting decisions and traps. This is the lookup table.

**Shell regions (the window, outside-in):**
- **Top bar** — the full-width window **titlebar** (`title-bar.tsx`): traffic lights + a centered search button. **Not** the viewer's own header (`TopBar` in `app-shell.tsx`, below it).
- **Sidebar** (unqualified = the **left** one) — `app-sidebar.tsx`; the nav panel (Cmd+B). An **icon rail** beside a **content panel** (active tab's body); footer = **branch chip** (left) + **worktrees picker** (right).
- **Viewer** — the central panel (`shell/viewer.tsx`, `components/viewer/`). **Never "editor"** — Porcelain is a viewer.
- **Quick Access** — the **right** panel (`right-sidebar.tsx`, Cmd+.); its contents follow the active sidebar tab.

**Inside the sidebar** (tabs `Files`·`Search`·`Changes`·`History`·`Feature`·`Board`·`Terminal`; `sidebarTab` pref, Cmd+1–7 — a vertical icon rail, ⌘B collapses to it):
- **File tree** — Files body (`file-tree.tsx` / `tree-node.tsx`).
- **Search list** — Search body (`search-list.tsx`): repo-wide code search (`gitSearchCode`), distinct from the ⌘⇧F `ContentSearch` overlay (`gitGrep`).
- **Changes list** — Changes body (`changes-list.tsx`), grouped by flow layer.
- **History list** — History body (`history-list.tsx`).
- **Feature list** — Feature body (`feature-list.tsx`): the whole feature in flow order as a nav list; the viewer feature view is the expanded read.
- **Board list** — Board body (`board-list.tsx`): the todo/doing/done cards.
- **Terminal list** — Terminal body (`terminal-list.tsx`): the roster of terminal **sessions** (they outlive their tabs — a closed tab keeps the PTY running).

**Inside the viewer:**
- **Tab bar** — the floating glass capsule of open documents (`tab-bar.tsx`).
- **Tab** — one open document. **Preview** = single-click, italic, replaced by the next; **pinned** = double-click/edit, kept.
- **Split view / pane** — two side-by-side **panes**, each its own tabs (`panes`/`activePaneIndex` in `stores/tabs.ts`); "Open to the Side". Model in `architecture` (Routing).
- **Tab kinds** — `file view` / `source view` (`source-view.tsx`) / `markdown reader` (`markdown-view.tsx`) / `diff view` (`diff-view.tsx`) / `commit view` (`commit-view.tsx`) / `search view` (`search-view.tsx`) / `feature view` (`feature-view.tsx`) / `explore view` (`explore-view.tsx`) / `board view` (`board-view.tsx`) / `terminal view` (`terminal-view.tsx`). What each renders → read the file; the concepts → `product`.

**Inside Quick Access** (section follows the sidebar tab):
- Files → **Pinned** (`pinned-group.tsx`) + **Notes card** (`notes-card.tsx`), in `files-quick-access.tsx`.
- Search → **Recent searches** (`search-quick-access.tsx`).
- Changes/History/Feature → **Quick commands** (`quick-commands-group.tsx`): a **Suggested** card over the **Commands** grid.
- Changes/Feature → **Commit composer** (`commit-group.tsx`) + **Comments** (`comments-group.tsx`).
- Terminal → **Actions** (`actions-group.tsx`).

**Overlays:**
- **File finder** — Cmd+P fuzzy finder (`file-finder.tsx`).
- **Find bar** — Cmd+F in-viewer search (`find-bar.tsx`).
- **Settings** — gear → `settings-dialog.tsx` (General · Review flow · Agents · Updates).
- **Welcome screen** — the no-repo / repo-picker state (`welcome.tsx`).

**Cross-cutting vocabulary** (the *what* and *why* live in `product`; channel internals + traps in `architecture`/`audit`):
- **Flow / flow layers** — the architectural-layer grouping of changes (entry-point → data); the heart of "review as a story".
- **Feature view / review set** — the change widened to the whole feature; files tagged **changed** / **context** (import-reached baseline) / **shipped** (agent-declared cross-seam). The review set is the agent-fed manifest (`~/.porcelain/review-sets.json`).
- **Review comments** — the reviewer's line/file notes (`~/.porcelain/comments.json`), app→agent over MCP.
- **Reviewed marks** — the per-file "reviewed" checkboxes the human ticks in the Changes/Feature lists (`~/.porcelain/reviewed.json`), app→agent over MCP (read-only, like notes); cleared on commit.
- **Project board** — per-repo todo/doing/done (`~/.porcelain/board.json`), two-way over MCP.
- **Embedded terminal / Actions** — real PTYs (node-pty + xterm.js) on a dedicated `window.porcelain.terminal` bridge (not tRPC). **Actions** = saved named commands (`~/.porcelain/actions.json`); agent curates, **human runs**.
- **Repo / worktree / window** — one repo per window; the worktree switcher sits in the sidebar footer.
- **Glaze / glaze tile / vibrancy void** — the design-system glass surfaces (floating porcelain tiles over the vibrancy void).
