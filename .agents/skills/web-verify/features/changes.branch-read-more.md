---
route: /
selectors:
  - "Review"
  - "Branch"
  - "Some patches could not be read."
tests:
  - apps/web/spec/integration/changes-branch-read-more.test.tsx
api:
  - GET /api/worktrees/:worktreeId/branch-bases
  - GET /api/worktrees/:worktreeId/branch-changes
  - POST /api/worktrees/:worktreeId/branch-changes/diffs
---

# changes.branch-read-more

## What it is

Reading more of a long branch keeps the diffs already shown on screen while the next ones load, and reads only the files it had not read yet.

## How a user reaches it

- Review → Changes → Branch → All branch changes → Read more

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start`.

### Reading more of a long branch keeps the diffs already shown while the next ones load

Before driving, on the instance (the sample repository and project home are in the instance file):

- create the branch `feature`
- switch the sample repository to `feature`
- write ``notes-${String(index).padStart(2` in the sample repository
- commit everything in the sample repository as “Add many notes”

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Review"`
   Look for: the page settles; take a snapshot to read what it shows.
2. `.agents/skills/web-verify/scripts/cli click --role tab --name "Branch"`
   Look for: the page settles; take a snapshot to read what it shows.
3. `.agents/skills/web-verify/scripts/cli click --role button --name "/^All branch changes/u"`
   Look for: the text “A change to review.” shows.
4. `.agents/skills/web-verify/scripts/cli click --role button --name "Read 2 more of 2"`
   Look for: the text “A change to review.” shows; the button “Read 2 more of 2” is gone; the text “Some patches could not be read.” is gone; the text “A change to review.” shows.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/integration/changes-branch-read-more.test.tsx` (Browser Mode integration): reading more of a long branch keeps the diffs already shown while the next ones load.
- The tests read back what the server kept through the kit: `server.branchChanges()`.

## Gotchas

- The CLI browser is phone width (414 by 896), so the review panel opens from the Review button instead of standing beside the document.
- The tests hold or drop the live connection or a request to reach a race; the CLI cannot, so an agent drives the ordinary path and leaves the race to the tests.
