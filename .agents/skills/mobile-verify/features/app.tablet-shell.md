---
screen: /
selectors:
  - "Porcelain"
  - "Changes"
  - "No worktree selected."
  - "Environments"
  - "Add environment"
tests:
  - apps/mobile/spec/e2e/tablet-shell.tablet.e2e.ts
api: []
---

# app.tablet-shell

## What it is

On iPad the app is Expo UI's SwiftUI three-column NavigationSplitView: the sidebar “Porcelain” lists Files, Review, History and Settings; the content column holds the destination's master pane (“Files” by default or “Changes” on Review, with “No worktree selected.” in themed React Native content, or Settings' native Environments section); Expo Router renders the detail column, whose toolbar carries the workspace picker. Collapsing the sidebar keeps the master and detail; rotating keeps Settings. In portrait iPadOS shows two columns. The tablet never embeds the phone's tab navigator. The owner chose the SwiftUI split view over Router's, which cannot customize its header.

## How a user reaches it

- launch the app on an iPad

## Driving it

1. Launch on the iPad, then show the sidebar if it is hidden; expect Files as the first and selected destination in the Porcelain sidebar.
2. Select Files. Expect Files in the detail pane and Files / No worktree selected. in the content pane.
3. Hide and show the sidebar. Expect the same selection, master and detail.
4. Select Settings, rotate between landscape and portrait, then return. Expect Environments and Add environment throughout.
5. Return to Review and confirm its heading.

## What proves it works

- `apps/mobile/spec/e2e/tablet-shell.tablet.e2e.ts` (iPad): in landscape it selects each sidebar destination, hides and shows the sidebar keeping the selection, the master and the detail, rotates to portrait and back keeping Settings, and returns to Review.

## Gotchas

- The simulator starts in portrait, where the sidebar is hidden behind Show Sidebar; the e2e flow rotates to landscape first, and a development deep link reaches a destination in either orientation.
- “Hide Sidebar” and “Show Sidebar” are SwiftUI's own labels, so the map cannot name them as selectors.
