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

Expo Router opens each screen from the app's scheme, `porcelain.dev://` for the development identity: `porcelain.dev://` and `porcelain.dev://files` for Files, `porcelain.dev://review` for Review, `porcelain.dev://history` and `porcelain.dev://settings`, with the matching tab or sidebar row selected, whether the app is running or was cold-launched. The e2e tests reach view states this way instead of walking the app.

## How a user reaches it

- any link with the app's scheme, or `xcrun simctl openurl`

## Driving it

1. Open porcelain.dev://history in the development client. Expect History and the matching selected tab or sidebar row.
2. Open porcelain.dev://settings. Expect Settings and the paired environment.
3. Repeat with porcelain.dev:// and porcelain.dev://review. Expect Files and Review respectively.
4. Cold-launch using the History link. Expect History directly, with the matching native selection.
5. Accept an iOS open-link confirmation when it appears. Keep the development-menu flags from references/driving.md on links.

## What proves it works

- `apps/mobile/spec/e2e/destinations.e2e.ts`: on a fresh install the links open Files, History, Settings and Review with the tab selected and each one's empty state, and History again straight after a cold launch.
- `apps/mobile/spec/e2e/environment-states.e2e.ts`: a cold launch followed by the Settings link shows one environment online and the one whose server stopped offline.

## Gotchas

- Only screens have links. Pairing and choosing a worktree have none, so a test that needs a paired environment or a selected worktree walks those steps first.
- iOS asks to confirm opening a link from outside the app; the flows and the CLI accept it.
