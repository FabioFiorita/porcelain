# App shell — traps & decisions

- **One Hub window.** The shell stays up with Home, Project, or Worktree selected. Viewer tabs
  keep an explicit Environment + Project + Worktree target **and** query that Worktree's checkout;
  switching selection retargets the sidebar (Files, Changes) but does not close or retarget open
  tabs. Hub selection, Viewer tabs, and the open Surfaces strip persist in `localStorage`
  (`porcelain-hub-selection`, `porcelain-viewer-tabs`, `porcelain-surfaces`) so a refresh lands
  back in the same checkout with the same files open. Git status is not part of that snapshot.
  A persisted Worktree that is gone from inventory falls back to Home, then to the last recents
  checkout. The browser keeps a live session for the serving daemon plus every configured Environment;
  each target's Files, Git, Search, Actions, and terminal traffic stays on its owner's session.
  The daemon router is still stateless — procedures take `repoPath` — and per-connection concerns
  live on the WS **session** keyed by a structural sender, not a `WebContents`. The lone procedure
  needing the calling window (`windowInit`) lives on the shellRouter. Ordinary context switching
  does not open a new window.
- **Window-targeted vs broadcast:** watcher events target the session that registered the watch;
  agent-channel app-events **broadcast**, because each window invalidates only its own repo-keyed
  query so cross-window delivery is a harmless no-op refetch. **Don't add a window→repo registry to
  "fix" it.** `close-tab` / `update-status` / `maximized-changed` are shell events, never daemon
  events; the last is window-targeted because it's about ONE window's state.
- **TRAP — `windowInitFor` must stay an IDEMPOTENT read (do NOT delete-on-read):** the boot effect
  runs under `StrictMode`, so a one-shot read lets the second boot fall back to `restore` and clone
  the last repo. Pending init is cleaned up on window *close*.
- **macOS menu:** keep the `editMenu` role (a custom menu strips ⌘C/V from inputs) and keep
  reload/devtools **dev-gated** (prod deliberately ignores ⌘R). `electron-devtools-installer` stays a
  **devDependency** — it must not ship.
- **Chrome heights are coupled in Electron.** The native shell titlebar, navigation/surface
  headers, and viewer header are `h-12`, and `trafficLightPosition` is tuned to that 48px row. The
  browser client has no duplicate titlebar row: its navigation starts at the top. The Viewer tab
  strip is a separate `h-9` row below the header. Change the Electron titlebar height and the
  traffic lights drift.
- **The two floating sidebars are pushed below the native titlebar only in Electron, with `md:`
  classes and never an inline style** — shadcn pins their container to the full viewport, and the
  mobile Sheet reuses the same props, so an inline offset makes the drawer begin 3rem below the
  viewport. The browser variant starts at the top. The center `SidebarInset` is `h-full`, not
  `h-screen` (which overflowed 48px past the bottom).
- **Window chrome is platform-split; traffic lights are macOS-only.** Linux/Windows get
  `frame: false` and a renderer-drawn `WindowControls` calling shell procedures that act on the
  calling window. The maximize glyph must track OS-driven state (WM shortcut, drag-region
  double-click), hence the `maximized-changed` event.
- **Collapse-all is a nonce, not a store of expanded paths.** Expansion is per-`DirNode` local state
  because the tree reads lazily, so collapse-all bumps `collapseNonce` and nodes collapse in an effect
  keyed on it (skipping mount, so a reveal-expanded node isn't snapped shut). **Don't add a central
  expansion store to "fix" this.**
- **Resize handles write the CSS variable (or the terminal panel's `height`) directly during the
  drag and commit to the store only on mouseup** — a store write per `mousemove` re-renders the
  whole app. The bottom terminal strip uses the same grab as the sidebars (`row-resize` on its
  top edge).
- **`VirtualRows` is fixed-height by default — the perf invariant.** File/diff/source viewers MUST
  stay fixed-height (measuring every row is what the virtualizer exists to avoid). The lone opt-in is
  `dynamicHeight`, used only by the small, sliced reading surface; it also publishes the viewport
  width as `--vrows-vw` straight to the DOM in a `ResizeObserver` (the resize-handle trick) so a
  wrapping row sizes to the viewport, not the `w-max` content. Don't enable it on a large surface.
- **Two nested SidebarProviders**; the inner takes `shortcut="."` so both don't grab ⌘B. The Viewer
  header's two toggle icons are **deliberately directional** (`PanelLeft` / `PanelRight`) and
  each toggle must drive its own provider (`toggleSidebar` for the left navigation, the inner
  provider's toggle for the right surfaces). Do not write only the desktop preference: below the
  mobile breakpoint the shell is a Sheet driven by `openMobile`, and flipping only the desktop
  flag leaves it closed.
- **The left navigation is navigation-only.** There is no standalone Environment row in the web
  client; each Project header carries the current Environment name as a non-interactive badge.
  Project headers only expand or collapse; Worktree rows are the navigation targets. Each Project's
  branch-plus control opens the ref-aware New Worktree dialog, and the old branch/worktree footer
  controls are gone. Files, Changes, History, Git, Search, and Canvas are the visible right-side
  surfaces; Review is the structured Canvas template rather than a sidebar surface. Tasks lives
  on the left rail (daemon-wide) and opens the Viewer table. Retired Board and Notes data has no
  shell surface. Surface list rows open detail in the central Viewer. Actions stay in the Viewer
  header; Git commands and the commit composer live on the Git surface.
- **Canvas is a daemon-root surface, not a repo one.** `CanvasList`
  (`features/projects/canvas-list.tsx`) lists the selected Project's Canvases in the surfaces
  sidebar, and a row opens a `canvas` tab whose Viewer content is `CanvasView`
  (`features/projects/canvas-view.tsx`). A markdown Canvas renders through `MarkdownView`; an HTML
  one loads a freshly minted `GET /canvas/<token>` URL in an iframe with `sandbox="allow-scripts"`
  and nothing else — no `allow-same-origin`, so the document gets an opaque origin with no reach
  into the app's storage or daemon token. That sandbox also denies top-level navigation and popups,
  so the frame's bootstrap `postMessage`s every link click up to `CanvasView`, which opens the href
  with `window.open` — the shell navigates, never the frame. The records themselves live in the
  daemon's `$PORCELAIN_HOME` (`apps/daemon/src/features/projects/canvas-store.ts`, ADR 0002), so a
  Canvas outlives the checkout that authored it; agents write them with `porcelain canvas set` /
  the `porcelain_context` MCP tool (`apps/daemon/src/net/mcp/mcp-handlers.ts`).
- **Phone is "quick look", not a full workspace** (iPad ≥768 keeps the desktop floating layout).
  Below 768px both sidebars become Sheets. The left navigation sheet auto-closes when the active
  viewer tab changes; force unified diffs (split needs two columns); the browser has no native
  titlebar row; safe-area padding. Deliberately **not** a touch redesign of every surface —
  glanceable review, not an iPhone IDE.
- **One opaque design — the glaze glass system is DELETED.** The app targets a plain browser as a
  first-class client, and neither it nor Linux Electron can do macOS vibrancy — a glass design that
  works on one target isn't one design. `.glaze-*`, the `--surface-*`/`--hover-fill`/`--selected-fill`
  tokens, and window vibrancy are gone; don't reintroduce a `Surface` wrapper or a glass material.
  **One carve-out:** the preset ships translucent menus and was taken as-is; that licenses no new
  glass elsewhere. The Porcelain tokens block layers ONLY semantic/diff/ink colors, so it survives a
  preset re-apply.
- **Surface recipes.** Raised = `rounded-* border bg-card`; recessed wells = `rounded-lg border
  border-border/60` + `bg-muted`; settings groups = `rounded-md border bg-muted/40` (never per-row
  `bg-card` pills). Row/card action classes live in `lib/controls.ts` — prefer them over one-off size recipes. Don't inline into vendored `ui/button.tsx` (re-apply overwrites it). **TRAP — always pair a text size with its `md:` twin** when overriding the
  vendored Input: it ships `md:text-sm` for the iOS zoom-safe base, so without the twin desktop keeps
  `sm`.
- **One interaction language:** `bg-accent` (or `bg-sidebar-accent`) = lit/selected, `bg-accent/50` =
  resting hover, everywhere. These are the preset's own tokens, **not** re-pointed by the Porcelain
  block, so a re-apply is safe. Never invent a fresh opaque shade. `--muted` backs *static* surfaces.
- **No decorative accent — color only for meaning.** The only surviving color is functional: git +/−,
  file-type icons, folder/status hues, terminal ANSI. Don't reintroduce a CTA accent.
- The file viewer stays a plain textarea over a Shiki backdrop — no CodeMirror/Monaco,
  autocomplete/rename/format (those make it an editor).
- **The editor adopts external file changes ONLY when clean** — `EditorSource` reloads from a changed
  prop only if there are no unsaved edits; mid-edit the user's text wins. Don't make it always adopt
  (clobbers edits) or never adopt (the stale-view bug this fixed).
- **Markdown reader is NOT virtualized** — never route code files through it. Reader links get
  `target="_blank"` → `setWindowOpenHandler`, gated by `isSafeExternalUrl`.
- **HTML files open in a built-in sandboxed preview**, same `sandbox=""` as the Review's diagram and
  evidence iframes — never add allow-* tokens.
- Base UI requires `DropdownMenuLabel` inside `DropdownMenuGroup`, or it throws `MenuGroupContext
  missing`.
- **Tree Delete = the `trash` npm package** (recoverable), never a permanent unlink; the one
  destructive tree action, so it confirms via an `AlertDialog`.
- **Agent channels are watched JSON under `PORCELAIN_HOME`, driven by the dependency-free porcelain
  MCP tools.** Read `apps/daemon/src/net/mcp/` and the operations behind it for the current set — an enumeration here rots.
  **Do not re-add a Porcelain MCP server** without reopening the channel design. Channel write-safety
  rules live with the MCP and Project Data owners; read `docs/internals/agent-foundations.md` before
  touching any channel file.
- Flow grouping is built into the daemon; there is no repo-local layer file.
- **Explore's flow reading is a heuristic, not an index** — relative imports only, so it won't cross
  the client→server seam. That gap is what the agent's `shipped` files fill.
