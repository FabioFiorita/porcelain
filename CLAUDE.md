# Porcelain

Agent-managed foundations. This file owns project agent guidance; skills live in `.agents/skills/` and are symlinked into `.claude/skills/` for Claude discovery. Keep them accurate and never let the codebase diverge from them. `AGENTS.md` is a symlink to this file. **Keep this file slim — it loads into every session. Detail belongs in skills (loaded on demand).**

Porcelain is a lightweight macOS viewer + agent companion (Electron). Not an editor.

## Hard rules

1. **One architecture — but think freely.** Default to the existing pattern (state, data fetching, IPC shape, component/test style): check the `architecture` skill and match what's there, so the codebase stays uniform. But if you think a genuinely better approach exists, **propose it with the tradeoff before building** — don't silently fork the architecture, and don't be timid about suggesting one. The failure state is *two patterns nobody chose*; a considered switch (recorded in the home skill) is not. Outside-the-box thinking is wanted — it just gets surfaced, not smuggled in.
2. **Match the local idiom.** When you write code, make it read like the code around it — naming, test shape, file layout, commit format. This is small-scale consistency (so the result looks like one author), not a constraint on *what* you build.
3. **Verification gate before any commit:** `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
4. **Docs say what the code can't.** A skill carries decisions, the *why*, the deliberately-absent, and the traps — **not** a paraphrase of how a file works today. For current mechanics, read the file (it never goes stale); the skill points you to the entry file and tells you what a fresh read won't. So: when you change a decision or hit a new trap, update its home skill in the same commit; when you find a skill describing mechanics the code already shows, *cut it*; and prefer enforcing a rule in Biome over writing it in prose (a lint rule can't rot or be ignored). No decision log, no redundant guides.
5. **shadcn primitives only.** Always use shadcn components for UI primitives; never hand-roll one (sidebar, tabs, dialogs, trees, etc.). If a needed primitive doesn't exist in shadcn/registries, **get the user's approval before building it**.
6. **Let type-safety drive the design.** When types fight you, change the design — don't escape it. `any` is already a Biome error (the gate enforces it), so this rule is the half lint can't: reach for the safer shape (e.g. tRPC over a hand-rolled bridge) instead of an `as unknown as` cast (banned repo-wide).
7. **No `void` on promises.** Never write `void somePromise()` to silence floating promises — use `async`/`await` (or `await Promise.all([...])` when batching). Bare calls like `utils.foo.invalidate()` in sync handlers are fine when you truly don't need to wait.
8. **Commit straight to `main` — never create branches.** Solo developer; `main` is the only branch and committing directly to it (after the verification gate, hard rule 3) is safe and expected. Do NOT open `feat/*`/`fix/*` branches or PRs for changes, and do NOT branch just because you're on the default branch — keep everything on `main`. (This deliberately overrides the generic "branch off the default branch first" default.)

**Verifying live with computer-use:** run `pnpm dev` (opens the dev Electron on `~/Code/porcelain-playground` with isolated config) and request computer-use access for the **dev app — it shows up as "Electron"**, bundle id `com.github.Electron`. NEVER request the installed **"Porcelain"** app: that's the user's real work (their SOAPHEALTH repo) and it doesn't have your changes anyway. Screenshot/drive the dev "Electron" window.

## Skills (in `.agents/skills/`, symlinked at `.claude/skills/`)

Only each skill's one-line description loads up front; the body loads on demand when you read it. Read the relevant skill *before* acting in its area.

- `architecture` — stack, repo facts, aliases, conventions, app shell, client architecture. **Read before writing or reviewing any code.**
- `product` — what Porcelain is, who it's for, core features, product principles. **Read before designing features/UI or prioritizing.**
- `audit` — the security/correctness/performance/type invariants the codebase must not regress, with file pointers. **Read before changing the main process, IPC, config persistence, git plumbing, file reads, external-URL handling, or packaging — and when reviewing a diff for regressions.**
- `releasing` — the runbook for cutting a signed + notarized release (bump/tag, the Actions pipeline, secrets, changelog). **Read when publishing a version or touching the release/signing setup.**
- `shadcn` — vendored UI-primitive skill (also in `.agents/skills/`).

Also available, but **not** vendored in this repo (globally installed, listed here only so you know they exist): `improve` (read-only senior-advisor audit harness → plans in `plans/`) and `frontend-design`.

## Nomenclature

Shared vocabulary so a bare noun ("improve the viewer", "the Changes tab is wrong") resolves to one place without asking. Each term maps to real code; when the user uses one, act on the named region — don't re-ask which one. The file in parens is the **entry point** — read it for current mechanics; the `architecture` skill holds the cross-cutting decisions and traps. This is the lookup table.

**Shell regions (the window, outside-in):**
- **Top bar** — the full-width window **titlebar** (`title-bar.tsx`): traffic lights on the left, a centered **search button** that raises the file finder (⌘K/⌘P) — nothing else. The viewer's own header (`TopBar` in `app-shell.tsx`, below the titlebar) carries the sidebar toggle + tabs + Update pill + Quick-Access bolt.
- **Sidebar** (unqualified = the **left** one) — `app-sidebar.tsx`; the navigation panel. Cmd+B. A vertical **icon rail** (project avatar on top, tab icons, settings gear at the bottom) sits beside the **content panel** (active tab's body); the panel's title bar holds a **contextual title** (Explorer / Source control / History / Feature review / Board / Terminal) with Files-only collapse-all + hide-files controls, and its footer holds a **branch chip (left) + worktrees picker (right)**.
- **Viewer** — the central panel (`shell/viewer.tsx`, everything under `components/viewer/`). The main content area; renders whatever the active tab is. **Never "editor"** — Porcelain is not an editor.
- **Quick Access** — the **right** panel (`right-sidebar.tsx`). Cmd+. — its contents follow the active sidebar tab.

**Inside the sidebar:**
- **Sidebar tabs** — the six: **Files**, **Changes**, **History**, **Feature**, **Board**, **Terminal** (`sidebarTab` pref; Cmd+1–6). They're a **vertical icon rail** on the left edge of the sidebar (monochrome, icon-only, tooltips carry the ⌘ shortcut), with the active tab's body in the **content panel** to its right; ⌘B collapses the panel to just the rail.
- **File tree** — Files tab body (`file-tree.tsx` / `tree-node.tsx`).
- **Changes list** — Changes tab body (`changes-list.tsx`), grouped by flow layer. Row click opens the diff; right-click → **Open file** opens the full file in the viewer and switches to the Files tab.
- **History list** — History tab body (`history-list.tsx`).
- **Feature list** — Feature tab body (`feature-list.tsx`): the whole feature in flow order as a navigation list (changed + context + agent-fed shipped, with source markers + notes); rows open the diff/file. The viewer's feature view is the expanded read.
- **Board list** — Board tab body (`board-list.tsx`): the todo/doing/done cards stacked by column (add/edit/move/delete per card); "Open board" opens the wide kanban in the viewer. Mirrors the Feature tab (list here, expanded view in the viewer).
- **Terminal list** — Terminal tab body (`terminal-list.tsx`): the roster of open terminal **sessions** (+ to spawn one; row opens/focuses its viewer tab; × kills it). Sessions outlive their tabs (a closed tab keeps the PTY running). Quick Access here is **Actions**.

**Inside the viewer:**
- **Tab bar** — the floating glass capsule of open documents (`tab-bar.tsx`).
- **Tab** — one open document. **Preview tab** = single-click, italic, replaced by the next preview; **pinned tab** = double-click or edit, kept.
- **Split view / pane** — the viewer can split into two side-by-side **panes**, each with its own tab bar and active tab (`panes`/`activePaneIndex` in `stores/tabs.ts`). Open via "Open to the Side" (file-tree row or tab); closing a pane's last tab collapses the split. The pane model is in the `architecture` skill (Routing).
- Tab kinds: **file view** / **source view** (`source-view.tsx`, editable) / **markdown reader** (`markdown-view.tsx`) / **diff view** (`diff-view.tsx`, working-tree) / **commit view** (`commit-view.tsx`, a historical commit) / **search view** (`search-view.tsx`, find-references results) / **feature view** (`feature-view.tsx`, the MCP-only inline reading surface — the whole feature in flow order showing just the relevant lines: diff hunks for changed files, symbol slices for context/shipped) / **explore view** (`explore-view.tsx`, a read-only feature flow seeded from a symbol or file and walked through imports — same sliced reading surface, opened via right-click "Explore flow from X" / "Explore feature flow") / **board view** (`board-view.tsx`, the wide todo/doing/done kanban, opened from the Board tab's "Open board") / **terminal view** (`terminal-view.tsx`, a live PTY via xterm.js — the xterm instance lives in `lib/terminal-registry.ts`, not React, so it survives tab switches; split-view = a second pane, each its own PTY).

**Inside Quick Access (section depends on the sidebar tab):**
- Files → **Pinned** (`pinned-group.tsx`) + **Notes card** (`notes-card.tsx`), wrapped in `files-quick-access.tsx`.
- Changes/History/Feature → **Quick commands** (`quick-commands-group.tsx`) + **Suggested** rows.
- Changes/Feature → **Commit composer** (`commit-group.tsx`).
- Changes/Feature → **Comments** (`comments-group.tsx`) — the reviewer's line/file comments, fed to the agent over MCP.
- Terminal → **Actions** (`actions-group.tsx`) — saved named commands; click runs one in a terminal.

**Overlays:**
- **File finder** — Cmd+P fuzzy finder (`file-finder.tsx`).
- **Find bar** — Cmd+F in-viewer search (`find-bar.tsx`).
- **Settings** — gear → `settings-dialog.tsx` (General · Review flow · Agents · Updates sections; Agents = `agents-section.tsx`, the Claude Code plugin install + Codex/Cursor placeholders).
- **Welcome screen** — the no-repo / repo-picker state (`welcome.tsx`).

**Cross-cutting concepts:**
- **Flow / flow layers** — the architectural-layer grouping of changes (entry-point → data); the heart of "review changes as a story".
- **Feature view / review set** — the change widened into the whole feature, flow-ordered. Files are tagged by **source**: **changed** (working tree), **context** (unchanged, reached by import — the no-MCP baseline), **shipped** (cross-seam files the agent declares). A **review set** is the agent-fed manifest (`~/.porcelain/review-sets.json`) written by the **MCP server** (`src/mcp/`, standalone stdio), distributed as a one-click **Claude Code plugin** (Settings → Agents). Opened from the Changes tab.
- **Review comments** — the reviewer's notes on a line range or a whole file (`~/.porcelain/comments.json`), added from the diff/source right-click ("Add comment" / "Comment on file") and listed in the Comments Quick Access section. The **MCP server** serves them to the agent (`get_review_comments`) and can mark them resolved (`resolve_review_comment`) — the agent-context counterpart to the feature review set, flowing app→agent.
- **Project board** — a per-repo todo/doing/done card board (`~/.porcelain/board.json`), in the **Board** sidebar tab (list) + a wide viewer **board view**. Two-way over the **MCP server**: the agent can `list_cards` / `create_card` / `update_card` / `move_card` / `delete_card`, so it reads what to build and reflects progress without the human spelling it out in chat.
- **Embedded terminal / Actions** — real PTYs (node-pty + xterm.js) in the **Terminal** sidebar tab + viewer terminal views; the byte stream rides a dedicated `window.porcelain.terminal` IPC bridge (not tRPC), PTYs in `terminal-manager.ts`. **Actions** are saved named commands (`~/.porcelain/actions.json`, the 4th two-way agent channel — `list/create/update/delete_action`); the agent curates them, the **human runs** them (no MCP run tool — see `audit`). Details in the `architecture` skill's Terminal subsystem.
- **Repo / worktree / window** — one repo per window; the worktree switcher sits in the sidebar footer.
- **Glaze / glaze tile / vibrancy void** — the design-system surfaces (floating porcelain tiles over the vibrancy void).
