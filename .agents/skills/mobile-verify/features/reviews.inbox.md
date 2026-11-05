---
screen: /
selectors:
  - 'Reviews'
  - 'review-inbox'
  - 'Reviews by project'
  - 'Needs you'
  - 'Reading reviews…'
  - 'No reviews'
  - 'Pair a computer'
  - 'Add computer'
  - 'PR #'
  - 'Search reviews'
  - 'No reviews match'
tests:
  - packages/client/src/features/projects/rules/review-inbox.spec.ts
api:
  - GET /api/inventory
  - GET /api/reviews/:reviewId
---

# reviews.inbox

The Reviews tab lists the open published reviews of every paired computer. Reviews with undecided decisions come first under Needs you; the rest are grouped by project, labelled "project · computer" when more than one computer is paired. Each row has a status icon in a tonal circle, the branch as its title and "project · n/m decisions · PR #n" as its subtitle, and opens the published review. The inbox shows no time, agent name or unread state.

## How to get to it (user POV)

- Launch the app: Reviews is the first tab. Tap a row to open the published review; Back returns to the inbox.

## Driving it with agent-device

Preconditions: [surface baseline](README.md). Publish at least two reviews through `$C agent …`: one with an undecided decision and one fully reviewed, plus one linked to a PR when a GitHub fixture is available.

1. Open Reviews. While reads are pending and nothing is listed, expect Reading reviews…. Then the undecided review sits under Needs you and the reviewed one under its project heading. Compare each row's branch, decision counts and PR number with independent `$C server …` reads; a closed or archived review does not appear.
2. Tap `review-inbox-<reviewId>`: the [published review](reviews.linked-review.md) pushes inside the Reviews tab. Back returns to the inbox at the same position.
3. Mark the remaining decisions of the Needs you review (through the web client or the review screen) and return: the row moves to its project group without reload.
4. Pair a second disposable computer with a review: project headings read "project · computer" and each row opens its own computer's review.
5. With no published reviews expect No reviews. Forget every computer: Pair a computer with Add computer, which opens Settings → Computers.
6. Type in the header's Search reviews field: every word must match the branch, worktree, project, computer or `#<PR number>`; groups that empty disappear, and nothing matching says No reviews match. Cancel (iOS) or clearing the field restores the full inbox.
7. Tablets with sufficient content width: the inbox is the left column and the chosen review's overview sits beside it ([shell](app.shell.md)); the chosen row is highlighted and search filters the column. Rotate with a review open: the same review stays open.
8. Check long branch names, larger text, light/dark, and tablets in landscape and portrait.

Automated coverage: `review-inbox.spec.ts` (grouping, ordering, status and search).

## Gotchas

- A row whose progress cannot be read shows a warning icon; it is not counted as Needs you. Follow [Worktrees](projects.worktrees.md#driving-it-with-agent-device) for inventory loading and recovery.
