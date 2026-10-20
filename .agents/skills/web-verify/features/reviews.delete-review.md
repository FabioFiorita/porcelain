---
route: /$projectId/$worktreeId
selectors:
  - "Review"
  - "Review actions"
  - "Delete review"
  - "Delete review?"
  - "Cancel"
  - "Delete"
  - "Back"
tests:
  - apps/web/spec/integration/reviews-page.test.tsx
api:
  - GET /api/worktrees/:worktreeId/review
  - DELETE /api/reviews/:reviewId
---

# reviews.delete-review

## What it is

After confirming, the reviewer permanently deletes the published review, its proof and its reviewed decisions for everyone connected. Worktree-owned comments and file marks stay; review-owned comments and marks are deleted with their review.

## How a user reaches it

Open the branch Review tab or any durable review link. In the page header choose Review actions → Delete review. Read the confirmation covering every revision, its proof, comments and marks. Cancel keeps the record; Delete removes it and returns to the workspace. Confirm with an independent read of GET `/api/reviews/<reviewId>`, which then returns 404.

Follow the lifecycle journey in [reviews.page](reviews.page.md), at both widths and themes. The deleted record is the disposable fixture's review.
