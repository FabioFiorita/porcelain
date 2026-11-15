---
route: /$projectId/$worktreeId
selectors:
  - 'Worktree navigator and document panes'
  - 'Open documents'
  - 'Open document list'
  - 'Compare'
  - 'Uncommitted'
  - 'Branch'
tests:
  - apps/web/spec/e2e/workspace-shell.e2e.ts
api:
  - GET /api/inventory
  - GET /api/worktrees/:worktreeId/text
---

# reviews.workspace-shell

The navigator keeps the user's chosen pixel width when the window changes size. A temporary width constraint does not replace that preference. Document tabs have a separate document menu and a divider before trailing controls; every open document remains reachable at narrow widths. Compact comparison icons retain selected-tab semantics and disclose their names and current selection on hover or keyboard focus.

## How to get to it (user POV)

- Open any registered worktree and drag the divider between its navigator and documents, or focus the divider and resize with the keyboard.
- Open several files from Review → Files, then use the down-chevron button "Open document list" beside the tabs. The menu lists all documents, shows the selected document, and keeps full paths available when labels are clipped in the strip.
- Select Changes to reach the Uncommitted/Branch comparison controls. Hover or focus each compact icon to read its tooltip.

## Driving it with browser

Preconditions: [surface baseline](README.md). Use one running disposable instance.

1. At 3440px, drag the navigator to 220px. Resize to 900px, 1100px, then 3440px without dragging again. Measure the navigator after each step: it stays within 1px of 220px. Capture the same top-left region before and after the cycle.
2. Set a deliberate 420px width. Shrink to 800px so the document minimum temporarily limits the navigator. Grow to 3440px: the navigator returns to 420px. Focus the navigator divider and press Home; the resulting 220px choice survives another 1100px → 3440px cycle.
3. Open three long-named files. At 1100px and 900px, activate Changes. Capture the tab strip: a visible divider and gap separate its document menu from comparison/Git controls, and tabs stay inside their own viewport.
4. Open "Open document list" by mouse. Every file has its full path, and Changes has its selection mark. Choose the first file: the menu closes, and its existing tab becomes selected and is revealed inside the tab viewport. Pin it using its existing context menu. Focus the document-list button, press ArrowDown, use End and Enter to select the last file. Its tab becomes selected. Close it through its existing tab control; open the pinned file to the side and verify the right pane's selected tab.
5. At 900px with Changes active, inspect Compare: Uncommitted is selected. Hover it: tooltip "Uncommitted (current comparison)" is visible below the controls. Move the pointer away, focus Branch: tooltip "Branch" appears. Activate Branch, move away and hover again: tooltip "Branch (current comparison)"; Compare's description names Branch. Capture the tooltip with the compact selected control visible.
6. Repeat the resize cycle in disposable macOS Electron using native maximize/unmaximize, including the identical-size before/after screenshot. Shared Chromium proof alone does not establish native window behavior. Check a phone-width workspace still uses its navigator sheet and that document-menu selection works there.

## Gotchas

- The document menu deliberately lists every tab whenever multiple documents are open; it remains stable while scrolling and avoids hiding its trigger as the viewport changes. Pin, close, close others/unpinned and split actions remain on the existing tab controls and context menus.
- Pixel preference lasts for the mounted workspace; this does not add saved cross-session sidebar sizing.
- Read geometry after layout settles. The group callback distinguishes direct user input from automatic resizes, so a temporary clamp must not be saved as a new preference.
- Record actual dimensions, theme, connection and screenshots. This map is a recipe, not runtime evidence.
