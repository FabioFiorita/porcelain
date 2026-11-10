---
screen: /walkthrough-screenshot
selectors:
  - 'Screenshot'
  - 'Previous screenshot'
  - 'Next screenshot'
  - 'Screenshot unavailable'
  - 'This screenshot could not be loaded.'
tests:
  - packages/client/src/features/walkthroughs/rules/walkthrough.spec.ts
api:
  - GET /api/worktrees/:worktreeId/walkthrough/:runId/assets/:assetId
---

# reviews.walkthrough-screenshot

A screenshot the walkthrough placed on a step opens larger in a native sheet, with its caption and, when the step has several, previous and next.

## How to get to it (user POV)

- [Walkthrough](reviews.walkthrough-page.md) → a step's screenshot thumbnail ("Enlarge screenshot N"). Close (iOS sheet X, Android Back) returns to the page.

## Driving it with agent-device

Preconditions: [reviews.walkthrough-page](reviews.walkthrough-page.md) after `$C walkthrough sample` (two screenshots on step 2).

1. Step 2 shows two thumbnails with captions. Tap the first: the sheet shows its caption and the image; "1 of 2" with Next screenshot moves to the second; Previous screenshot returns.
2. Write a new walkthrough while the sheet is open: "Screenshot unavailable".

## Gotchas

- The bytes are stored with the walkthrough; the stock fake writer never produces screenshots.
