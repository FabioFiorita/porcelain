---
screen: /
selectors:
  - 'Porcelain'
  - 'Worktrees by review status'
  - 'Select a worktree'
  - 'Open documents'
  - 'Show panel'
  - 'Hide panel'
  - 'Show sidebar'
  - 'Hide sidebar'
  - 'Computers'
  - 'Add computer'
  - 'sidebar-settings'
  - 'settings-general'
  - 'settings-computers'
  - 'settings-development'
tests:
  - packages/client/src/features/projects/rules/workspace-selection.spec.ts
  - apps/mobile/src/shared/rules/document-tabs.spec.ts
  - apps/mobile/src/shared/rules/workspace-documents.spec.ts
api: []
---

# app.tablet-shell

iPad keeps worktree navigation, central document tabs and an independently controlled right panel, with adaptive narrow panes.

## How to get to it (user POV)

- launch the app on an iPad

## Driving it with agent-device

Preconditions: [surface baseline](README.md).

1. Launch on iPad. No saved workspace shows Select a worktree and sidebar guidance; no paired computer offers Open Settings. Pair, select a worktree and expect the pinned Review or Changes tab, Files panel and panel rail. Follow [workspace](app.workspace.md) for document sessions.
2. In landscape hide/show sidebar and panel independently. Tabs/document/mode stay selected. Portrait: the panel buttons move into the bar and open a native sheet; choosing a document closes the sheet. Landscape docks the panel beside the page. Rotate/resize across the compact breakpoint: no stale width or invisible touch blocker.
3. Record sidebar opening, closing, reversing mid-animation and rapid toggles: one continuous clipped edge, no flash/overlap, latest requested state wins. Reopen: expansion/scroll stay. Hidden rows receive neither touches nor accessibility focus. Change Reduce Motion while running: transitions settle immediately. Repeat with larger Dynamic Type and distinct Show/Hide sidebar and panel labels.
4. Open Settings with sidebar open: the workspace sidebar hides, and the page bar shows Settings / General plus Close Settings. Close returns to the retained workspace and restores sidebar visibility. Wide: 224-point category pane/full-height divider; narrow: categories above detail. Switch General, Computers, Development; previews and controls stay bounded, without overlapping system controls.
5. Return to the worktree, switch away/back and cold-launch; inspect its session using [workspace](app.workspace.md).

Automated coverage: `workspace-selection.spec.ts`, `document-tabs.spec.ts`, `workspace-documents.spec.ts`.

## Gotchas

- Workspace header persists in loading/error/empty/unavailable states. Settings has one page bar; child routes/sheets keep Back/Done.
- Sidebar and panel controls target different panes. Embedded Files creation stays in the panel body. Phones keep native tabs/routes.
