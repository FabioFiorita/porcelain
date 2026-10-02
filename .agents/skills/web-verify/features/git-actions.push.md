---
route: /
selectors:
  - "Git actions"
tests:
  - apps/web/spec/integration/git-actions-push.test.tsx
api:
  - GET /api/worktrees/:worktreeId/git/status
  - POST /api/worktrees/:worktreeId/git/actions
---

# git-actions.push

## What it is

Pushing a branch without an upstream to a remote whose URL Porcelain cannot use is refused with how to change it in the Git button box, which keeps the result until closed instead of a passing toast, while Pull stays unavailable and the branch gains no upstream.

## How a user reaches it

- Git actions → Push

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start`.

### Pushing to a remote whose address Porcelain cannot use is refused in the Git button box, which keeps the reason until closed, and the branch gains no upstream

Before driving, on the instance (the sample repository and project home are in the instance file):

- add the Git remote `origin` on the remote computer

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Git actions"`
   Look for: the menuitem “/^Push/” is enabled; the menuitem “/^Pull/” has aria-disabled="true".
2. `.agents/skills/web-verify/scripts/cli click --role menuitem --name "/^Push/"`
   Look for: the dialog “Push did not run” shows.
3. `.agents/skills/web-verify/scripts/cli press Escape`
   Look for: the dialog “Push did not run” is gone.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/integration/git-actions-push.test.tsx` (Browser Mode integration): pushing to a remote whose address Porcelain cannot use is refused in the Git button box, which keeps the reason until closed, and the branch gains no upstream.
- The tests read back what the server kept through the kit: `server.gitStatus()`.

## Gotchas

- The tests start a second disposable server as the remote computer; the CLI starts one server, so pairing a remote needs a second instance started with `start` and a pairing link issued on it.
