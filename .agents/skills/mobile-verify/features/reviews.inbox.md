---
screen: /
selectors:
  - 'Reviews'
  - 'review-inbox'
  - 'Reviews by project'
  - 'Decision reviews'
  - 'Filter reviews'
  - 'Show older reviews'
  - 'Reading reviews…'
  - 'No reviews'
  - 'Pair a computer'
  - 'Add computer'
  - 'PR #'
  - 'Search reviews'
  - 'No reviews match'
tests:
  - packages/client/src/features/projects/rules/review-inbox.spec.ts
  - packages/client/src/features/projects/queries/worktree-navigator.spec.ts
api:
  - GET /api/inventory
  - GET /api/projects/:projectId/reviews
  - GET /api/reviews/:reviewId
  - GET /api/worktrees/:worktreeId/review
  - GET /api/reviews/:reviewId/pull-request/checks
---

# reviews.inbox

The Reviews tab reads durable stored publications independently of live worktrees. Open decision reviews appear under Decision reviews; routine records are grouped by project. A record’s unread state never creates an approval obligation. Multiple computers show their plain name beneath each project; decision rows include project/computer context in their description. Rows use a neutral file icon, branch identity, recorded decision/new-revision metadata, and optional PR number. Failed CI has a separate warning icon. Reading progress and diff-size totals stay inside the review.

## How to get to it (user POV)

- Reviews is the first native tab. Tap a row to read its publication; native Back returns to the inbox on a phone.
- Filter reviews includes the shared computer, project and review-presence filters. Reviews has its own visible search field; a Worktrees search never silently narrows it. Show older reviews includes closed and archived publications. Clear filters restores open reviews without clearing search.

## Driving it with agent-device

Preconditions: [surface baseline](README.md). Publish decision and record reviews, including two separate reviews from the same checkout and an open review whose checkout is removed. Retain independent server reads of review ids, timing, revision/seen state, and lifecycle state.

1. Open Reviews. While nothing has settled, expect Reading reviews…. If a publication could belong to a live checkout, wait for that association before exposing its row. Publications without a candidate checkout stay reachable while another lookup is pending. Decision-timed publications appear under Decision reviews, without claiming their questions remain unanswered. Routine records stay in their project group even when unread or unmarked. A new revision uses latestRevision versus lastSeenRevision; no n/m decisions fraction appears on a row.
2. Open each `review-inbox-<reviewId>` and confirm the exact published review id and computer. The publication currently attached to a live checkout retains its writable feedback and review controls on phone and tablet layouts. An earlier publication or one whose checkout was removed opens its saved, read-only review. Both reviews from the same checkout remain reachable. Removing a checkout does not remove its open publication from the default list. If the current publication changes after the inbox read, opening the older row still shows that saved publication, without newer-worktree feedback controls.
3. On a phone, native Back returns to the same inbox. On tablets with sufficient content width, selecting a row updates the overview beside the list and moves the neutral selected fill to that exact review id and computer. Navigating decisions stays inside that selected publication; switching between two reviews of the same branch remains distinct. Rotate in landscape/portrait with a review and decision selected: the same publication remains selected. Review-pane navigation does not rename the native Reviews tab.
4. Mark every decision in a decision review and return: its decision timing remains visible; a reading mark is not an answer or approval. Open a routine record and return: its new-revision label clears after the seen revision is acknowledged, without creating a Decision reviews item.
5. Closed/archived reviews stay hidden by default. Filter reviews → Show older reviews reveals them under their project, with explicit closed/archived labels. Closed decision-timed reviews do not enter Decision reviews. Disable history again and confirm open publications remain.
6. Pair a second disposable computer with colliding project/review ids. Project headers retain computer captions; each row opens the correct computer’s publication. CI failure has a separate warning icon and accessible Checks failed meaning without changing a publication’s timing or reading state.
7. Search every word across branch, project, computer, and PR number. Empty groups disappear, unmatched searches say No reviews match, and cancelling/clearing restores the list. Filter reviews applies project, computer, review-presence and older-publication choices consistently; a nonexistent project/computer filter yields no rows. Clear filters restores the publication list. With no publications expect No reviews. Forget every computer: Pair a computer → Add computer opens Settings → Computers.
8. Check long branch/computer names, larger text, light/dark, phone and tablet layouts, including both tablet orientations. Worktrees remains a separate native destination with its existing entry/return paths.

Automated coverage: shared review-inbox and navigator query specs cover decision/record distinctions, revision labels, durable review identities, history, and search. Native list/detail geometry and navigation require device proof.
