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

On a phone the app is four native tabs, Files, Review, History and Settings, each a stack with its own title and the workspace picker in its toolbar. The development client is ready on Files within 30 seconds of a cold launch.

## How to get to it (user POV)

- Launch on an iPhone or Android phone; use Files, Review, History and Settings tabs.

## Driving it with agent-device

Preconditions: [surface baseline](README.md).

1. Launch on a phone. Expect Files first/selected, its heading and empty state, ready within 30 seconds.
2. Select Review, History and Settings. Each destination shows its heading/content; retain a screenshot with Settings selected and all four native tabs visible.
3. Cold-launch through the card's Metro URL after selecting Review. Confirm the intended restored destination and selected tab visually, within the 30-second startup budget.

Automated coverage: none named; retain the live action and readback evidence.

## Gotchas

- Native selected-tab traits may be absent; use a screenshot and heading. Reapply development-menu flags after cold launch so overlays do not cover controls.
