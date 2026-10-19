---
route: /reviews/$reviewId/$revision/decisions/$layerId
selectors:
  - "Review walkthrough"
  - "Briefing"
  - "Mark decision reviewed"
tests:
  - apps/web/spec/integration/reviews-page.test.tsx
api:
  - GET /api/reviews/:reviewId/revisions/:revision
  - PUT /api/reviews/:reviewId/seen
---

# reviews.decision-link

Use the fixture and pairing journey in [reviews.page](reviews.page.md). Open the returned revision and decision URL directly, including from an unpaired browser. Pair in the same tab and check that the exact revision and decision open. Its code is retained at that revision's commits. An unknown layer ID shows the briefing and a clear note with revision controls and a way back. The latest route also accepts `?decision=<layerId>` and resolves it in the latest revision.
