# Nomenclature

The lookup table for bare nouns. When the human says one, act on that region — don't re-ask. The file in
parens is the **entry point**; read it for mechanics.

**Shell regions (outside-in)**

| Term | Entry | Note |
|---|---|---|
| Top bar | `title-bar.tsx` | Electron-only native shell titlebar. Browser clients start with the navigation sidebar; this is **not** the viewer header |
| Environment switcher | `environment-switcher.tsx` | Native-shell control for moving between Environments. The browser keeps the serving Environment plus configured remote sessions; **Settings → Remotes** adds and verifies client-token connections, and each Project carries its Environment badge |
| Hub inventory | `hub-tree.tsx` | Live Project → Worktree tree with the current Environment shown as a Project badge. Project headers collapse; Worktree rows navigate; there is no Delete Worktree control |
| Hub selection | `hub-selection.ts` | Home · Project · Worktree. Viewer empty state shows the matching summary; open tabs keep the Worktree they were opened against and read that checkout, not the newly selected one |
| Sidebar (unqualified = left) | `app-sidebar.tsx` | Navigation-only Project → Worktree tree (⌘B); Settings is in the footer |
| Viewer | `shell/viewer.tsx` | The central panel. **Never "editor"** |
| Companion | `right-sidebar.tsx` | The right panel (⌘.); statically titled "Companion" on every tab — no more per-tab retitling. Orientation comes from section labels, which follow the active sidebar tab. Three other things share the word: the Settings tab, the mobile column/sheet, and the repo-local `.porcelain/` project companion — see the Overlays row and Cross-cutting table below |

**Surface tabs** — Files · Changes · History · Search · Tasks · Canvas
(⌘1–5, ⌘7; Terminal is a bottom panel, not a sidebar surface).

| Term | Entry | Note |
|---|---|---|
| File tree | `file-tree.tsx` / `tree-node.tsx` | |
| Search list | `search-list.tsx` | `gitSearchCode`; distinct from the ⌘⇧F `ContentSearch` overlay (`gitGrep`) |
| Changes list | `changes-list.tsx` | Grouped by flow layer |
| History list | `history-list.tsx` | |
| Tasks list | `tasks-list.tsx` | Compact read of the daemon-wide table; opens the Viewer table |
| Terminal list | `terminal-list.tsx` | Roster of **sessions** — they outlive their tabs |
| Key bar | `terminal-key-bar.tsx` | Above the terminal pane; coarse-touch only, never a Settings option |
| Selection Copy | `terminal-selection-toolbar.tsx` | Host clipboard via `copyText`, not OSC 52 |

**Inside the viewer**

| Term | Entry | Note |
|---|---|---|
| Glance | `glance-home.tsx` | Companion home an empty pane renders with a repo open |
| Tab bar / Tab | `tab-bar.tsx` | Preview = single-click, italic, replaced; pinned = double-click/edit |
| Split view / pane | `stores/tabs.ts` | Two panes, each its own tabs; "Open to the Side" |
| Tab kinds | `viewer.tsx` switch | file / source / markdown reader / html preview / diff / commit / changeset / search / tasks / canvas. **Canvas is the primitive and the Review is a template on it** (ADR 0004); the `tasks` tab kind carries NO Hub target — the table spans every Environment. `explore` and `terminal` are retired by ADR 0005 — explore becomes a Canvas template, terminal becomes the bottom strip — and both still ship until phase two removes them |
| Tasks table | `tasks-view.tsx` | Quick Add · column picker · the table. Rows are labelled with the Environment that owns them; every mutation names that Environment |

**Inside Companion** (sections follow the sidebar tab; the panel title itself never changes)

| Sidebar tab | Companion sections |
|---|---|
| Files | Pinned |
| Changes | Suggested · Commands · Commit |
| History | Suggested · Commands · File timeline (`gitFileLog --follow`) |
| Tasks | (none — the table is the whole surface; Quick Add lives above it, not in Companion) |
| Terminal | Saved commands — the "Actions" feature (see Cross-cutting below), reachable from the Hub's top-corner Actions menu |
| Search | Recent searches |

Suggested/Commands render only on Changes and History.

**Overlays:** file finder (⌘P) · find bar (⌘F) · Settings (`settings-dialog.tsx` — General · **Data**
· Companion · Share · Remotes · Updates). **Data** owns what git
carries (`data-section.tsx`, every client); this Settings **Companion** tab is the agent-skill
installer only and is shell-only — do not confuse it with the right-panel **Companion** (⌘.) above.
Mobile mirrors General · Data · Environments.

**Cross-cutting** (product meaning: `docs/product.md`; internals here and in the owner map)

| Term | Meaning |
|---|---|
| Worktree profile | The pinned paths, hidden paths, and layer order belonging to one Worktree (ADR 0003). Agent-written through the companion skill and CLI, never inferred; the full tree stays reachable. Project-level values in `project.json` are the default it layers over |
| Flow grouping | Architectural grouping of Changes (entry-point → data). The layer sequence comes from the Worktree profile, not from a guess about framework conventions |
| The Review template | A Canvas template with four sections: **Intent**, **Process**, **Execution**, and **Evidence**, shipped in the companion skill. Not a structure in the product, not an active lifecycle, not a repo-local storage model; `porcelain review set` writes the daemon-root Canvas |
| Evidence | Agent-authored checks, Results, and image/video/link proof in the daemon-root Canvas bundle, plus the numbers that direct reading — coverage delta, mutation score, complexity, new dead code — carried as triage, never as a gate |
| Review annotations | Retired; shipped clients use the structured daemon-root Canvas |
| Tasks | The daemon-owned table for work across Projects and Environments; the shipped vocabulary replacing Board |
| Actions | Saved named commands, stored per Project in the owning daemon (`$PORCELAIN_HOME/projects/<projectId>/actions.json`, ADR 0002); agent curates, **human runs** against an explicit Environment + Worktree |
| Project companion | Repo-local `.porcelain/` only for explicit Git overlays; default Project data stays in the daemon-root store |
| Git overlay | The **promoted** half of `.porcelain/`: `canvases/<id>/` (bundle + `canvas.json`) and `project.json` (tracked `hiddenPaths`/`pinnedPaths`/`worktrees` defaults). Written only by an explicit promotion — `projects.promoteCanvas` / `promoteOverrides`, or `porcelain canvas promote` — never by opening a repo. Tracked wins over private for the same Canvas id, the daemon never writes back into it, and promotion writes plain files without staging or committing (ADR 0002, #26) |
| Promotion | Moving one private daemon-root Canvas, or the current Project defaults, into the Git overlay of an **explicitly named** Worktree checkout. The private copy is removed, not duplicated, so a tracked and a private version can never diverge. An ambiguous target is rejected (`projects.overlay-target-invalid`), never guessed |
| Daemon | The headless Electron-free backend (`apps/daemon/src/server.ts`) the web client reaches over HTTP + one WS; the shell spawns and babysits it (`apps/desktop/src/main/daemon.ts`). "The daemon" always resolves here |
| Surface language | The opaque design: raised = cards, recessed = wells, hover/selected = `bg-accent`/`bg-accent/50`. Menus are the one translucent exception. ONE design serves Electron and the browser alike |
