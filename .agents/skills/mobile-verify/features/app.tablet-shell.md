---
screen: /
selectors:
  - 'Porcelain'
  - 'Projects and worktrees'
  - 'Select a worktree'
  - 'Choose a document'
  - 'Open documents'
  - 'Show inspector'
  - 'Hide inspector'
  - 'Environments'
  - 'Add environment'
  - 'sidebar-settings'
  - 'settings-appearance'
  - 'settings-environments'
  - 'settings-development'
tests:
  - packages/client/src/features/projects/rules/workspace-selection.spec.ts
  - apps/mobile/src/shared/rules/document-tabs.spec.ts
  - apps/mobile/src/shared/rules/workspace-documents.spec.ts
api: []
---

# app.tablet-shell

## What it is

On iPad, adaptive React Native panes compose Porcelain controls beneath the persistent document tab header. Native glass icon buttons flank the tabs; the workspace has no separate project-title toolbar. The left sidebar lists environments, projects and worktrees, with Settings at the bottom. The selected worktree has shared document tabs in the center and Files, Review and History modes in the right inspector. Glass toolbar buttons independently control the worktree sidebar and inspector. Entering Settings preserves the sidebar state. Phones retain their native tabs and Stack routes.

## How a user reaches it

- launch the app on an iPad

## Driving it

1. Launch on iPad. Expect Porcelain, the worktree navigator and Settings. With no saved workspace, expect Select a worktree and guidance to select it in the sidebar. With no paired environments, use Open Settings and follow access.pairing.
2. Choose a worktree from the sidebar. Expect its selected row in the navigator, Files in the right inspector, the document tab header and Choose a document in the central area. Follow app.workspace to open files, review comparisons and commits in one tab strip. No document selection pushes a native detail route.
3. Hide and show the sidebar and inspector separately. Expect tabs, active document and inspector mode to remain. Narrow the window: the inspector replaces the center in place; selecting a document reveals its central content. The header inspector control remains available to show the list again. Select an existing document tab while the narrow inspector is visible and expect its central content to be revealed.
4. Enter Settings with the app sidebar open. Expect it to stay open, one Settings toolbar and a bounded category pane. Appearance starts selected. On a wide screen the category pane is 224 points wide and a full-height divider separates it from the content; no redundant category heading is inserted above the settings. On a narrow screen the categories sit above the detail.
5. Select Appearance, Environments and Development. Follow preferences.appearance and access.settings. Development shows its component selector beside the preview. Show/hide the app sidebar and confirm Settings remains correctly positioned. In a window confirm system controls do not overlap Porcelain and no blue Hide sidebar text appears.
6. Return by selecting the worktree. Expect its tabs, active document, mode, comparison and inspector visibility to return. Switch worktrees and back; each retains its own transient session. A cold launch restores the selected worktree, with a fresh document session.

## What proves it works

Drive this feature with the mobile-verify skill on demand. The named rules cover workspace selection and document identities/transitions. Native acceptance requires the developer's iPad walkthrough; static checks do not prove window geometry or toolbar appearance.

## Gotchas

- The workspace disables its native Stack header and owns its document header, including fallback states. Settings retains its one native Stack toolbar. Child routes and sheets keep native Back/Done; verify them separately. Embedded Files creation stays in the inspector body.
- Toolbar controls announce Show sidebar/Hide sidebar and Show inspector/Hide inspector. They control different panes.
- Workspace loading, failure, empty and unavailable states keep the sidebar reachable. Follow projects.workspace-picker for inventory recovery, multiple environments and remembered selections.
