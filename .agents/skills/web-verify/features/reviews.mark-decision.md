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

## What it is

Mark decision reviewed records each file at its retained blob, then the decision fingerprint. A failed file write leaves the decision unmarked. Unmarking a decision leaves file marks; toggling a file changes the completion indicator without erasing the decision mark. Live worktree edits never replace the code or fingerprint in a published revision.

Open a decision from the branch Review tab, project Reviews list or durable decision link. Use its toolbar control, the sidebar decision context menu or the file R shortcut. Check GET `/api/reviews/<id>/marks` independently and verify worktree-owned marks did not change. Follow [reviews.page](reviews.page.md) for revision and cleanup fixtures.
