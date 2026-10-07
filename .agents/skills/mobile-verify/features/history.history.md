---
screen: /history
selectors:
  - "History"
  - "Select a worktree to continue."
tests:
  - apps/mobile/spec/e2e/phone-shell.e2e.ts
  - apps/mobile/spec/e2e/destinations.e2e.ts
  - apps/mobile/spec/e2e/tablet-shell.tablet.e2e.ts
api: []
---

# history.history

## What it is

History is the third destination. It does not read commits from the server yet: it shows its empty state, the heading “History” over “Select a worktree to continue.”, whatever is paired or selected.

## How a user reaches it

- phone: the History tab; iPad: History in the sidebar
- the deep link `porcelain.dev://history`, warm or straight after a cold launch

## Driving it

Use direct Maestro to select History and inspect its heading, empty state and selected tab/sidebar row. Repeat using the development deep link if deep-link behavior changed. This screen does not load commits yet.

## What proves it works

- `apps/mobile/spec/e2e/destinations.e2e.ts`: the deep link opens History directly, warm and after a cold launch, with the tab selected and its empty state.
- `apps/mobile/spec/e2e/phone-shell.e2e.ts` and `apps/mobile/spec/e2e/tablet-shell.tablet.e2e.ts`: History is selectable on phone and iPad.

## Gotchas

- The empty state is the only state; a server whose project has no commits shows the same screen.
