# git-actions.push

## What it is

Pushing a branch without an upstream to a remote whose URL Porcelain cannot use is refused with how to change it, in the Git button's box, which keeps the reason until closed instead of a passing toast; Pull stays unavailable and the branch gains no upstream.

## How a user reaches it

- Git actions → menuitem "Push" (label "Push", description "Send committed changes").
- The Git button itself (left of Git actions) once the tree is clean and the branch is ahead of its upstream: it reads "Push" and runs the push directly.

## Driving it

Start with `$C start`. Everything runs on the one server; no second computer is involved.
After each start, use the skill’s in-app attachment workflow: open the fresh attachment page in an owned tab and follow "Open workspace".

### Setup

`REPO` is the repository path `start` printed. Add a remote with a `git://` URL, which Porcelain refuses (it accepts only a local path, SSH and plain HTTPS):

```sh
git -C "$REPO" remote add origin git://127.0.0.1:9/remote.git
```

1. Click the button named 'Git actions'
   Look for: menuitem starting "Push" is enabled; menuitem starting "Pull" has `aria-disabled="true"` and reads "No upstream branch to pull from."
2. Click the menu item whose name starts with 'Push'
   Look for: a `dialog` "Push did not run" anchored to the Git button, with an `alert` reading "The remote URL is not one Porcelain can use. It supports a local path, SSH, and HTTPS without a user name, password or query in the URL. Change it with git remote set-url, or run this action from a terminal." (`git remote set-url` in code style).
3. Wait about 6 seconds (longer than a toast lasts), then inspect the current page
   Look for: dialog "Push did not run" is still there (it does not time out like a toast).
4. Press `Escape`
   Look for: dialog "Push did not run" is gone.

## What proves it works

- The dialog "Push did not run" with the remote URL reason, which stays until Escape.
- No upstream was set: `git -C "$REPO" rev-parse --abbrev-ref main@{upstream}` fails with `fatal: no upstream configured for branch 'main'`, and `git -C "$REPO" config --get branch.main.remote` prints nothing.
- Browser network evidence shows the `POST /api/worktrees/<id>/git/actions` for the push.
- `apps/web/spec/integration/git-actions-push.test.tsx`: Push is enabled and Pull `aria-disabled`; the box "Push did not run" shows the remote URL reason and closes on Escape; the server's Git status then reports branch `main` with no upstream, 0 ahead, 0 behind, no stashes.

## Gotchas

- Both menuitem names start with their label and continue with the description (and a reason when disabled), so choose the item whose name starts with "Push" or "Pull".
- Opening the menu starts reading the branch's upstream; until it arrives Push, Pull and Fetch are disabled with "Reading the configured upstream." Press `Escape` and open the menu again if step 1 shows that.
- The remote stays in `.git/config` for the rest of the instance; `git -C "$REPO" remote remove origin` removes it.
