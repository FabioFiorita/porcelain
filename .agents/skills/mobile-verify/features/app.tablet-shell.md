---
screen: /
selectors:
  - 'Porcelain'
  - 'Files'
  - 'Review'
  - 'Select a worktree'
  - 'Select a file'
  - 'Select a commit'
  - 'No open tabs'
  - 'Environments'
  - 'Add environment'
  - 'sidebar-files'
  - 'sidebar-review'
  - 'sidebar-history'
  - 'sidebar-settings'
  - 'settings-appearance'
  - 'settings-environments'
  - 'settings-development'
tests:
  - packages/client/src/features/projects/rules/workspace-selection.spec.ts
  - apps/mobile/src/shared/rules/document-tabs.spec.ts
api: []
---

# app.tablet-shell

## What it is

On iPad the app composes adaptive React Native panes with Porcelain controls and one compact native Expo Stack toolbar per destination. Its glass sidebar button controls the Files/Review/History/Settings app pane. The sidebar starts open and preserves its state across destinations, including Settings; navigation and resizing never change that state. Windowed layouts reserve space above Porcelain for system window controls. Settings categories and Files/Review/History navigation sit beside their content when enough width is available. Files, Review and History use document tabs for iPad selection, including narrow windows, without pushing native detail routes. In a narrow content area a body control switches between its retained navigation and open document. Settings categories move above their detail. Phones retain native tabs and Stack routes.

## How a user reaches it

- launch the app on an iPad

## Driving it

1. Launch on the iPad, then show the sidebar if it is hidden. Expect Porcelain and the Files, Review and History rows, with Settings at the bottom. Expect Files selected on a fresh launch.
2. Select Files with loaded storage and no saved workspace. Expect Select a worktree and guidance to use the workspace filter in the main area. Choose a workspace through its toolbar and expect the existing Files destination; there is no third metadata column.
3. Hide and show the sidebar. Expect the current destination and selection to remain.
4. Select Settings, rotate between landscape and portrait, then return. Expect the same app-sidebar state, one Settings native toolbar and the category selector; Appearance is initially selected. Select Environments and expect Add environment. In a narrow window the categories sit above the detail.
5. Select Appearance. Use the native Settings toolbar sidebar control to show and hide the app sidebar and expect the detail controls to remain fully visible. Follow preferences.appearance for light, dark and system themes, and confirm the native header and sidebar update. Select Development and expect the component selector beside its current preview; selecting Explore Badge replaces that preview inline.
6. Return to Review and confirm its heading. Select a file on Files or Review and a commit on History; expect an open-document tab beside the retained navigation. Resize narrower, select from the navigation and expect the same content workspace without a new native Back page. Toggle the app sidebar, switch to Settings and confirm its state stays unchanged. In a window, confirm system controls do not overlap Porcelain and no blue Hide sidebar text appears.

## What proves it works

Drive this feature with the mobile-verify skill on demand.

## Gotchas

- There is one native toolbar per destination, labelled Files, Review, History or Settings. Selected documents use body tabs and Settings categories use a compact body title.
- LeadingToolbar owns the sidebar button and feature leading actions together. On Files, expect both the native sidebar button and Refresh files; separate left toolbars overwrite each other.
- Use the sidebar test ids to distinguish its destination rows from navigation headings. Sidebar controls announce Show sidebar or Hide sidebar.

Files, Review and History own their existing workspace gate and retry in the main area. Verify Reading workspace…, failed inventory with Read again, Workspace unavailable with its reason, and the loaded no-selection prompt. Keep the sidebar and workspace toolbar reachable. Native acceptance uses the developer's iPad walkthrough.
