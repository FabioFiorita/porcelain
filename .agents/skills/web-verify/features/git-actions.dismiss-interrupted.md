---
route: /
selectors:
  - "Commit"
  - "Message"
  - "Commit selected files"
  - "Check the current changes before trying again."
  - "Got it"
tests:
  - apps/web/spec/integration/git-actions-dismiss-interrupted.test.tsx
api:
  - DELETE /api/worktrees/:worktreeId/git/interrupted/:requestId
  - POST /api/worktrees/:worktreeId/git/actions
---

# git-actions.dismiss-interrupted

## What it is

A Git action that outlives its deadline ends interrupted, the review shows a notice naming it until Got it dismisses it, and the server keeps its receipt.

## How a user reaches it

- a Git action that ends interrupted → Review content → A Git action was interrupted → Got it

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start`.

### A commit that Git never finishes ends interrupted, and its notice stays until Got it dismisses it

Before driving, on the instance (the sample repository and project home are in the instance file):

- delete `.git/logs/HEAD` from the sample repository
- replace `.git/logs/HEAD` with a named pipe, so Git blocks on it

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Commit"`
   Look for: the page settles; take a snapshot to read what it shows.
2. `.agents/skills/web-verify/scripts/cli fill --role textbox --name "Message" "Stuck commit"`
   Look for: the page settles; take a snapshot to read what it shows.
3. `.agents/skills/web-verify/scripts/cli click --role button --name "Commit selected files"`
   Look for: the alert reads 'outcome unknown'.
4. `.agents/skills/web-verify/scripts/cli press Escape`
   Look for: the dialog is gone; the status shows; the text “Check the current changes before trying again.” shows.
5. `.agents/skills/web-verify/scripts/cli click --role button --name "Got it"`
   Look for: the status is gone.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/integration/git-actions-dismiss-interrupted.test.tsx` (Browser Mode integration): a commit that Git never finishes ends interrupted, and its notice stays until Got it dismisses it.
- The tests read back what the server kept through the kit: `server.changes()`, `server.receipt()`.

## Gotchas

- None known.
