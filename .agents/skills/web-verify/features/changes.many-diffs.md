---
route: /
selectors:
  - "Review"
  - "All changes"
  - "The changes in this document could not be read."
tests:
  - apps/web/spec/integration/changes-many-diffs.test.tsx
api:
  - GET /api/worktrees/:worktreeId/changes
  - POST /api/worktrees/:worktreeId/changes/diffs
---

# changes.many-diffs

## What it is

All changes reads the diffs of more tracked changes than one request may carry in several requests and shows them.

## How a user reaches it

- Review → All changes, in a worktree with more tracked changes than one diff request holds

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start`.

### All changes shows the diffs of more tracked changes than one diff request holds

Before driving, on the instance (the sample repository and project home are in the instance file):

- write `README.md` in the sample repository
- commit everything in the sample repository as “Add many notes”
- write `README.md` in the sample repository

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Review"`
   Look for: the page settles; take a snapshot to read what it shows.
2. `.agents/skills/web-verify/scripts/cli click --role button --name "All changes"`
   Look for: the text “<paths[0]> changed” shows; the text “The changes in this document could not be read.” is gone.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/integration/changes-many-diffs.test.tsx` (Browser Mode integration): All changes shows the diffs of more tracked changes than one diff request holds.
- The tests read back what the server kept through the kit: `server.changeDiffHits()`, `server.changes()`.

## Gotchas

- The CLI browser is phone width (414 by 896), so the review panel opens from the Review button instead of standing beside the document.
