---
screen: /review-summary
selectors:
  - 'Read agent summary'
  - 'Refresh agent summary'
tests:
  - packages/client/src/features/reviews/queries/publication.spec.ts
api:
  - GET /api/worktrees/:worktreeId/review
---

# reviews.summary

The agent's published HTML summary for the selected worktree's review, full screen.

## How to get to it (user POV)

- [Review](reviews.review.md) overview → Agent summary (`review-summary`).

## Driving it with agent-device

Preconditions: [surface baseline](README.md) with `--fixture development`.

1. Open Agent summary: the native title reads Agent summary and the supplied HTML renders without scripts or remote assets; links open externally. Back returns to the overview at its scroll place.
2. Refresh agent summary rereads the publication; an expired summary link recovers through it, and a failed read offers Read again.

## Gotchas

- Signed summary HTML is outside the `/api/` frontmatter format.
