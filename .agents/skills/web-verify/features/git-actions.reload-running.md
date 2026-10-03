---
route: /
selectors:
  - "Commit"
  - "Message"
  - "Commit selected files"
  - "Committing…"
  - "Outcome not yet confirmed"
  - "A Git action was interrupted:"
tests:
  - apps/web/spec/e2e/git-actions-reload-running.e2e.ts
api:
  - GET /api/worktrees/:worktreeId/git/receipts/:requestId
  - POST /api/worktrees/:worktreeId/git/actions
---

# git-actions.reload-running

## What it is

A Git action still running when the page reloads is still followed after the reload: the app keeps its request in session storage, the commit form shows "Outcome not yet confirmed" and refuses another commit, then shows how the action ended once the app reads its receipt.

## How a user reaches it

- Commit → Commit selected files → reload (or the tab is restored) before the app hears the outcome → Commit again.
- Any Git action from the Git button or Git actions menu is followed the same way; the commit form is the one the test drives.

## Driving it

Start with `.agents/skills/web-verify/scripts/cli start`. The CLI's server ends a blocked Git action after 1.5 seconds (`gitActionDeadlineMs: 1500`) and the page hears that over the live connection long before a CLI `open` can reload it, so the CLI reaches only the after-the-fact state below; the reload-while-running race needs a CLI gap (see Gotchas).

### Setup

`REPO` is the repository path `start` printed. Make Git block on its reflog:

```sh
rm "$REPO/.git/logs/HEAD"
mkfifo "$REPO/.git/logs/HEAD"
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Commit"`
   Look for: dialog "Commit changes" with textbox "Message".
2. `.agents/skills/web-verify/scripts/cli fill --role textbox --name "Message" "Commit across a reload"`
   Look for: button "Commit selected files" is enabled.
3. `.agents/skills/web-verify/scripts/cli click --role button --name "Commit selected files"`
   Look for: button "Committing…" (disabled) and a `status` "running" in the dialog.
4. `.agents/skills/web-verify/scripts/cli open /`
   Look for: the page reloads to the workspace; region "Review content" shows the `status` "A Git action was interrupted: commit" (the 1.5-second deadline passed).
5. `.agents/skills/web-verify/scripts/cli click --role button --name "Commit"`
   Look for: dialog "Commit changes". If the reload beat the deadline, `status` "Outcome not yet confirmed" (or "running") shows with button "Commit selected files" disabled, then "interrupted" replaces it; otherwise the form opens fresh, because the page had already followed the action to its end.

## What proves it works

- After a reload while the action runs: "Outcome not yet confirmed" with Commit selected files disabled, then the `status` "interrupted" and "Outcome not yet confirmed" gone; `network` shows `GET /api/worktrees/<id>/git/receipts/<requestId>` with status 200 after the reload.
- `git -C "$REPO" log --format=%s` still prints only `Initial commit`.
- `apps/web/spec/e2e/git-actions-reload-running.e2e.ts`: with live notices held, the commit is running ("Committing…" disabled, "running") when the page reloads; after the reload the commit form shows "Outcome not yet confirmed" and a disabled Commit selected files; releasing the live notices shows "interrupted" and removes "Outcome not yet confirmed"; the server reports the commit as the interrupted action.

## Gotchas

- Unreachable through the CLI: the reload must happen while the page has not yet heard the outcome. The commands that would be needed: `cli live hold` before step 3 and `cli live release` after step 5 (or a longer deadline, `cli start --git-action-deadline-ms 60000`, then `cat "$REPO/.git/logs/HEAD" > /dev/null` to let the commit finish after the reload).
- The server kills the stuck Git with SIGKILL, leaving lock files: run `rm -f "$REPO/.git/logs/HEAD" "$REPO"/.git/*.lock "$REPO/.git/refs/heads/main.lock"` and dismiss the notice with button "Got it" before driving another Git feature, or start a fresh instance.
