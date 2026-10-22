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

## Sub-features

- `reviews.linked-review` — Published verdicts, decisions and retained excerpts.

## How to get to it (user POV)

- HTTPS review app link; `/reviews/[reviewId]` or public `/open/reviews/[reviewId]`, with environment, host, revision and decision query.

## Driving it with agent-device

Preconditions: [surface baseline](README.md).

Preconditions: [deep-link setup](app.deep-links.md) for warm, cold and unpaired entry; publish a committed review.

1. Open the review. Verify Asked, Recommendation (Merge success/Hold warning) and reasons, Proven at the short SHA once, Not proven and Removed (every deleted path in a red frame). Repeat light/dark/larger text.
2. Open each decision and direct decision links: summary, step text and stored Published excerpt match that revision, with no current worktree file fetch. All decisions returns to the list.
3. Read the server review independently: lastSeenRevision updates on opening. Open an older revision: exact content renders.
4. Unknown decision leaves a readable review/note/All decisions. Unknown review/revision and offline states retain native header Back; Read again recovers connectivity.
5. Cold app-link launch → native Back returns to Review; existing workspace review still opens.

Automated coverage: `app-link.spec.ts`, `selection.spec.ts`.

## Gotchas

- This screen has no comments, full diffs or marking. Published reviews remain independent of the worktree.
- Android routing proof does not establish iOS/iPad or physical domain/network permissions.
