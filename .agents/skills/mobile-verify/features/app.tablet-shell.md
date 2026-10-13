---
screen: /
selectors:
  - 'Porcelain'
  - 'Files'
  - 'Review'
  - 'Select a worktree to continue.'
  - 'Environments'
  - 'Add environment'
tests:
  - packages/client/src/features/projects/rules/workspace-selection.spec.ts
api: []
---

# app.tablet-shell

## What it is

On iPad the app is Expo UI's SwiftUI three-column NavigationSplitView: the sidebar “Porcelain” lists Files, Review, History and Settings; the content column holds the destination's master pane, titled Files, Review or History, showing the selected branch/path only and staying empty otherwise, or Settings' native Environments section. Expo Router renders the detail column, whose destinations own the workspace gate and whose toolbar carries the workspace picker. Collapsing the sidebar keeps the master and detail; rotating keeps Settings. In portrait iPadOS shows two columns. The tablet never embeds the phone's tab navigator. The owner chose the SwiftUI split view over Router's, which cannot customize its header.

## How a user reaches it

- launch the app on an iPad

## Driving it

1. Launch on the iPad, then show the sidebar if it is hidden; expect Files as the first and selected destination in the Porcelain sidebar.
2. Select Files with loaded storage and no saved workspace. Expect Files and Select a worktree to continue. in the detail pane; the master pane is titled Files and has no branch/path content. Choose a workspace through the detail toolbar and expect its branch/path in the master.
3. Hide and show the sidebar. Expect the same selection, master and detail.
4. Select Settings, rotate between landscape and portrait, then return. Expect Environments and Add environment throughout.
5. Return to Review and confirm its heading.

## What proves it works

Drive this feature with the mobile-verify skill on demand.

## Gotchas

- The simulator starts in portrait, where the sidebar is hidden behind Show Sidebar; rotate to landscape to verify the expanded sidebar, and a development deep link reaches a destination in either orientation.
- “Hide Sidebar” and “Show Sidebar” are SwiftUI's own labels, so the map cannot name them as selectors.

The Files, Review and History detail destinations own the workspace gate and retry; the master does not repeat those states. Verify Reading workspace…, failed inventory with Read again, Workspace unavailable with its reason, and the loaded no-selection prompt in the detail pane. The master shows the selected branch/path only and stays empty otherwise. Keep the sidebar and detail workspace toolbar reachable. This requires its own iPad run; native acceptance remains pending.
