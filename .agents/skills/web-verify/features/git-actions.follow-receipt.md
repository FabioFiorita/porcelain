---
route: /
selectors:
  - "Commit"
  - "Message"
  - "Commit selected files"
  - "Committing…"
  - "Git actions"
  - "Stash changes"
  - "Pop stash"
  - "Working…"
tests:
  - apps/web/spec/integration/git-actions-follow-receipt.test.tsx
api:
  - GET /api/worktrees/:worktreeId/git/receipts/:requestId
  - POST /api/worktrees/:worktreeId/git/actions
---

# git-actions.follow-receipt

## What it is

A Git action that settles while the live connection is down stays in progress ("Committing…", "Working…") until the app reconnects; then the app reads the action's receipt and shows how it ended, whether it succeeded or Git refused it.

## How a user reaches it

- Commit → Commit selected files, or Git actions → Pop stash → Pop stash, while the live connection is down (network blip, phone asleep); the outcome appears once it reconnects.
- On every reconnect (and on the first live `ready` after a page load) the app reads `GET …/git/receipts/:requestId` for each action it still follows.

## Driving it

Start with `$C start`; pair your browser using the card’s pairing-link command; `REPO` is `connection.json` → `fixtures.repositoryPath`. The live outage cuts the page's live connection and keeps new ones closed until restoring live traffic, which waits until the page has reconnected (up to 15 s; the web backs off up to 10 s between attempts).

### 1. A commit settled while the live connection is down shows its outcome once it is back

1. Click button named `Commit`
   Look for: dialog "Commit changes" with textbox "Message".
2. Replace the contents of textbox named `Message` with 'Followed commit'
   Look for: button "Commit selected files" is enabled.
3. Drop the live WebSocket and reject reconnects (see [routing recipes and per-map instructions](../references/failure-injection.md))
   Look for: the active socket closes and new live connections are rejected.
4. Click button named `Commit selected files`, then after a few seconds Inspect the accessibility tree
   Look for: button "Committing…" [disabled] and an empty status, though `git -C "$REPO" log -1 --format=%s` already prints `Followed commit`.
5. Restore the live WebSocket and wait for the app to reconnect (see [routing recipes and per-map instructions](../references/failure-injection.md)), then wait for text 'succeeded' to be visible
   Look for: the live connection reconnects; the dialog's status reads "succeeded". Inspect HTTP requests and responses lists `GET /api/worktrees/<id>/git/receipts/<requestId>` 200 after the restore; `$C server receipt <requestId>` prints `"action": "commit"` and `"state": "succeeded"`.
6. Press `Escape`
   Look for: the dialog is gone.

### 2. A stash pop Git refused while the live connection is down shows what Git said once it is back

Setup, after section 1 (or after `git -C "$REPO" commit -am "Followed commit"` on a fresh instance): `printf 'Set aside\n' > "$REPO/README.md"`, then wait for button named `Mark README.md as reviewed` to be visible.

1. Click button named `Git actions`, click menuitem named `/^Stash changes/`, then click button named `Stash changes`
   Look for: Text 'succeeded' is visible; then press `Escape`.
2. On disk: `printf 'Changed while the stash was set aside\n' > "$REPO/README.md"`, then wait for button named `Mark README.md as reviewed` to be visible.
3. Click button named `Git actions`, then click menuitem named `/^Pop stash/`
   Look for: dialog "Pop stash" with combobox "Stash" on option "On main: Porcelain review · <id>", checkbox "Restore staged changes" and button "Pop stash".
4. Drop the live WebSocket and reject reconnects (see [routing recipes and per-map instructions](../references/failure-injection.md)), click button named `Pop stash`, then after a few seconds Inspect the accessibility tree
   Look for: button "Working…" [disabled]; the outcome remains unconfirmed; `cat "$REPO/README.md"` still prints `Changed while the stash was set aside`.
5. Restore the live WebSocket and wait for the app to reconnect (see [routing recipes and per-map instructions](../references/failure-injection.md)), then wait for text '/would be overwritten/' to be visible
   Look for: alert "error: Your local changes to the following files would be overwritten by merge: README.md …"; button "Pop stash" back; README.md unchanged; a receipt `GET …/git/receipts/<requestId>` 200 in the browser network log.

## What proves it works

- With the live connection down, "Committing…" and "Working…" stay disabled although Git already finished; after restoring live traffic the receipt read brings "succeeded" for the commit (and the server's receipt says so) and the alert "…would be overwritten…" for the pop, with README.md untouched.
- `apps/web/spec/integration/git-actions-follow-receipt.test.tsx`: with the live connection dropped, the commit lands on the server while the dialog keeps button "Committing…" disabled, and "succeeded" appears only after the connection is restored; the refused pop keeps button "Working…" disabled until reconnect, then shows the alert "would be overwritten" and the file keeps its local text.
- Both cases keep the outage until a real reconnect attempt has been refused, then restore and wait for the receipt's visible outcome. A raw socket-open poll with a one-second deadline races the app's exponential reconnect backoff (500 ms, one second, two seconds, up to ten seconds). The fixture closes connecting sockets while offline, which can also produce a Vite WebSocket proxy `EPIPE`; that log does not establish a receipt-read failure. Test, action and assertion deadlines stay unchanged.

## Gotchas

- Without the live outage the outcome arrives over the live connection at once and the receipt path is never taken.
- Section 2 leaves a stash and a modified README.md behind; `git -C "$REPO" stash drop` and `git -C "$REPO" checkout README.md` reset it, or start a fresh instance.
