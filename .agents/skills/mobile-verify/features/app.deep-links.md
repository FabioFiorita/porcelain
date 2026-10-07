---
screen: /
selectors:
  - "Review"
  - "Files"
  - "History"
  - "Settings"
  - "Select a worktree to continue."
  - "No environments paired."
tests:
  - apps/mobile/spec/e2e/destinations.e2e.ts
  - apps/mobile/spec/e2e/environment-states.e2e.ts
api:
  - GET /api/environment
  - GET /api/session
---

# app.deep-links

## What it is

Expo Router opens each screen from the app's scheme, `porcelain.dev://` for the development identity: `porcelain.dev://` for Review, `porcelain.dev://files`, `porcelain.dev://history` and `porcelain.dev://settings`, with the matching tab or sidebar row selected, whether the app is running or was cold-launched. The e2e tests reach view states this way instead of walking the app.

## How a user reaches it

- any link with the app's scheme, or `xcrun simctl openurl`

## Driving it

Use Maestro's openLink with the development scheme to open History and Settings. Include the developer-overlay flags printed in the lifecycle development link, accept the system confirmation when visible, and inspect the heading and selected destination. Repeat from a cold launch without clearing app data.

## What proves it works

- `apps/mobile/spec/e2e/destinations.e2e.ts`: on a fresh install the links open Files, History, Settings and Review with the tab selected and each one's empty state, and History again straight after a cold launch.
- `apps/mobile/spec/e2e/environment-states.e2e.ts`: a cold launch followed by the Settings link shows one environment online and the one whose server stopped offline.

## Gotchas

- Only screens have links. Pairing and choosing a worktree have none, so a test that needs a paired environment or a selected worktree walks those steps first.
- iOS asks to confirm opening a link from outside the app; accept it only when it is visible.
