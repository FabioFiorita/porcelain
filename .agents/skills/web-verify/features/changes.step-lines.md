---
route: /
selectors:
  - "Review"
  - "Step "
  - "Existing code it relies on"
  - "Code changed since the review was written."
tests:
  - apps/web/spec/integration/changes-step-lines.test.tsx
api:
  - GET /api/worktrees/:worktreeId/changes/lines
  - GET /api/worktrees/:worktreeId/review
---

# changes.step-lines

## What it is

A published context step shows the text retained at its committed revision. Worktree edits leave its pointer and excerpt unchanged. The separate live file view continues to read the worktree.

## How a user reaches it

Review → tab "Review" → decision row "1 Readme walkthrough" → region "1. Readme walkthrough" → article "Step New line".

## Driving it

Start `$C start`, pair using the card, and set `$REPO` to its fixture repository path.

1. `$C agent publish-review "Readme walkthrough" --context` commits the fixture and publishes its verdict.
2. Open Review → tab "Review" → "1 Readme walkthrough". The context step shows "A change to review.".
3. Rewrite README.md on disk with `printf '# Sample repository\n\nRewritten.\n' > "$REPO/README.md"`.
4. The step still shows "A change to review." and does not substitute "Rewritten.". `$C server published-review` still reports the pointer as current at the stored revision.

## What proves it works

`apps/web/spec/integration/changes-step-lines.test.tsx` checks the original excerpt and its retention after a live edit. Server retained-review integration separately reads the stored text after worktree removal.

## Gotchas

The sidebar row joins number and title without punctuation; the region adds a period. Context steps claim no changed file. Stored excerpts and the live worktree file view can intentionally show different text.
