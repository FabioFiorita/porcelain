---
route: /reviews/$reviewId/$revision
selectors:
  - "Review revisions"
  - "Verdict"
  - "Back to workspace"
tests:
  - apps/web/spec/integration/reviews-page.test.tsx
api:
  - GET /api/reviews/:reviewId/revisions/:revision
  - GET /api/reviews/:reviewId/revisions/:revision/file
  - POST /api/reviews/:reviewId/revisions/:revision/diffs
  - GET /api/reviews/:reviewId/revisions/:revision/proof
---

# reviews.revision

Numbered links keep each published revision readable after its publishing worktree is removed.

## How to get to it (user POV)

- Briefing margin → Review revisions; `/reviews/<id>/1` and `/reviews/<id>/2` direct links.

## Driving it with browser

Preconditions: [surface baseline](README.md).

Follow [reviews.page](reviews.page.md) to publish two committed revisions. Open `/reviews/<id>/1`, `/reviews/<id>/2`, then select latest. The verdict, SHA, decision excerpts, code and proof must belong to the selected revision. Remove the publishing worktree with the fixture CLI and reopen both numbered links: they remain readable. Unknown revision 99 offers Back to workspace. Marks and comments are owned by the review and show the revision on which they were written.

Automated coverage: `reviews-page.test.tsx`.

## Gotchas

- Remove only the fixture publishing checkout, and compare content/SHA with the selected numbered revision rather than latest.
