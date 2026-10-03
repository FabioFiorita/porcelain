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

Start an iPad instance: `.agents/skills/mobile-verify/scripts/cli start --device ipad`.

```sh
.agents/skills/mobile-verify/scripts/cli snapshot
.agents/skills/mobile-verify/scripts/cli tap --label Files
.agents/skills/mobile-verify/scripts/cli tap --label Settings
.agents/skills/mobile-verify/scripts/cli screenshot
```

Look for: the sidebar “Porcelain”, then Files with “No worktree selected.” in the content column, then Settings with the Environments section and “Add environment”.

## What proves it works

- `apps/mobile/spec/e2e/tablet-shell.tablet.e2e.ts` (iPad): in landscape it selects each sidebar destination, hides and shows the sidebar keeping the selection, the master and the detail, rotates to portrait and back keeping Settings, and returns to Review.

## Gotchas

- The simulator starts in portrait, where the sidebar is hidden behind Show Sidebar; the e2e flow rotates to landscape first, and `open <screen>` reaches a destination in either orientation.
- “Hide Sidebar” and “Show Sidebar” are SwiftUI's own labels, so the map cannot name them as selectors.
