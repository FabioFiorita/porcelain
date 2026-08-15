# Nomenclature

The lookup table for bare nouns. When the human says one, act on that region — don't re-ask. The file in
parens is the **entry point**; read it for mechanics.

**Shell regions (outside-in)**

| Term | Entry | Note |
|---|---|---|
| Top bar | `title-bar.tsx` | Electron-only native shell titlebar. Browser clients start with the navigation sidebar; this is **not** the viewer header |
| Environment switcher | `environment-switcher.tsx` | Native-shell control for moving between Environments. The browser has one bound Environment and identifies it with a badge on each Project header |
| Hub inventory | `hub-tree.tsx` | Live Project → Worktree tree with the current Environment shown as a Project badge. Project headers collapse; Worktree rows navigate; there is no Delete Worktree control |
| Hub selection | `hub-selection.ts` | Home · Project · Worktree. Viewer empty state shows the matching summary; open tabs keep the Worktree they were opened against and read that checkout, not the newly selected one |
| Sidebar (unqualified = left) | `app-sidebar.tsx` | Navigation-only Project → Worktree tree (⌘B); Settings is in the footer |
| Viewer | `shell/viewer.tsx` | The central panel. **Never "editor"** |
| Companion | `right-sidebar.tsx` | The right panel (⌘.); statically titled "Companion" on every tab — no more per-tab retitling. Orientation comes from section labels, which follow the active sidebar tab. Three other things share the word: the Settings tab, the mobile column/sheet, and the repo-local `.porcelain/` project companion — see the Overlays row and Cross-cutting table below |

**Sidebar tabs** — Files · Changes · Review · History · Search · Tasks · Board · Terminal
(review-loop order, ⌘1–7; the Review tab's stored pref id is `review`).

| Term | Entry | Note |
|---|---|---|
| File tree | `file-tree.tsx` / `tree-node.tsx` | |
| Search list | `search-list.tsx` | `gitSearchCode`; distinct from the ⌘⇧F `ContentSearch` overlay (`gitGrep`) |
| Changes list | `changes-list.tsx` | Grouped by flow layer |
| History list | `history-list.tsx` | |
| Review list | `review-list.tsx` | Header + file outline. **Intent/Process/Execution/Evidence live only in the viewer canvas** |
| Review inbox | `review-inbox.tsx` | Other worktrees with work awaiting review; rows from `reviewInbox` (`list-review-inbox.ts`) |
| Tasks list | `tasks-list.tsx` | Compact read of the daemon-wide table; opens the Viewer table |
| Board list | `board-list.tsx` | todo/doing/done cards — **retiring**, replaced by Tasks (#28) |
| Terminal list | `terminal-list.tsx` | Roster of **sessions** — they outlive their tabs |
| Key bar | `terminal-key-bar.tsx` | Above the terminal pane; coarse-touch only, never a Settings option |
| Selection Copy | `terminal-selection-toolbar.tsx` | Host clipboard via `copyText`, not OSC 52 |

**Inside the viewer**

| Term | Entry | Note |
|---|---|---|
| Glance | `glance-home.tsx` | Companion home an empty pane renders with a repo open |
| Tab bar / Tab | `tab-bar.tsx` | Preview = single-click, italic, replaced; pinned = double-click/edit |
| Split view / pane | `stores/tabs.ts` | Two panes, each its own tabs; "Open to the Side" |
| Tab kinds | `viewer.tsx` switch | file / source / markdown reader / html preview / diff / commit / review / search / explore / board / tasks / terminal / canvas. **The `review` tab kind IS the Review canvas**; the `tasks` tab kind carries NO Hub target — the table spans every Environment |
| Tasks table | `tasks-view.tsx` | Quick Add · column picker · the table. Rows are labelled with the Environment that owns them; every mutation names that Environment |

**Inside Companion** (sections follow the sidebar tab; the panel title itself never changes)

| Sidebar tab | Companion sections |
|---|---|
| Files | Pinned · Notes |
| Changes | Suggested · Commands · Commit · Comments |
| History | Suggested · Commands · File timeline (`gitFileLog --follow`) |
| Review | **Current review · Previous reviews** (`review-group.tsx`; always rendered, empty note when there are none) · Comments — archive the active unit; restore or trash archives under `.porcelain/reviews/` |
| Tasks | (none — the table is the whole surface; Quick Add lives above it, not in Companion) |
| Board | Focus — full detail of the selected card; card status shows inside the card, not a Board-tab-only affordance. Selection is client-only, **not** a second kanban |
| Terminal | Saved commands — the "Actions" feature (`.porcelain/actions.json`, see Cross-cutting below) surfaced under this section label |
| Search | Recent searches |

Suggested/Commands render only on Changes and History — Review does not get them (it gets Current/Previous review instead).

**Overlays:** file finder (⌘P) · find bar (⌘F) · Settings (`settings-dialog.tsx` — General · **Data**
· Companion · Share · Remotes · Review flow · Updates). **Data** owns what git
carries (`data-section.tsx`, every client); this Settings **Companion** tab is the agent-skill
installer only and is shell-only — do not confuse it with the right-panel **Companion** (⌘.) above.
Mobile mirrors General · Data · Review · Environments.

**Cross-cutting** (product meaning: `docs/product.md`; internals here and in the owner map)

| Term | Meaning |
|---|---|
| Flow / flow layers | Architectural-layer grouping of changes (entry-point → data); the heart of "review as a story" |
| The Review (active review / review set) | One unit-of-work story as a four-tab canvas: **Intent** (thesis + authored intent documents, optional freeform HTML), **Process** (walkthrough prose and diagrams), **Execution** (agent-listed files + notes, not the working tree), **Evidence**. Files tagged **changed** / **context** / **shipped**. Active: `<repo>/.porcelain/review.json`; archives under `.porcelain/reviews/<id>/`. Product language and code are both **Review**: REV-009 cut the wire, the clients, and the CLI over to one canonical vocabulary (`activeReview`, `reviewReading`, `reviewInbox`, `archiveReview`, `publishCost`, `reviewEvidence`, `clearEvidence`, `setReviewed`) and `scripts/lint-legacy-migrations.mjs` fails the build if a Feature-era name regrows |
| Evidence | Agent-authored *proof the loop closed*: structured checks + a Results document set + an image/video/link gallery under `<repo>/.porcelain/active-review/evidence/` (gitignored by default); archives with the review |
| Review comments | The reviewer's line/file notes (`.porcelain/comments.json`), app→agent via the CLI |
| Reviewed marks | Per-file "reviewed" checkboxes (`.porcelain/reviewed.json`), app→agent, read-only like notes |
| Project board | Per-repo todo/doing/done (`.porcelain/board.json`), two-way via the CLI; share via git |
| Actions | Saved named commands (`.porcelain/actions.json`); agent curates, **human runs** |
| Project companion | Repo-local `.porcelain/` (board, actions, scope, layers, notes, reviews) — the third "companion": distinct from the right-panel **Companion** and the Settings **Companion** tab above. Machine secrets stay in `~/.porcelain` / `PORCELAIN_HOME` |
| Daemon | The headless Electron-free backend (`apps/daemon/src/server.ts`) the web client reaches over HTTP + one WS; the shell spawns and babysits it (`apps/desktop/src/main/daemon.ts`). "The daemon" always resolves here |
| Surface language | The opaque design: raised = cards, recessed = wells, hover/selected = `bg-accent`/`bg-accent/50`. Menus are the one translucent exception. ONE design serves Electron and the browser alike |
