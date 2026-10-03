---
screen: /
selectors:
  - "Review"
  - "Files"
  - "History"
  - "Settings"
  - "Select a worktree to continue."
tests:
  - apps/mobile/spec/e2e/phone-shell.e2e.ts
api: []
---

# app.phone-shell

## What it is

On a phone the app is four native tabs, Review, Files, History and Settings, each a stack with its own title and the workspace picker in its toolbar. The development client is ready on Review within 30 seconds of a cold launch.

## How a user reaches it

- launch the app on an iPhone

## Driving it

Start an instance first: `.agents/skills/mobile-verify/scripts/cli start`.

```sh
.agents/skills/mobile-verify/scripts/cli tap --label Review
.agents/skills/mobile-verify/scripts/cli tap --label Files
.agents/skills/mobile-verify/scripts/cli tap --label History
.agents/skills/mobile-verify/scripts/cli tap --label Settings
.agents/skills/mobile-verify/scripts/cli screenshot
```

Look for: each tap shows that destination's heading; the screenshot shows the native tab bar with Settings selected.

## What proves it works

- `apps/mobile/spec/e2e/phone-shell.e2e.ts`: an unpaired iPhone selects each tab in turn, each showing its content, then cold-launches and is ready on Review with the tab selected within 30 seconds.

## Gotchas

- iOS 27's development client launches slowly; the flows await Review for at most 30 seconds before their own assertions, a startup phase the owner approved, and the selected-tab checks stay their own.
- The flows and the CLI open the app with Expo SDK 58's `__expo_disable_fab`, `__expo_disable_auto_launch` and `__expo_disable_onboarding` flags so developer overlays stay off the native controls; a cold launch applies them again.
- The flows launch with `permissions: {}` to keep the device's permissions: Maestro's default grants all of them, and the location grant stalled an iOS 26.5 iPad.
