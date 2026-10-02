---
route: /
selectors:
  - "Commit"
  - "Message"
  - "Commit selected files"
  - "succeeded"
tests:
  - apps/web/spec/integration/git-actions-commit.test.tsx
api:
  - POST /api/worktrees/:worktreeId/git/actions
---

# git-actions.commit

## What it is

A commit with a typed message from the web succeeds and becomes the newest commit in the real repository history.

## How a user reaches it

- Commit → Message → Commit selected files

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start`.

### A commit with a typed message succeeds and becomes the newest commit

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Commit"`
   Look for: the dialog shows.
2. `.agents/skills/web-verify/scripts/cli fill --role textbox --name "Message" "Browser commit"`
   Look for: the page settles; take a snapshot to read what it shows.
3. `.agents/skills/web-verify/scripts/cli click --role button --name "Commit selected files"`
   Look for: the text “succeeded” shows.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/integration/git-actions-commit.test.tsx` (Browser Mode integration): a commit with a typed message succeeds and becomes the newest commit.
- The tests read back what the server kept through the kit: `server.commits()`.

## Gotchas

- None known.
