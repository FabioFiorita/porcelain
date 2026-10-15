---
screen: /
selectors:
  - "Review"
  - "Files"
  - "History"
  - "Settings"
  - "Select a worktree to continue."
tests: []
api: []
---

# app.phone-shell

## What it is

On a phone the app is four native tabs, Files, Review, History and Settings, each a stack with its own title and the workspace picker in its toolbar. The development client is ready on Files within 30 seconds of a cold launch.

## How a user reaches it

- launch the app on an iPhone

## Driving it

1. Launch on the iPhone. Expect Files as the first and selected tab, its heading and empty state.
2. Select Review, then History, then Settings. Expect each matching heading and content.
3. Inspect a screenshot: Settings is selected and all four native tabs are present.
4. Cold-launch the development client with the card's Metro URL. Expect Review ready within 30 seconds; confirm the selected tab visually.

## What proves it works

Drive this feature with the mobile-verify skill on demand.

## Gotchas

- iOS 27's development client launches slowly; the flows await Files for at most 30 seconds before their own assertions, a startup phase the owner approved, and the selected-tab checks stay their own.
- The flows and the CLI open the app with Expo SDK 58's `__expo_disable_fab`, `__expo_disable_auto_launch` and `__expo_disable_onboarding` flags so developer overlays stay off the native controls; a cold launch applies them again.
