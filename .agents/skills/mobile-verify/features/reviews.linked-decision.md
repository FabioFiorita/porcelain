---
screen: /linked-decision
selectors:
  - 'Read-only review'
  - 'Published excerpt'
tests:
  - apps/mobile/src/features/reviews/rules/briefing.spec.ts
api:
  - GET /api/reviews/:reviewId
---

# reviews.linked-decision

One stop of a [published review](reviews.linked-review.md) on its own screen, read-only: the decision's summary, steps and stored Published excerpts for that revision, with previous and next stop buttons around Read-only review. The route takes the same environment, host, protocol and revision query as `/reviews/[reviewId]`, plus the stop key (`stop`).

## How to get to it (user POV)

- Published review → The walkthrough → a decision row, or Continue at decision n.
- A review link with a `decision` query opens the review screen directly on that decision; its previous and next replace it with this screen.

## Driving it with agent-device

Preconditions: [surface baseline](README.md) with `--fixture development`; open the review from Worktrees → Show older reviews or a review link (`porcelain.dev://reviews/<reviewId>?environment=<id>&host=<host>` with the development flags).

1. Open decision 1 from the review: the native title reads Decision 1 of N. Next and previous swap the stop in place (Decision 2 of N, then back); previous from the first decision and native Back return to the review.
2. Open a link with `decision=<layer id>`: it lands on that decision. Previous moves to the earlier decision, then to the review's briefing, without leaving to the inbox.
3. Each move stays in the tab that opened it; check after several moves that the other tab's stack is unchanged.
4. Tablets with sufficient content width: the review's decisions column sits beside the stop, current one highlighted; choosing a row switches the stop in place.

## Gotchas

- Moves use the screen's own navigation (`navigation.setParams`), not the global router: both tab stacks stay mounted, and a global parameter change can land in the other tab.
