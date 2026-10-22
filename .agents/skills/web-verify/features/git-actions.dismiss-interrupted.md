---
route: /
selectors:
  - "Commit"
  - "Message"
  - "Commit selected files"
  - "A Git action was interrupted:"
  - "Check the current changes before trying again."
  - "Got it"
tests:
  - apps/web/spec/integration/git-actions-dismiss-interrupted.test.tsx
api:
  - DELETE /api/worktrees/:worktreeId/git/interrupted/:requestId
  - POST /api/worktrees/:worktreeId/git/actions
---

# git-actions.dismiss-interrupted

A Git action that outlives its deadline ends interrupted ("outcome unknown"); the review shows a notice naming the action until Got it dismisses it, and the server keeps the receipt as interrupted.

## How to get to it (user POV)

- Any Git action (Commit, Stash changes, Pop stash, Push…) that runs past the server's Git action deadline ends interrupted; the notice appears at the top of region "Review content".
- A server restart while an action is running also marks it interrupted, so the notice shows on the next load.
- The notice (role `status`, text "A Git action was interrupted: commit") → button "Got it".

## Driving it with browser

Preconditions: [surface baseline](README.md).

Required instance mode: `$C start --git-interruption`; the blocked Git action ends after 1.5 seconds, unlike ordinary startup.

### Setup

`REPO` is `connection.json`’s `fixtures.repositoryPath`. Make Git block forever on its reflog by replacing it with a named pipe:

```sh
rm "$REPO/.git/logs/HEAD"
mkfifo "$REPO/.git/logs/HEAD"
```

1. Click button `Commit`
   Expect: dialog "Commit changes" with textbox "Message" and button "Commit selected files"; README.md listed under Files.
2. Fill textbox `Message` with 'Stuck commit'
   Expect: the textbox holds "Stuck commit"; button "Commit selected files" is enabled.
3. Click button `Commit selected files`
   Expect: button "Committing…" (disabled) and status "running" for about 1.5 seconds; a separate tool call may land after it, so go on to step 4.
4. Wait for text 'outcome unknown', then inspect the accessibility tree
   Expect: inside dialog "Commit changes", an `alert` reading "outcome unknown"; button "Commit selected files" is back.
5. Press `Escape`
   Expect: the dialog is gone; at the top of region "Review content" a `status` with "A Git action was interrupted: commit", "Check the current changes before trying again." and button "Got it". README.md is still listed as changed (`git -C "$REPO" status --short` prints ` M README.md`).
6. Navigate to `/`
   Expect: the same notice is still there after the reload (the server kept it).
7. Click button `Got it`
   Expect: the `status` "A Git action was interrupted: commit" is gone.
8. Inspect HTTP traffic
   Expect: `DELETE /api/worktrees/<id>/git/interrupted/<requestId>` answered 200. (if your driver resets its log on page load, the `POST /api/worktrees/<id>/git/actions` answered 202 shows only in network log taken before step 6.) `$C server receipt <requestId>`, with the id from that DELETE, prints `"action": "commit"`, `"state": "interrupted"` and `"reason": "OUTCOME_UNKNOWN"`: dismissing the notice keeps the receipt.
9. Navigate to `/`
   Expect: the notice does not come back.

### Observable proof

Reload before/after Got it: interrupted notice persists then stays absent. DELETE answers 200; Git history remains Initial commit.

Automated coverage: `git-actions-dismiss-interrupted.test.tsx`.

## Gotchas

- The server kills the stuck Git with SIGKILL, so its lock files stay behind and every later Git action in this instance fails or hangs. Clean up before driving another feature: `rm -f "$REPO/.git/logs/HEAD" "$REPO"/.git/*.lock "$REPO/.git/refs/heads/main.lock"` (a live run left `.git/HEAD.lock` and `.git/next-index-<pid>.lock`), or `stop` and `start` a fresh instance.
- The request id for `server receipt` is the last path segment of the DELETE in network log.
- Escape closes the dialog only once the action has settled (the dialog refuses to close while busy); wait for the alert first.
