---
screen: /reviews/[reviewId]
selectors:
  - 'All decisions'
  - 'Decisions'
  - 'Pair this computer'
  - 'Pairing link'
  - 'Pair'
  - 'Read again'
tests:
  - packages/client/src/features/reviews/rules/app-link.spec.ts
  - packages/client/src/features/projects/commands/selection.spec.ts
api:
  - GET /api/reviews/:reviewId
  - GET /api/reviews/:reviewId/revisions/:revision
  - PUT /api/reviews/:reviewId/seen
---

# reviews.linked-review

A published review is read independently of a worktree. It opens from an HTTPS
app link in the Review stack, on phone or iPad, with the native header back to Review.
The `/reviews/[reviewId]` destination accepts the same environment, host,
revision and decision query as the public `/open/reviews/[reviewId]` entry.

Follow [app.deep-links](app.deep-links.md) for cold, warm and unpaired entry.

1. Open a published review. Read Asked, the toned Recommendation card (Merge in
   success, Hold in warning) with reasons, Proven at the short head SHA once,
   Not proven, and Removed. Every deleted path must appear under
   a red frame. Inspect light, dark and large system text.
2. Open each decision. Read its summary, step text and stored Published excerpt.
   No current worktree file is fetched for the excerpt. All decisions returns to
   the list. A direct decision link opens that decision.
3. Independently read the server review record and confirm lastSeenRevision after
   opening the review. Open an older revision and confirm that exact revision's
   content is rendered.
4. Open an unknown decision: the review remains readable with a clear note and
   All decisions. Unknown review/revision and offline states retain the native header back;
   recover connectivity with Read again.
5. On a cold app-link launch, use the native header back and confirm it returns
   to Review. Exercise the existing workspace review. Comments, full
   diffs and marking are outside this linked screen's scope.

Android proof does not establish iOS, iPad layout or physical network permissions.
