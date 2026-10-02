---
route: /
selectors:
  - "Commit"
  - "Apply stash"
  - "Git actions"
  - "Stash changes"
  - "succeeded"
tests:
  - apps/web/spec/integration/git-actions-suggested-step.test.tsx
api:
  - GET /api/worktrees/:worktreeId/git/status
  - POST /api/worktrees/:worktreeId/git/actions
---

# git-actions.suggested-step

## What it is

Once nothing is left to commit, pull or push, the Git button suggests applying the waiting stash, and following it brings the stashed changes back.

## How a user reaches it

- The Git button beside Git actions, once the changes are stashed → Apply stash

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start`.

### The Git button suggests applying a waiting stash once the tree is clean, and applying it brings the changes back

```sh
.agents/skills/web-verify/scripts/cli open /
```

After `open`, look for: the button “Commit” shows.
After `open`, look for: the button “Apply stash” is gone.
1. `.agents/skills/web-verify/scripts/cli click --role button --name "Git actions"`
   Look for: the page settles; take a snapshot to read what it shows.
2. `.agents/skills/web-verify/scripts/cli click --role menuitem --name "/^Stash changes/"`
   Look for: the page settles; take a snapshot to read what it shows.
3. `.agents/skills/web-verify/scripts/cli click --role button --name "Stash changes"`
   Look for: the text “succeeded” shows.
4. `.agents/skills/web-verify/scripts/cli press Escape`
   Look for: the dialog “Stash changes” is gone; the button “Apply stash” shows; the button “Apply stash” reads 'Apply stash'.
5. `.agents/skills/web-verify/scripts/cli click --role button --name "Apply stash"`
   Look for: the page settles; take a snapshot to read what it shows.
6. `.agents/skills/web-verify/scripts/cli click --role button --name "Apply stash"`
   Look for: the text “succeeded” shows.
7. `.agents/skills/web-verify/scripts/cli press Escape`
   Look for: the button “Apply stash” is gone.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/integration/git-actions-suggested-step.test.tsx` (Browser Mode integration): the Git button suggests applying a waiting stash once the tree is clean, and applying it brings the changes back.
- The tests read back what the server kept through the kit: `server.changes()`, `server.gitStatus()`, `server.text()`.

## Gotchas

- None known.
