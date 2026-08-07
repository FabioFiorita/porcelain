# Nomenclature

The lookup table for bare nouns. When the human says one, act on that region — don't re-ask. The file in
parens is the **entry point**; read it for mechanics.

**Shell regions (outside-in)**

| Term | Entry | Note |
|---|---|---|
| Top bar | `title-bar.tsx` | The full-width titlebar. **Not** the viewer's header (`TopBar` in `app-shell.tsx`) |
| Environment switcher | `environment-switcher.tsx` | **Always rendered, local or remote** — a Remote-only chip couldn't be how you *go* remote. Static label in the browser |
| Sidebar (unqualified = left) | `app-sidebar.tsx` | Icon rail + content panel (⌘B); footer = branch chip + worktrees picker |
| Viewer | `shell/viewer.tsx` | The central panel. **Never "editor"** |
| Quick Access | `right-sidebar.tsx` | The right panel (⌘.); contents follow the active sidebar tab |

**Sidebar tabs** — Files · Changes · Review · History · Search · Board · Terminal (review-loop order,
⌘1–7; the Review tab's stored pref id is still `feature`).

| Term | Entry | Note |
|---|---|---|
| File tree | `file-tree.tsx` / `tree-node.tsx` | |
| Search list | `search-list.tsx` | `gitSearchCode`; distinct from the ⌘⇧F `ContentSearch` overlay (`gitGrep`) |
| Changes list | `changes-list.tsx` | Grouped by flow layer |
| History list | `history-list.tsx` | |
| Feature list | `feature-list.tsx` | Header + file outline. **Intent/Execution/Evidence live only in the viewer canvas** |
| Review inbox | `review-inbox.tsx` | Other worktrees with work awaiting review; rows from `worktree-inbox.ts` |
| Board list | `board-list.tsx` | todo/doing/done cards |
| Terminal list | `terminal-list.tsx` | Roster of **sessions** — they outlive their tabs |
| Key bar | `terminal-key-bar.tsx` | Above the terminal pane; coarse-touch only, never a Settings option |
| Selection Copy | `terminal-selection-toolbar.tsx` | Host clipboard via `copyText`, not OSC 52 |

**Inside the viewer**

| Term | Entry | Note |
|---|---|---|
| Glance | `glance-home.tsx` | Companion home an empty pane renders with a repo open |
| Tab bar / Tab | `tab-bar.tsx` | Preview = single-click, italic, replaced; pinned = double-click/edit |
| Split view / pane | `stores/tabs.ts` | Two panes, each its own tabs; "Open to the Side" |
| Tab kinds | `viewer.tsx` switch | file / source / markdown reader / html preview / diff / commit / review / search / feature / explore / board / terminal. **The `feature view` IS the Review canvas** |

**Inside Quick Access** (section follows the sidebar tab)

| Sidebar tab | Quick Access |
|---|---|
| Files | Pinned + Notes card |
| Search | Recent searches |
| Changes / History / Feature | Quick commands — a Suggested card over the Commands grid |
| History | File timeline (`gitFileLog --follow`) |
| Changes / Feature | Commit composer + Comments |
| Terminal | Actions |
| Board | Focus — full detail of the selected card; selection is client-only, **not** a second kanban |
| Feature | **Current review + Previous reviews** (`review-group.tsx` + Comments) — archive the active unit; restore or trash archives under `.porcelain/reviews/` |

**Overlays:** file finder (⌘P) · find bar (⌘F) · Settings (`settings-dialog.tsx` — General · **Data**
· Companion · Share · Remotes · Review flow · Updates) · welcome screen. **Data** owns what git
carries (`data-section.tsx`, every client); **Companion** is the agent-skill installer only and is
shell-only. Mobile mirrors General · Data · Review · Environments.

**Cross-cutting** (product meaning: `docs/product.md`; internals here and in `audit`)

| Term | Meaning |
|---|---|
| Flow / flow layers | Architectural-layer grouping of changes (entry-point → data); the heart of "review as a story" |
| The Review (feature view / review set) | One unit-of-work story as a three-tab canvas: **Intent** (thesis + walkthrough prose, optional freeform HTML), **Execution** (agent-listed files + notes, not the working tree), **Evidence**. Files tagged **changed** / **context** / **shipped**. Active: `<repo>/.porcelain/review.json`; archives under `.porcelain/reviews/<id>/`. Product language is **Review**; code may keep `feature` ids |
| Evidence | Agent-authored *proof the loop closed*: structured checks + a Results document set + an image gallery under `<repo>/.porcelain/active-review/evidence/` (gitignored by default); archives with the review |
| Review comments | The reviewer's line/file notes (`.porcelain/comments.json`), app→agent via the CLI |
| Reviewed marks | Per-file "reviewed" checkboxes (`.porcelain/reviewed.json`), app→agent, read-only like notes |
| Project board | Per-repo todo/doing/done (`.porcelain/board.json`), two-way via the CLI; share via git |
| Actions | Saved named commands (`.porcelain/actions.json`); agent curates, **human runs** |
| Project companion | Repo-local `.porcelain/` (board, actions, scope, layers, notes, reviews). Machine secrets stay in `~/.porcelain` / `PORCELAIN_HOME`. One-way migrate from home on first open |
| Daemon | The headless Electron-free backend (`apps/daemon/src/server.ts`) the web client reaches over HTTP + one WS; the shell spawns and babysits it (`apps/desktop/src/main/daemon.ts`). "The daemon" always resolves here |
| Surface language | The opaque design: raised = cards, recessed = wells, hover/selected = `bg-accent`/`bg-accent/50`. Menus are the one translucent exception. ONE design serves Electron and the browser alike |
