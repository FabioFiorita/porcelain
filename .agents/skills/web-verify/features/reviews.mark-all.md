---
route: /
selectors:
  - "Mark all 2 files reviewed"
tests:
  - apps/web/spec/integration/reviews-mark-all.test.tsx
api:
  - DELETE /api/worktrees/:worktreeId/reviewed
  - DELETE /api/worktrees/:worktreeId/reviewed-bulk
  - GET /api/worktrees/:worktreeId/reviewed
  - PUT /api/worktrees/:worktreeId/reviewed
  - PUT /api/worktrees/:worktreeId/reviewed-bulk
---

# reviews.mark-all

## What it is

Marking all changed files reviewed marks every one in one step, a file that changes on disk afterwards is offered for review again, and unmarking all clears every mark.

## How a user reaches it

- All changes → Mark all reviewed

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start`.

### Marking all changed files reviewed marks each one, a file changed on disk asks for review again, and unmarking all clears them

Before driving, on the instance (the sample repository and project home are in the instance file):

- write `NOTES.md` in the sample repository
- write `NOTES.md` in the sample repository

```sh
.agents/skills/web-verify/scripts/cli open /
```

After `open`, look for: the button “Mark all 2 files reviewed” shows.
1. `.agents/skills/web-verify/scripts/cli click --role button --name "Mark all 2 files reviewed"`
   Look for: the button “Unmark all” is enabled; the button “Mark all 1 files reviewed” is enabled.
2. `.agents/skills/web-verify/scripts/cli click --role button --name "Mark all 1 files reviewed"`
   Look for: the button “Unmark all” is enabled.
3. `.agents/skills/web-verify/scripts/cli click --role button --name "Unmark all"`
   Look for: the button “Mark all 2 files reviewed” is enabled.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/integration/reviews-mark-all.test.tsx` (Browser Mode integration): marking all changed files reviewed marks each one, a file changed on disk asks for review again, and unmarking all clears them.
- The tests read back what the server kept through the kit: `server.changes()`, `server.reviewedFiles()`.

## Gotchas

- None known.
