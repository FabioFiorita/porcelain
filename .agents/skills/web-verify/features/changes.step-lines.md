---
route: /
selectors:
  - "Review"
  - "Step "
  - "Existing code it relies on"
tests:
  - apps/web/spec/integration/changes-step-lines.test.tsx
api:
  - GET /api/reviews/:reviewId/revisions/:revision/file
  - GET /api/worktrees/:worktreeId/review
---

# changes.step-lines

A published context step shows the text retained at its committed revision. Worktree edits leave its pointer and excerpt unchanged. The separate live file view continues to read the worktree.

## How to get to it (user POV)

Review → tab "Review" → decision row "1 Readme walkthrough" → region "1. Readme walkthrough" → article "Step New line".

## Driving it with browser

Preconditions: [surface baseline](README.md).

Start `$C start`, pair using the card, and set `$REPO` to its fixture repository path.

1. `$C agent publish-review "Readme walkthrough" --context` commits the fixture and publishes its verdict.
2. Open Review → tab "Review" → "1 Readme walkthrough". The context step shows "A change to review.".
3. Rewrite README.md on disk with `printf '# Sample repository\n\nRewritten.\n' > "$REPO/README.md"`.
4. The step still shows "A change to review." and does not substitute "Rewritten.". `$C server published-review` still reports the pointer as current at the stored revision.

Automated coverage: `changes-step-lines.test.tsx`.

## Gotchas

The sidebar row joins number and title without punctuation; the region adds a period. Context steps claim no changed file. Stored excerpts and the live worktree file view can intentionally show different text.
