---
route: /
selectors:
  - "Review"
  - "Branch"
tests:
  - apps/web/spec/integration/changes-branch-marks.test.tsx
api:
  - GET /api/worktrees/:worktreeId/branch-bases
  - GET /api/worktrees/:worktreeId/branch-changes
  - GET /api/worktrees/:worktreeId/reviewed
  - PUT /api/worktrees/:worktreeId/reviewed-bulk
---

# changes.branch-marks

## What it is

A file marked reviewed in the branch review stays reviewed only on that branch: another branch in the same worktree starts its review fresh, and switching back shows the mark again.

## How a user reaches it

- Review → Changes → Branch → file → Mark reviewed

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start`.

### A branch mark belongs to its branch: another branch starts fresh and switching back finds it

Before driving, on the instance (the sample repository and project home are in the instance file):

- create the branch `feature`
- switch the sample repository to `feature`
- write `notes.md` in the sample repository
- commit everything in the sample repository as “Add notes”
- create the branch `copy`
- switch the sample repository to `copy`
- switch the sample repository to `feature`

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Review"`
   Look for: the page settles; take a snapshot to read what it shows.
2. `.agents/skills/web-verify/scripts/cli click --role tab --name "Branch"`
   Look for: the page settles; take a snapshot to read what it shows.
3. `.agents/skills/web-verify/scripts/cli click --role button --name "notes.md · added"`
   Look for: the page settles; take a snapshot to read what it shows.
4. `.agents/skills/web-verify/scripts/cli click --role button --name "Mark notes.md as reviewed"`
   Look for: the button “Mark notes.md as reviewed” shows; the button “Unmark notes.md as unreviewed” shows.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/integration/changes-branch-marks.test.tsx` (Browser Mode integration): a branch mark belongs to its branch: another branch starts fresh and switching back finds it.
- The tests read back what the server kept through the kit: `server.branchChanges()`, `server.reviewedFiles()`.

## Gotchas

- The CLI browser is phone width (414 by 896), so the review panel opens from the Review button instead of standing beside the document.
