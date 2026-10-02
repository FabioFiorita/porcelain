---
route: /
selectors:
  - "Review"
  - "All changes"
  - "The changes in this document could not be read."
  - "Loading changes…"
tests:
  - apps/web/spec/integration/changes-diff-recovery.test.tsx
api:
  - GET /api/worktrees/:worktreeId/changes
  - POST /api/worktrees/:worktreeId/changes/diffs
---

# changes.diff-recovery

## What it is

A worktree change during diff loading refreshes the change list once and shows the new diff without leaving a loading or failure notice.

## How a user reaches it

- Review → All changes, while another writer changes a file before the diff request reaches the server

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start`.

### A file changed before its diff request reaches the server recovers to the new diff

Before driving, on the instance (the sample repository and project home are in the instance file):

- write `second.md` in the sample repository
- commit everything in the sample repository as “Add a second file”
- write `second.md` in the sample repository
- write `README.md` in the sample repository
- write `README.md` in the sample repository

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Review"`
   Look for: the page settles; take a snapshot to read what it shows.
2. `.agents/skills/web-verify/scripts/cli click --role button --name "All changes"`
   Look for: the text “An earlier change to review.” shows.
3. `.agents/skills/web-verify/scripts/cli click --role button --name "Review"`
   Look for: the text “A newer change to review.” shows; the text “The changes in this document could not be read.” is gone; the text “Loading changes…” is gone.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/integration/changes-diff-recovery.test.tsx` (Browser Mode integration): a file changed before its diff request reaches the server recovers to the new diff.
- The tests read back what the server kept through the kit: `server.changeDiffHits()`, `server.changeListHits()`.

## Gotchas

- The CLI browser is phone width (414 by 896), so the review panel opens from the Review button instead of standing beside the document.
- The tests hold or drop the live connection or a request to reach a race; the CLI cannot, so an agent drives the ordinary path and leaves the race to the tests.
