---
screen: /decision
selectors:
  - 'Mark decision reviewed'
  - 'Mark available files reviewed'
  - 'Review unavailable'
  - 'Unmark reviewed'
  - 'Read more files'
  - 'Needs your decision'
  - 'Answer'
  - 'Open changed-file diff'
  - 'Open in Files'
  - 'File history'
  - 'Back to review'
  - 'Decisions'
tests:
  - apps/mobile/src/features/reviews/store.spec.ts
  - packages/client/src/features/reviews/commands/decisions.spec.ts
  - packages/client/src/features/reviews/rules/walkthrough.spec.ts
  - apps/mobile/src/features/reviews/rules/thread-folds.spec.ts
api:
  - GET /api/reviews/:reviewId/marks
  - PUT /api/reviews/:reviewId/marks
  - POST /api/reviews/:reviewId/marks/removal
  - POST /api/reviews/:reviewId/revisions/:revision/diffs
  - GET /api/worktrees/:worktreeId/comments
---

# reviews.decision

One walkthrough stop per screen: a published decision (or Not explained, or Specs) with its explanation, steps, published diffs and the bar that marks it reviewed and moves to the neighbouring stop. The `/decision` route takes the worktree `workspace` and the stop key (`stop`, such as `decision:<layer id>`).

## How to get to it (user POV)

- [Review](reviews.review.md) overview → a row under The walkthrough, or Continue at decision n.
- A thread's decision link in the comments sheet closes the sheet and opens that decision; opened from a decision's thread, it switches that decision screen in place, so Back still lands on the overview.

## Driving it with agent-device

Preconditions: [surface baseline](README.md) with `--fixture development`. Use the [bounded document gesture](../references/driving.md#scroll-the-review-document), verifying iPad in landscape and portrait with fresh bounds after rotation.

### Reading a decision

1. Open a decision from the overview's walkthrough row or Continue. The native title reads Decision n of N. Code moved since it was explained shows when a step moved, beside the file tally for the decision.
2. The title and explanation come first, then the contracts as one wrapped row (verb, owner, New/Changed/Removed), Needs your decision cards for every connected question, and the route (lanes joined by arrows) above the steps. More than four steps fold behind All n. A step pushes its [Step](reviews.decision-step.md) screen; broken pointers are not tappable.
3. Each published file of the decision shows its diff from the published revision with −/+ counts. A thread folds under its last line as "n comments · state" and opens the thread sheet; file-level threads and lines outside the diff list under the block. More than three files load through Read more files. Each file header's actions menu (`Actions for <path>`) offers Open changed-file diff when the file is changed now, Open in Files (not for deleted files) and File history; each pushes in the same tab and Back returns to the decision.
4. The bottom bar stays above the tab bar: previous, Mark decision reviewed (marks remaining files, then the decision, then moves on; Unmark reviewed afterwards), Comment (a whole-change comment that names the decision) and next. Previous and next swap the stop in place, scrolled to its top; previous from the first decision and finishing the last one return to the overview, so native Back always lands on the overview. Answer on a question opens the comments sheet with the question quoted, with the keyboard up.
5. Republish while a decision is open: a stop missing from the new revision says This decision is not in this revision with Back to review.

### Completion and progress

Precondition: publish multiple decisions, one shared file, a fileless decision and an unexplained file.

1. Shared files appear once under their owning stop; Open owning stop returns there. Decision completion records its owned immutable files before its decision mark. Read GET /api/reviews/:reviewId/marks independently. Unmark a file: file progress changes while its decision mark stays; decision counts follow the retained decision fingerprint. Mark decision reviewed fills missing file marks; Unmark reviewed (accessible name Unmark decision <title> as unreviewed) removes only its decision mark.
2. Mark decision reviewed with files remaining writes files before the decision and advances (overview at end). Leave the screen before a delayed successful write: persistence completes but navigation stays where the reader went. Opening code/diffs writes no marks; individual file controls remain available.
3. Refuse one immutable file-mark write: successful file marks remain, refusal displays, same stop stays and no new decision mark appears. Pending/failed marks hide completion and disable controls; Read again recovers.
4. For a retained file without a blob identity, exercise the completion plan with unavailable metadata: name/explanation keeps stop open. Mark available files reviewed keeps readable marks without advancing/marking the decision. With none available, Review unavailable is disabled. Restore the retained blob identity: ordinary completion returns. Large file size alone does not make an existing retained Git blob identity unavailable.
5. Commit/republish to change a published decision fingerprint; dirty edits change only worktree marks/proof freshness. Reconnect and switch worktrees/comparisons; compare literal marks/counts with an authorized web client. Check overview, summary, range and navigation labels at larger text sizes, Android light/dark, and iPad landscape/portrait.

## Gotchas

- Previous/next change the screen's own `stop` parameter (`navigation.setParams`, never the global router, which can reach the other tab's stack) rather than pushing, so the stack stays overview → decision; check Back after several moves.
- Mark decision reviewed advances only while the decision screen is focused; a write that lands after the reader opened a step, a sheet or another tab saves without moving them.
- Phones and iPad push the same routes. On iPad the decision screen shows the review's title, its decision count and the walkthrough rows (`Decisions`) in a left column, with the current stop highlighted; choosing a row switches the stop in place like previous/next. Rotate with a decision open: the same stop stays open in both orientations.
