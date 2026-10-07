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

On iPad the app is Expo UI's SwiftUI three-column NavigationSplitView: the sidebar “Porcelain” lists Review, Files, History and Settings; the content column holds the destination's master pane (“Changes” with “No worktree selected.” in themed React Native content, or Settings' native Environments section); Expo Router renders the detail column, whose toolbar carries the workspace picker. Collapsing the sidebar keeps the master and detail; rotating keeps Settings. In portrait iPadOS shows two columns. The tablet never embeds the phone's tab navigator. The owner chose the SwiftUI split view over Router's, which cannot customize its header.

## How a user reaches it

- launch the app on an iPad

## Driving it

Start a separate iPad instance. Inspect the actual layout before selecting Files and Settings in the sidebar; expose Show Sidebar if portrait hides it. Verify the content and detail columns as well as selection. Drive sidebar collapse and rotation separately. This layout needs its own native proof.

## What proves it works

- `apps/mobile/spec/e2e/tablet-shell.tablet.e2e.ts` (iPad): in landscape it selects each sidebar destination, hides and shows the sidebar keeping the selection, the master and the detail, rotates to portrait and back keeping Settings, and returns to Review.

## Gotchas

- The simulator starts in portrait, where the sidebar is hidden behind Show Sidebar; the e2e flow rotates to landscape first, and a development deep link reaches a destination in either orientation.
- “Hide Sidebar” and “Show Sidebar” are SwiftUI's own labels; inspect the current native hierarchy before targeting them.
