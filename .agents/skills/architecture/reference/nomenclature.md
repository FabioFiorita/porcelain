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
| Feature | **Reading companion only** (`review-group.tsx` + Comments) — deliberately not a clone of Changes' git commands/commit. "Clear review & evidence" is an inline button here |

**Overlays:** file finder (⌘P) · find bar (⌘F) · Settings (`settings-dialog.tsx` — General · Share ·
Remotes · Review flow · Updates) · welcome screen.

**Cross-cutting** (the *what*/*why* live in `product`; internals here and in `audit`)

| Term | Meaning |
|---|---|
| Flow / flow layers | Architectural-layer grouping of changes (entry-point → data); the heart of "review as a story" |
| The Review (feature view / review set) | One unit-of-work story as a three-tab canvas: **Intent** (thesis + walkthrough prose, optional freeform HTML/Excalidraw), **Execution** (agent-listed files + notes, not the working tree), **Evidence**. Files tagged **changed** / **context** / **shipped**. Manifest: `review-sets.json`. Product language is **Review**; code may keep `feature` ids |
| Evidence | Agent-authored self-contained HTML *proof the loop closed*; directory-on-disk under `loop-evidence/<key>/`; app write = clear only. Excalidraw is Intent-only. Ephemeral |
| Review comments | The reviewer's line/file notes (`comments.json`), app→agent via the CLI |
| Reviewed marks | Per-file "reviewed" checkboxes (`reviewed.json`), app→agent, read-only like notes |
| Project board | Per-repo todo/doing/done (`board.json`), two-way via the CLI |
| Actions | Saved named commands (`actions.json`); agent curates, **human runs** |
| Daemon | The headless Electron-free backend (`src/backend/server.ts`) the renderer reaches over HTTP + one WS; the shell spawns and babysits it (`src/main/daemon.ts`). "The daemon" always resolves here |
| Surface language | The opaque design: raised = cards, recessed = wells, hover/selected = `bg-accent`/`bg-accent/50`. Menus are the one translucent exception. ONE design serves Electron and the browser alike |
