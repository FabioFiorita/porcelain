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
  - GET /api/inventory
---

# app.deep-links

## What it is

Expo Router opens each screen from the app's scheme, `porcelain.dev://` for the development identity: `porcelain.dev://` for Review, `porcelain.dev://files`, `porcelain.dev://history` and `porcelain.dev://settings`, with the matching tab or sidebar row selected, whether the app is running or was cold-launched. The e2e tests reach view states this way instead of walking the app.

## How a user reaches it

- any link with the app's scheme, or `xcrun simctl openurl`

## Driving it

Start an instance first: `.agents/skills/mobile-verify/scripts/cli start`.

```sh
.agents/skills/mobile-verify/scripts/cli open /history
.agents/skills/mobile-verify/scripts/cli open porcelain.dev://settings
.agents/skills/mobile-verify/scripts/cli snapshot
```

Look for: History, then Settings listing the paired environment. `open` takes a screen path or a `porcelain.dev://` link and adds the developer-menu flags to a link that carries no query of its own.

## What proves it works

- `apps/mobile/spec/e2e/destinations.e2e.ts`: on a fresh install the links open Files, History, Settings and Review with the tab selected and each one's empty state, and History again straight after a cold launch.
- `apps/mobile/spec/e2e/environment-states.e2e.ts`: a cold launch followed by the Settings link shows one environment online and the one whose server stopped offline.

## Gotchas

- Only screens have links. Pairing and choosing a worktree have none, so a test that needs a paired environment or a selected worktree walks those steps first.
- iOS asks to confirm opening a link from outside the app; the flows and the CLI accept it.
