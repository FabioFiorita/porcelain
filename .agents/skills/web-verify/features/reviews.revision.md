---
route: /reviews/$reviewId/$revision
selectors:
  - "Review revisions"
  - "Verdict"
  - "Back to workspace"
tests:
  - apps/web/spec/integration/reviews-page.test.tsx
  - apps/web/spec/integration/reviews-retained-comments.test.tsx
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

Follow [reviews.page](reviews.page.md) to publish two committed revisions. Open `/reviews/<id>/1`, `/reviews/<id>/2`, then select the latest row ("Revision 2, the latest") in the margin. The verdict, SHA, decision excerpts, code and proof must belong to the selected revision. Remove the publishing worktree with the fixture CLI and reopen both numbered links: they remain readable. Unknown revision 99 offers Back to workspace. Marks and comments are owned by the review and show the revision on which they were written.

Create a retained range thread on r1, publish changed or moved code, and read r2. The old thread remains readable at file level with `Code changed since this comment`, its original revision and `Open r1`. Follow that link and open its decision to read the original code. Reverse the direction with an r2 thread while reading r1. Both additions and deletions must avoid attaching to the other revision's line numbers. A same-head republication also keeps other-publication threads at file level because the anchor does not identify the immutable base commit; same-publication threads stay inline. A different base must never reuse the line position.

Automated coverage: `reviews-page.test.tsx`.

## Gotchas

- Remove only the fixture publishing checkout, and compare content/SHA with the selected numbered revision rather than latest.
