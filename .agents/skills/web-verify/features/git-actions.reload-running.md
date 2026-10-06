# git-actions.reload-running

## What it is

A Git action still running when the page reloads is still followed after the reload: the app keeps its request in session storage, the commit form shows "Outcome not yet confirmed" and refuses another commit, then shows how the action ended once the app reads its receipt.

## How a user reaches it

- Commit → Commit selected files → reload (or the tab is restored) before the app hears the outcome → Commit again.
- Any Git action from the Git button or Git actions menu is followed the same way; the commit form is the one the test drives.

## Driving it

Start with `$C start`; `REPO` is the repository path it printed. The disposable server ends a blocked Git action after 1.5 seconds (`gitActionDeadlineMs: 1500`); cutting the live connection before the commit keeps the page from hearing that outcome, so the reload happens while the page still follows a running action, as the test's held live notices do.
After each start, use the skill’s in-app attachment workflow: open the fresh attachment page in an owned tab and follow "Open workspace".

This controlled case requires live-connection drop, blocked reconnect attempts across a reload and restoration. The selected in-app browser presently does not expose these controls. Record this interactive case as unavailable. The named automated regressions are separate evidence.

### Setup

Make Git block on its reflog:

```sh
rm "$REPO/.git/logs/HEAD"
mkfifo "$REPO/.git/logs/HEAD"
```

1. Click the button named 'Commit'
   Look for: dialog "Commit changes" with textbox "Message".
2. Set the text field named 'Message' to 'Commit across a reload'
   Look for: button "Commit selected files" is enabled.
3. Drop the page’s live connection and keep reconnect attempts closed, then click the button named 'Commit selected files'
   Look for: button "Committing…" [disabled] in the dialog.
4. Open `/` on the instance web URL
   Look for: the page reloads to the workspace (new live connections still close); region "Review content" shows the status "A Git action was interrupted: commit" once the app has read the receipt.
5. Click the button named 'Commit'
   Look for: dialog "Commit changes" with status "Outcome not yet confirmed" and button "Commit selected files" [disabled]: the reloaded page still follows the commit.
6. Restore the page’s live connection and wait for reconnection, then wait for the text 'interrupted'
   Look for: the live connection reconnects; the dialog’s status now reads "interrupted" and "Outcome not yet confirmed" is gone.

## What proves it works

- After a reload while the action runs: "Outcome not yet confirmed" with Commit selected files disabled, then the `status` "interrupted" and "Outcome not yet confirmed" gone; browser network evidence shows `GET /api/worktrees/<id>/git/receipts/<requestId>` with status 200 after the reload, and `server receipt <requestId>` prints the commit's receipt.
- `git -C "$REPO" log --format=%s` still prints only `Initial commit`.
- `apps/web/spec/e2e/git-actions-reload-running.e2e.ts`: with live notices held, the commit is running ("Committing…" disabled, "running") when the page reloads; after the reload the commit form shows "Outcome not yet confirmed" and a disabled Commit selected files; releasing the live notices shows "interrupted" and removes "Outcome not yet confirmed"; the server reports the commit as the interrupted action.

## Gotchas

- dropping the live connection must come before the commit click: the 1.5-second deadline passes long before a reload completes, and a connected page hears the outcome at once and forgets the action.
- The server kills the stuck Git with SIGKILL, leaving lock files: run `rm -f "$REPO/.git/logs/HEAD" "$REPO"/.git/*.lock "$REPO/.git/refs/heads/main.lock"` and dismiss the notice with button "Got it" before driving another Git feature, or start a fresh instance.
