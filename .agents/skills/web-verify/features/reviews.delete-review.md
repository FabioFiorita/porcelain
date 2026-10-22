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

After confirming, the reviewer permanently deletes the published review, its proof and its reviewed decisions for everyone connected. Worktree-owned comments and file marks stay; review-owned comments and marks are deleted with their review.

## How to get to it (user POV)

Open the branch Review tab or any durable review link. In the page header choose Review actions → Delete review. Read the confirmation covering every revision, its proof, comments and marks. Cancel keeps the record; Delete removes it and returns to the workspace. Confirm with an independent read of GET `/api/reviews/<reviewId>`, which then returns 404.

Follow the lifecycle journey in [reviews.page](reviews.page.md), at both widths and themes. The deleted record is the disposable fixture's review.

## Driving it with browser

Preconditions: [surface baseline](README.md).

Preconditions: publish the disposable review using [review lifecycle setup](reviews.page.md).

1. From branch Review or a durable link, choose Review actions → Delete review. Confirmation covers every revision and owned proof/comments/marks. Cancel: review remains readable.
2. Repeat and Delete: return to workspace; independent `GET /api/reviews/<reviewId>` answers 404. Worktree comments/file marks remain; review-owned comments/marks are gone.
3. Repeat the entry/confirmation at phone and desktop widths, light/dark.

Automated coverage: `reviews-page.test.tsx`.

## Gotchas

- Delete removes the published review for everyone connected; only use the disposable fixture review.
