---
route: /
selectors:
  - "Review"
  - "Mark decision reviewed"
  - "Decision reviewed"
  - "Code moved"
  - "Mark "
  - "Unmark "
  - "Could not update the decision"
  - "Mark available files reviewed"
  - "Review unavailable"
  - "Some files cannot be marked reviewed"
tests:
  - apps/web/spec/integration/reviews-mark-decision.test.tsx
  - apps/web/spec/integration/reviews-mark-decision-refresh.test.tsx
  - apps/web/spec/integration/reviews-unavailable-completion.test.tsx
api:
  - GET /api/worktrees/:worktreeId/review
  - GET /api/reviews/:reviewId/marks
  - PUT /api/worktrees/:worktreeId/reviewed
  - DELETE /api/worktrees/:worktreeId/reviewed
  - PUT /api/worktrees/:worktreeId/reviewed-bulk
  - PUT /api/reviews/:reviewId/marks
  - DELETE /api/worktrees/:worktreeId/reviewed-layers
---

# reviews.mark-decision

Mark decision reviewed records its retained files and then the decision; unmarking a decision keeps its file marks.

## Sub-features

- `reviews.mark-decision` — Decision and file marks, failure and unmarking.

## How to get to it (user POV)

- Branch Review tab, project Reviews list or durable decision link → decision toolbar.
- Sidebar decision context menu; file R shortcut.

## Driving it with browser

Preconditions: [surface baseline](README.md).

Preconditions: [revision fixture](reviews.page.md).

1. Open a decision through each listed entry. Mark decision reviewed, then independently GET `/api/reviews/<id>/marks`: its retained files and decision are marked, while worktree-owned marks stay unchanged.
2. Fail a file write: the decision stays unmarked. Unmark the decision: file marks stay. Toggle a file: completion changes without erasing the decision mark.
3. Edit the live worktree: published code/fingerprint stay at their revision.

Automated coverage: `reviews-mark-decision.test.tsx`, `reviews-mark-decision-refresh.test.tsx`, `reviews-unavailable-completion.test.tsx`.

## Gotchas

- Marking a decision must not treat failed/unavailable files as reviewed or replace retained code with live worktree text.
