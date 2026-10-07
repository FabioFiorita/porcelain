---
screen: /
selectors:
  - "Review"
  - "Select a worktree to continue."
  - "Changes"
  - "No worktree selected."
tests:
  - apps/mobile/spec/e2e/phone-shell.e2e.ts
  - apps/mobile/spec/e2e/destinations.e2e.ts
  - apps/mobile/spec/e2e/tablet-shell.tablet.e2e.ts
api: []
---

# reviews.review

## What it is

Review is the first destination and the screen the app opens on. It does not read review data from the server yet: with or without a paired environment or a selected worktree it shows its empty state, the heading “Review” over “Select a worktree to continue.”, and on iPad the content column titled “Changes” reads “No worktree selected.”.

## How a user reaches it

- the app opens on it after a cold launch
- phone: the Review tab; iPad: Review in the sidebar
- the deep link `porcelain.dev://`

## Driving it

Inspect the initial Review screen, select Files, then return to Review through direct Maestro. Verify the empty state and selected tab/sidebar row, using a screenshot when necessary. On iPad also inspect “Changes” and “No worktree selected.” in the content column.

## What proves it works

- `apps/mobile/spec/e2e/phone-shell.e2e.ts`: the phone tabs select Review and show its empty state, also after a cold launch.
- `apps/mobile/spec/e2e/destinations.e2e.ts`: the deep link opens Review directly with the tab selected.
- `apps/mobile/spec/e2e/tablet-shell.tablet.e2e.ts`: the iPad split shows Review with “Changes” in the content column.

## Gotchas

- The empty state is the only state: the screen reads nothing from the server, so a paired server whose project has no review shows exactly this. A data-driven empty state does not exist yet.
- If the hierarchy omits a selected trait, inspect the screenshot; automated Maestro selection assertions remain separate regression evidence.
