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

## What it is

A Git action that outlives its deadline ends interrupted ("outcome unknown"); the review shows a notice naming the action until Got it dismisses it, and the server keeps the receipt as interrupted.

## How a user reaches it

- Any Git action (Commit, Stash changes, Pop stash, Push…) that runs past the server's Git action deadline ends interrupted; the notice appears at the top of region "Review content".
- A server restart while an action is running also marks it interrupted, so the notice shows on the next load.
- The notice (role `status`, text "A Git action was interrupted: commit") → button "Got it".

## Driving it

Start with `.agents/skills/web-verify/scripts/cli start` (phone width is fine). The CLI's server sets the Git action deadline to 1.5 seconds (`gitActionDeadlineMs: 1500` in `apps/server/spec/kit/sandboxed-server.ts`), so a Git that blocks ends interrupted on its own.

### Setup

`REPO` is the repository path `start` printed. Make Git block forever on its reflog by replacing it with a named pipe:

```sh
rm "$REPO/.git/logs/HEAD"
mkfifo "$REPO/.git/logs/HEAD"
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Commit"`
   Look for: dialog "Commit changes" with textbox "Message" and button "Commit selected files"; README.md listed under Files.
2. `.agents/skills/web-verify/scripts/cli fill --role textbox --name "Message" "Stuck commit"`
   Look for: the textbox holds "Stuck commit"; button "Commit selected files" is enabled.
3. `.agents/skills/web-verify/scripts/cli click --role button --name "Commit selected files"`
   Look for: button "Committing…" (disabled) and status "running" for about 1.5 seconds; a CLI command often lands after it, so go on to step 4.
4. `.agents/skills/web-verify/scripts/cli wait --text "outcome unknown"`, then `.agents/skills/web-verify/scripts/cli snapshot`
   Look for: inside dialog "Commit changes", an `alert` reading "outcome unknown"; button "Commit selected files" is back.
5. `.agents/skills/web-verify/scripts/cli press Escape`
   Look for: the dialog is gone; at the top of region "Review content" a `status` with "A Git action was interrupted: commit", "Check the current changes before trying again." and button "Got it". README.md is still listed as changed (`git -C "$REPO" status --short` prints ` M README.md`).
6. `.agents/skills/web-verify/scripts/cli open /`
   Look for: the same notice is still there after the reload (the server kept it).
7. `.agents/skills/web-verify/scripts/cli click --role button --name "Got it"`
   Look for: the `status` "A Git action was interrupted: commit" is gone.
8. `.agents/skills/web-verify/scripts/cli network`
   Look for: `DELETE /api/worktrees/<id>/git/interrupted/<requestId>` answered 200. (`network` lists only the requests since the last page load: the `POST /api/worktrees/<id>/git/actions` answered 202 shows only in a `network` taken before step 6.) `.agents/skills/web-verify/scripts/cli server receipt <requestId>`, with the id from that DELETE, prints `"action": "commit"`, `"state": "interrupted"` and `"reason": "OUTCOME_UNKNOWN"`: dismissing the notice keeps the receipt.
9. `.agents/skills/web-verify/scripts/cli open /`
   Look for: the notice does not come back.

## What proves it works

- The alert "outcome unknown" in the commit dialog, the notice surviving a reload, and the notice gone for good after Got it (step 9) with the DELETE answered 200 in the network log.
- `git -C "$REPO" log --format=%s` still prints only `Initial commit`: the stuck commit never landed.
- `apps/web/spec/integration/git-actions-dismiss-interrupted.test.tsx`: the commit dialog's alert reads "outcome unknown"; the notice names the commit and stays until Got it; the server's changes report the interrupted commit until it is dismissed, and the receipt read back afterwards is still `interrupted`.

## Gotchas

- The server kills the stuck Git with SIGKILL, so its lock files stay behind and every later Git action in this instance fails or hangs. Clean up before driving another feature: `rm -f "$REPO/.git/logs/HEAD" "$REPO"/.git/*.lock "$REPO/.git/refs/heads/main.lock"` (a live run left `.git/HEAD.lock` and `.git/next-index-<pid>.lock`), or `stop` and `start` a fresh instance.
- The request id for `server receipt` is the last path segment of the DELETE in `network`.
- Escape closes the dialog only once the action has settled (the dialog refuses to close while busy); wait for the alert first.
