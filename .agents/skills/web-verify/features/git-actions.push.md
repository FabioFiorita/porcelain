---
route: /
selectors:
  - "Git actions"
  - "Push"
  - "Pull"
  - "No upstream branch to pull from."
tests:
  - apps/web/spec/integration/git-actions-push.test.tsx
api:
  - GET /api/worktrees/:worktreeId/git/status
  - POST /api/worktrees/:worktreeId/git/actions
---

# git-actions.push

Pushing a branch without an upstream to a remote whose URL Porcelain cannot use is refused with how to change it, in the Git button's box, which keeps the reason until closed instead of a passing toast; Pull stays unavailable and the branch gains no upstream.

## Sub-features

- `git-actions.push` — Push entry, progress and remote readback.

## How to get to it (user POV)

- Git actions → menuitem "Push" (label "Push", description "Send committed changes").
- The Git button itself (left of Git actions) once the tree is clean and the branch is ahead of its upstream: it reads "Push" and runs the push directly.

## Driving it with browser

Preconditions: [surface baseline](README.md).

### Setup

`REPO` is `connection.json`’s `fixtures.repositoryPath`. Add a remote with a `git://` URL, which Porcelain refuses (it accepts only a local path, SSH and plain HTTPS):

```sh
git -C "$REPO" remote add origin git://127.0.0.1:9/remote.git
```

1. Click button `Git actions`
   Expect: menuitem starting "Push" is enabled; menuitem starting "Pull" has `aria-disabled="true"` and reads "No upstream branch to pull from."
2. Click menuitem `/^Push/`
   Expect: a `dialog` "Push did not run" anchored to the Git button, with an `alert` reading "The remote URL is not one Porcelain can use. It supports a local path, SSH, and HTTPS without a user name, password or query in the URL. Change it with git remote set-url, or run this action from a terminal." (`git remote set-url` in code style).
3. Wait about 6 seconds (longer than a toast lasts), then inspect the accessibility tree
   Expect: dialog "Push did not run" is still there (it does not time out like a toast).
4. Press `Escape`
   Expect: dialog "Push did not run" is gone.

### Observable proof

Push did not run stays until Escape; no upstream is configured. Read `rev-parse --abbrev-ref main@{upstream}` failure and empty `config --get branch.main.remote`; retain action request.

Automated coverage: `git-actions-push.test.tsx`.

## Gotchas

- Use `/^Push/` and `/^Pull/`: menu names include descriptions/reasons. While Reading the configured upstream., Push/Pull/Fetch disable; reopen after it settles if needed.
- Remove the fixture remote afterward with `git -C "$REPO" remote remove origin`.
