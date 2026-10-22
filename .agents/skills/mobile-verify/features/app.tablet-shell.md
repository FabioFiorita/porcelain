---
screen: /
selectors:
  - 'Porcelain'
  - 'Worktrees by review status'
  - 'Select a worktree'
  - 'Choose a document'
  - 'Open documents'
  - 'Show inspector'
  - 'Hide inspector'
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
  - apps/mobile/src/shared/rules/sidebar-transition.spec.ts
api: []
---

# app.tablet-shell

iPad keeps worktree navigation, central document tabs and an independently controlled right inspector, with adaptive narrow panes.

## Sub-features

- `app.tablet-shell` — Sidebar, inspector and central documents.

## How to get to it (user POV)

- launch the app on an iPad

## Driving it with agent-device

Preconditions: [surface baseline](README.md).

1. Launch on iPad. No saved workspace shows Select a worktree and sidebar guidance; no paired computer offers Open Settings. Pair, select a worktree and expect Files inspector, document header and Choose a document. Follow [workspace](app.workspace.md) for document sessions.
2. In landscape hide/show sidebar and inspector independently. Tabs/document/mode stay selected. Narrow: inspector replaces center; selecting a document or existing tab reveals content, and the inspector control remains reachable. Rotate/resize across the compact breakpoint: no stale width or invisible touch blocker.
3. Record sidebar opening, closing, reversing mid-animation and rapid toggles: one continuous clipped edge, no flash/overlap, latest requested state wins. Reopen: expansion/scroll stay. Hidden rows receive neither touches nor accessibility focus. Change Reduce Motion while running: transitions settle immediately. Repeat with larger Dynamic Type and distinct Show/Hide sidebar and inspector labels.
4. Open Settings with sidebar open: it stays open, one Settings toolbar, General selected. Wide: 224-point category pane/full-height divider; narrow: categories above detail. Switch General, Computers, Development; previews and controls stay bounded, without overlapping system controls or blue Hide sidebar text.
5. Return to the worktree, switch away/back and cold-launch; inspect its session using [workspace](app.workspace.md).

Automated coverage: `workspace-selection.spec.ts`, `document-tabs.spec.ts`, `workspace-documents.spec.ts`, `sidebar-transition.spec.ts`.

## Gotchas

- Workspace header persists in loading/error/empty/unavailable states. Settings has one native toolbar; child routes/sheets keep Back/Done.
- Sidebar and inspector controls target different panes. Embedded Files creation stays in the inspector body. Phones keep native tabs/routes.
