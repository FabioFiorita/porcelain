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

A direct link opens the requested decision and revision, preserving the destination through pairing.

## Sub-features

- `reviews.decision-link` — Direct decisions, pairing and unknown targets.

## How to get to it (user POV)

- `/reviews/<reviewId>/<revision>?decision=<layerId>` or the latest review route with `?decision=<layerId>`.

## Driving it with browser

Preconditions: [surface baseline](README.md).

Use the fixture and pairing journey in [reviews.page](reviews.page.md). Open the returned revision and decision URL directly, including from an unpaired browser. Pair in the same tab and check that the exact revision and decision open. Its code is retained at that revision's commits. An unknown layer ID shows the briefing and a clear note with revision controls and a way back. The latest route also accepts `?decision=<layerId>` and resolves it in the latest revision.

Automated coverage: `reviews-page.test.tsx`.

## Gotchas

- Pair in the same tab to prove destination retention; reopening the link afterward would hide a lost destination.
