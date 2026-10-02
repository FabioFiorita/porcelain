---
route: /
selectors:
  - "Review"
  - "Branch"
  - "checkpoint"
tests:
  - apps/web/spec/e2e/changes-branch-base.e2e.ts
api:
  - GET /api/worktrees/:worktreeId/branch-bases
  - GET /api/worktrees/:worktreeId/branch-changes
---

# changes.branch-base

## What it is

Choosing another base branch compares the branch against it, keeps the choice in the address, and choosing the default branch again returns to the default comparison.

## How a user reaches it

- Review → Changes → Branch → Against … → branch

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start`.

### Choosing another base compares the branch against it and the default brings the default comparison back

Before driving, on the instance (the sample repository and project home are in the instance file):

- create the branch `feature`
- switch the sample repository to `feature`
- write `first.md` in the sample repository
- commit everything in the sample repository as “First on the branch”
- create the branch `checkpoint`
- write `second.md` in the sample repository
- commit everything in the sample repository as “Second on the branch”

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Review"`
   Look for: the page settles; take a snapshot to read what it shows.
2. `.agents/skills/web-verify/scripts/cli click --role tab --name "Branch"`
   Look for: the text “2 commits on feature since main” shows.
3. `.agents/skills/web-verify/scripts/cli click --role button --name "Compare against the default branch"`
   Look for: the page settles; take a snapshot to read what it shows.
4. `.agents/skills/web-verify/scripts/cli click --role option --name "checkpoint"`
   Look for: the text “1 commit on feature since checkpoint” shows; the button “second.md · added” shows; the button “first.md · added” is gone.
5. `.agents/skills/web-verify/scripts/cli click --role button --name "Compare against checkpoint"`
   Look for: the page settles; take a snapshot to read what it shows.
6. `.agents/skills/web-verify/scripts/cli click --role option --name "/^main/u"`
   Look for: the text “2 commits on feature since main” shows.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/e2e/changes-branch-base.e2e.ts` (Playwright e2e): choosing another base compares the branch against it and the default brings the default comparison back.
- The tests read back what the server kept through the kit: `server.branchChanges()`.

## Gotchas

- The CLI browser is phone width (414 by 896), so the review panel opens from the Review button instead of standing beside the document.
