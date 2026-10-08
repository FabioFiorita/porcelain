---
screen: /review
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

Review is the second destination, after Files. It does not read review data from the server yet: with or without a paired environment or a selected worktree it shows its empty state, the heading “Review” over “Select a worktree to continue.”, and on iPad the content column titled “Changes” reads “No worktree selected.”.

## How a user reaches it

- the app opens on it after a cold launch
- phone: the Review tab; iPad: Review in the sidebar
- the deep link `porcelain.dev://`

## Driving it

1. Select Review through its native tab or sidebar row, or open porcelain.dev://review. Expect Review and Select a worktree to continue.
2. On iPad also expect Changes and No worktree selected. in the content column.
3. Select Files and return to Review. Expect the same empty state and matching native selection.
4. Cold-launch against the card's Metro URL. Expect Files ready, then select Review and confirm its heading. Review data and editing are not implemented by this screen.

## What proves it works

- `apps/mobile/spec/e2e/phone-shell.e2e.ts`: the phone tabs select Review and show its empty state; a cold launch starts on Files.
- `apps/mobile/spec/e2e/destinations.e2e.ts`: the deep link opens Review directly with the tab selected.
- `apps/mobile/spec/e2e/tablet-shell.tablet.e2e.ts`: the iPad split shows Review with “Changes” in the content column.

## Gotchas

- The empty state is the only state: the screen reads nothing from the server, so a paired server whose project has no review shows exactly this. A data-driven empty state does not exist yet.
- agent-device's iOS accessibility backend can omit the selected trait of a native tab; read selection from the screenshot, and leave the selected-state assertion to the Maestro e2e test.
