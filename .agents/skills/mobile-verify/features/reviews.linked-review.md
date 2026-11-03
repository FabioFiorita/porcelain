---
screen: /reviews/[reviewId]
selectors:
  - 'Read-only review'
  - 'Published review'
  - 'The walkthrough'
  - 'Briefing'
  - 'You asked'
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

A published review is read independently of a worktree. It opens from a Reviews
tab row, from an older review in Worktrees (Show older reviews), or from an HTTPS
app link, and stays in the tab that opened it with native Back to that list.
Closed and archived reviews open this same screen. The `/reviews/[reviewId]`
destination accepts the same environment, host, revision and decision query as the
public `/open/reviews/[reviewId]` entry.

## How to get to it (user POV)

- Reviews tab → review row.
- Worktrees → Filter worktrees → Show older reviews → tap an older review.
- HTTPS review app link; `/reviews/[reviewId]` or public `/open/reviews/[reviewId]`, with environment, host, revision and decision query.

## Driving it with agent-device

Preconditions: [surface baseline](README.md). Use the [bounded document gesture](../references/driving.md#scroll-the-review-document), verifying iPad in landscape and portrait with fresh bounds after rotation.

Preconditions: [deep-link setup](app.deep-links.md) for warm, cold and unpaired entry; publish a committed review.

1. Open the review. Verify the native Published review title, Recommendation (Merge success/Hold warning) and reasons first, You asked with links, Needs your decision, Proven at the short SHA once, owners and actual Removed paths, Not proven and The walkthrough. Image assets expand to retained images; links open externally and videos explicitly open this published revision in the browser. Continue at decision n stays fixed outside the scrolling content and resumes at the first unfinished decision. Repeat light/dark/larger text.
2. Open each decision from The walkthrough: it pushes its own screen titled Decision n of N, with previous and next stop buttons around Read-only review at the bottom; previous from the first decision and native Back return to the review. Direct decision links open on that decision. Summary, step text and stored Published excerpt match that revision, with no current worktree file fetch. The verdict appears only on the briefing. Not explained and Specs list their retained paths; partial unexplained ranges stay visible.
3. Read the server review independently: lastSeenRevision updates on opening. Open an older revision: exact content renders.
4. Unknown decision leaves a readable review with its note. Unknown review/revision and offline states retain native header Back; Read again recovers connectivity.
5. Open from a Reviews row: Back returns to the inbox. Open a closed review from Worktrees → Show older reviews with a query or project filter set: the Worktrees tab stays selected and Back returns to the same query, filters and expansion; the review's available checkout stays independently selectable there.
6. Delete a closed review's checkout on the disposable server: the review remains readable while its checkout card stays disabled in Worktrees.
7. Cold app-link launch lands in the Reviews tab; native Back returns to the inbox. A worktree's own Review still opens.

Automated coverage: `app-link.spec.ts`, `selection.spec.ts`.

## Gotchas

- This screen has no comments, full diffs or marking. Published reviews remain independent of the worktree.
- Android routing proof does not establish iOS/iPad or physical domain/network permissions.
