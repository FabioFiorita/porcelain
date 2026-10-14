---
screen: /
selectors:
  - 'Porcelain'
  - 'Files'
  - 'Review'
  - 'Select a worktree to continue.'
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
api: []
---

# app.tablet-shell

## What it is

On iPad the app composes adaptive React Native panes using Porcelain controls, with Expo's native Stack owning each destination's header, toolbar and Back behavior. The app sidebar lists Files, Review and History, with Settings at the bottom. Porcelain and Settings use the same heading typography. Settings uses categories beside its native detail stack, starting with Appearance visible and the app sidebar collapsed. Its divider extends through the header area. Reopening the app sidebar gives three useful panels in a wide window. In Settings the native Show sidebar / Hide sidebar control sits beside Settings, because it controls the app pane; other destinations place it in the native toolbar. In a narrow window, the app sidebar occupies the main area while open; selecting a destination or its native Hide sidebar action returns to the retained detail. Settings categories move above the detail when its available width is narrow. iPhone and Android retain their tab navigator.

## How a user reaches it

- launch the app on an iPad

## Driving it

1. Launch on the iPad, then show the sidebar if it is hidden. Expect Porcelain and the Files, Review and History rows, with Settings at the bottom. Expect Files selected on a fresh launch.
2. Select Files with loaded storage and no saved workspace. Expect Files and Select a worktree to continue. in the main area. Choose a workspace through its toolbar and expect the existing Files destination; there is no third metadata column.
3. Hide and show the sidebar. Expect the current destination and selection to remain.
4. Select Settings, rotate between landscape and portrait, then return. Expect the native sidebar control and Settings categories, with Appearance controls immediately visible. Select Environments and expect Add environment. In a narrow window the categories sit above the detail.
5. Select Appearance. Use the sidebar control beside Settings to show and hide the app sidebar and expect the detail controls to remain fully visible. Follow preferences.appearance for light, dark and system themes, and confirm the native header and sidebar update. Select Development and expect the component selector beside its current preview; selecting Explore Badge replaces that preview inline.
6. Return to Review and confirm its heading. In a narrow window, select a sidebar destination and confirm the main column appears with a native way back to the sidebar.

## What proves it works

Drive this feature with the mobile-verify skill on demand.

## Gotchas

- There is one native header per detail stack. Expect the selected Settings category title in that header, not a separate blank bar above it.
- LeadingToolbar owns the sidebar button and feature leading actions together. On Files, expect both the native sidebar button and Refresh files; separate left toolbars overwrite each other.
- Use the sidebar test ids to distinguish its destination rows from navigation headings. Sidebar controls announce Show sidebar or Hide sidebar.

Files, Review and History own their existing workspace gate and retry in the main area. Verify Reading workspace…, failed inventory with Read again, Workspace unavailable with its reason, and the loaded no-selection prompt. Keep the sidebar and workspace toolbar reachable. Native acceptance uses the developer's iPad walkthrough.
