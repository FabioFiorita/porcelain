---
route: /$projectId/$worktreeId
selectors:
  - "Review"
  - "Review actions"
  - "Delete review"
  - "Delete review?"
  - "Cancel"
  - "Delete"
  - "No review published"
tests:
  - apps/web/spec/integration/reviews-delete-review.test.tsx
api:
  - GET /api/worktrees/:worktreeId/review
  - DELETE /api/worktrees/:worktreeId/review
---

# reviews.delete-review

## What it is

After confirming, the reviewer permanently deletes the published review, its proof and its reviewed decisions for everyone connected. Comments and reviewed file marks stay.

## How a user reaches it

- Review (phone; the right sidebar on desktop) → tab "Review" → button "Review actions" → menuitem "Delete review" → alertdialog → "Delete" (or "Cancel").
- "Review actions" is available while a published review exists, including an inactive review.

## Driving it

`$C start`; pair your browser using the card's pairing-link command.

### Setup

Publish a review: `$C agent publish-review 'Readme layer'`.

1. Navigate to `/` on the card's web URL (full page load), then click button named `Review` and tab named `Review`
   Look for: the review index with the published review and button "Review actions".
2. Click button named `Review actions`, then menuitem named `Delete review`
   Look for: alertdialog "Delete review?" explaining that the review, proof and reviewed decisions are permanently deleted for everyone connected, while comments and reviewed file marks stay; buttons "Cancel" and "Delete". `$C server published-review` still returns revision 1.
3. Click button named `Cancel`
   Look for: the alertdialog is gone; "Review actions" is still available. `$C server published-review` still returns the original review.
4. Click button named `Review actions`, then menuitem named `Delete review`, then button named `Delete` within the alertdialog
   Look for: the alertdialog is gone; the review index says "No review published"; "Review actions" is gone. `$C server published-review` returns `"review": null`.
5. Inspect HTTP requests and responses
   Look for: one `DELETE /api/worktrees/<id>/review` answered 200 with JSON `{"deleted":true}` (step 4 only; opening and cancelling send no deletion).

## What proves it works

- Step 2 opens confirmation while the server keeps the review; step 3 keeps it after Cancel; step 4 removes it on the server and shows the index's no-review state.
- Persistence: Navigate to `/` on the card's web URL (full page load), "Review", tab "Review" still says "No review published".
- `apps/web/spec/integration/reviews-delete-review.test.tsx` proves opening and cancelling the dialog keep the server's original review, confirming removes it and the index shows "No review published" with no "Review actions".

## Gotchas

- Button "Review" and tab "Review" are different roles; use their exact role and name.
- Menuitem "Delete review" opens confirmation; button "Delete" exists only within the alertdialog.
- A review publishes once per fixture worktree. Use a clean disposable instance for a new run.
