---
route: /
selectors:
  - "Commit"
  - "Message"
  - "Commit selected files"
tests:
  - apps/web/spec/integration/git-actions-commit-branch-moved.test.tsx
api:
  - POST /api/worktrees/:worktreeId/git/actions
---

# git-actions.commit-branch-moved

## What it is

A commit expects the branch the dialog looked at when it opened, so switching the worktree to another branch on the same commit afterwards makes the commit refused as changed since looked.

## How a user reaches it

- Commit → Message → Commit selected files

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start`.

### A commit is refused when the worktree switched branch after the dialog opened, even on the same commit

Before driving, on the instance (the sample repository and project home are in the instance file):

- create the branch `journey-moved`
- switch the sample repository to `journey-moved`

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Commit"`
   Look for: the text shows; the text “journey-moved” shows.
2. `.agents/skills/web-verify/scripts/cli fill --role textbox --name "Message" "Moved commit"`
   Look for: the page settles; take a snapshot to read what it shows.
3. `.agents/skills/web-verify/scripts/cli click --role button --name "Commit selected files"`
   Look for: the alert reads /changed since looked/i.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/integration/git-actions-commit-branch-moved.test.tsx` (Browser Mode integration): a commit is refused when the worktree switched branch after the dialog opened, even on the same commit.
- The tests read back what the server kept through the kit: `server.commits()`, `server.gitStatus()`.

## Gotchas

- None known.
