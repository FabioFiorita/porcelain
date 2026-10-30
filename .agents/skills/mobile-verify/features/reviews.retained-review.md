---
screen: /retained-review/[reviewId]
selectors:
  - 'The walkthrough'
  - 'All decisions'
  - 'Read again'
tests:
  - apps/mobile/src/features/projects/rules/retained-review-route.spec.ts
api:
  - GET /api/reviews/:reviewId
  - GET /api/reviews/:reviewId/revisions/:revision
  - PUT /api/reviews/:reviewId/seen
---

# reviews.retained-review

Files and History retain their own published-review destination so a closed review returns to the Worktrees list that opened it.

## How to get to it (user POV)

- Files or History → Worktrees → Filter worktrees → Show older reviews → tap a review title.

## Driving it with agent-device

Preconditions: [surface baseline](README.md), with a closed review and an available checkout.

1. Open Worktrees from Files, set a query or project filter and Filter worktrees → Show older reviews. Tap the review title. The Files tab remains selected; the retained briefing and decisions follow [published review](reviews.linked-review.md).
2. Native Back returns to the Files Worktrees list with its query, filters and expansion. Repeat from History; its tab remains selected and Back returns to its list.
3. Return to Worktrees and select the retained review’s available checkout card inside the same project. It returns to the opening destination with that checkout selected. Main and the other available checkouts remain independently reachable.
4. Delete the closed review's checkout on the disposable server. Its retained briefing remains readable, while its unavailable checkout card stays disabled. Unknown review and offline reads keep native Back and Read again.

## Gotchas

- Review and the iPad sidebar keep the canonical `/reviews/[reviewId]` destination. Public review app links retain their existing route.
