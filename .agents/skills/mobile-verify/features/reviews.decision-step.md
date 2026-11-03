---
screen: /decision-step
selectors:
  - 'Show whole file'
  - 'Show relevant range'
  - 'Open changed-file diff'
  - 'Open in Files'
  - 'File history'
  - 'This step is not in this revision'
tests:
  - apps/mobile/src/features/reviews/rules/pointer-source.spec.ts
api:
  - GET /api/worktrees/:worktreeId/text
---

# reviews.decision-step

A decision step's code pointer on its own screen: the step title and text, the pointed code with path, range and source numbers, and ways out to the changed-file diff, Files and the file's history.

## How to get to it (user POV)

- [Decision](reviews.decision.md) → a numbered step under the route.

## Driving it with agent-device

Preconditions: [surface baseline](README.md) with `--fixture development`.

1. Open a decision, then a step. The native title reads Step n of N; the step title, text and pointer render with path/range/source numbers. Show whole file/Show relevant range toggle the excerpt.
2. Open changed-file diff (only when the file is changed now), then Back: the step returns. Open in Files and File history each push in the same tab; Back returns to the step, and Back again to the decision at its scroll place.
3. Republish without that step: This step is not in this revision with Back to review.

## Gotchas

- Pointer code can differ from retained excerpts: broken pointers are not tappable from the decision; moved snippets warn and are not highlighted as current.
