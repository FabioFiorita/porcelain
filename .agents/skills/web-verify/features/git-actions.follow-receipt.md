# git-actions.follow-receipt

## What it is

A Git action that settles while the live connection is down stays in progress ("Committing…", "Working…") until the app reconnects; then the app reads the action's receipt and shows how it ended, whether it succeeded or Git refused it.

## How a user reaches it

- Commit → Commit selected files, or Git actions → Pop stash → Pop stash, while the live connection is down (network blip, phone asleep); the outcome appears once it reconnects.
- On every reconnect (and on the first live `ready` after a page load) the app reads `GET …/git/receipts/:requestId` for each action it still follows.

## Driving it

Start with `$C start`; `REPO` is the repository path it printed. dropping the live connection cuts the page's live connection and keeps new ones closed until restoring the live connection, which waits until the page has reconnected (up to 15 s; the web backs off up to 10 s between attempts).
After each start, use the skill’s in-app attachment workflow: open the fresh attachment page in an owned tab and follow "Open workspace".

This controlled case requires live-connection drop, blocked reconnect attempts and restoration. The selected in-app browser presently does not expose these controls. Record this interactive case as unavailable. The named automated regressions are separate evidence.

### 1. A commit settled while the live connection is down shows its outcome once it is back

1. Click the button named 'Commit'
   Look for: dialog "Commit changes" with textbox "Message".
2. Set the text field named 'Message' to 'Followed commit'
   Look for: button "Commit selected files" is enabled.
3. Drop the page’s live connection and keep reconnect attempts closed
   Look for: the existing live connection is closed and reconnect attempts remain blocked until restoration.
4. Click the button named 'Commit selected files', then after a few seconds inspect the current page
   Look for: button "Committing…" [disabled] and an empty status, though `git -C "$REPO" log -1 --format=%s` already prints `Followed commit`.
5. Restore the page’s live connection and wait for reconnection, then wait for the text 'succeeded'
   Look for: the live connection reconnects; the dialog’s status reads "succeeded". Browser network evidence lists `GET /api/worktrees/<id>/git/receipts/<requestId>` 200 after the restore; `$C server receipt <requestId>` prints `"action": "commit"` and `"state": "succeeded"`.
6. Press `Escape`
   Look for: the dialog is gone.

### 2. A stash pop Git refused while the live connection is down shows what Git said once it is back

Setup, after section 1 (or after `git -C "$REPO" commit -am "Followed commit"` on a fresh instance): `printf 'Set aside\n' > "$REPO/README.md"`, then wait for the button named 'Mark README.md as reviewed'.

1. Click the button named 'Git actions', click the menu item whose name starts with 'Stash changes', then click the button named 'Stash changes'
   Look for: the status reads "succeeded"; then press `Escape`.
2. On disk: `printf 'Changed while the stash was set aside\n' > "$REPO/README.md"`, then wait for the button named 'Mark README.md as reviewed'.
3. Click the button named 'Git actions', then click the menu item whose name starts with 'Pop stash'
   Look for: dialog "Pop stash" with combobox "Stash" on option "On main: Porcelain review · <id>", checkbox "Restore staged changes" and button "Pop stash".
4. Drop the page’s live connection and keep reconnect attempts closed, click the button named 'Pop stash', then after a few seconds inspect the current page
   Look for: status "running" and button "Working…" [disabled]; `cat "$REPO/README.md"` still prints `Changed while the stash was set aside`.
5. Restore the page’s live connection and wait for reconnection, then wait for text containing 'would be overwritten'
   Look for: alert "error: Your local changes to the following files would be overwritten by merge: README.md …"; button "Pop stash" back; README.md unchanged; a receipt `GET …/git/receipts/<requestId>` 200 in browser network evidence.

## What proves it works

- With the live connection down, "Committing…" and "Working…" stay disabled although Git already finished; after restoring the live connection the receipt read brings "succeeded" for the commit (and the server's receipt says so) and the alert "…would be overwritten…" for the pop, with README.md untouched.
- `apps/web/spec/integration/git-actions-follow-receipt.test.tsx`: with the live connection dropped, the commit lands on the server while the dialog keeps button "Committing…" disabled, and "succeeded" appears only after the connection is restored; the refused pop keeps button "Working…" disabled until reconnect, then shows the alert "would be overwritten" and the file keeps its local text.
- Both cases keep the outage until a real reconnect attempt has been refused, then restore and wait for the receipt's visible outcome. A raw socket-open poll with a one-second deadline races the app's exponential reconnect backoff (500 ms, one second, two seconds, up to ten seconds). The fixture closes connecting sockets while offline, which can also produce a Vite WebSocket proxy `EPIPE`; that log does not establish a receipt-read failure. Test, action and assertion deadlines stay unchanged.

## Gotchas

- Without dropping the live connection the outcome arrives over the live connection at once and the receipt path is never taken.
- Section 2 leaves a stash and a modified README.md behind; `git -C "$REPO" stash drop` and `git -C "$REPO" checkout README.md` reset it, or start a fresh instance.
