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
  - "Check outcome"
tests:
  - apps/web/spec/integration/git-actions-follow-receipt.test.tsx
  - apps/web/spec/integration/git-actions-recover-groups.test.tsx
  - apps/web/spec/integration/git-actions-push.test.tsx
api:
  - GET /api/worktrees/:worktreeId/git/receipts/:requestId
  - POST /api/worktrees/:worktreeId/git/actions
---

# git-actions.follow-receipt

A Git action that settles while the live connection is down stays in progress ("Committing…", "Working…") until the app reconnects; then the app reads the action's receipt and shows how it ended, whether it succeeded or Git refused it.

## How to get to it (user POV)

- Commit → Commit selected files, or Git actions → Pop stash → Pop stash, while the live connection is down (network blip, phone asleep); the outcome appears once it reconnects.
- On every reconnect (and on the first live `ready` after a page load) the app reads `GET …/git/receipts/:requestId` for each action it still follows.

## Driving it with browser

Preconditions: [surface baseline](README.md).

Keep live traffic offline through a refused reconnect, then restore and wait for the page to reconnect (up to 15 seconds; backoff can reach 10 seconds).

### 1. A commit settled while the live connection is down shows its outcome once it is back

1. Click button `Commit`
   Expect: dialog "Commit changes" with textbox "Message".
2. Fill textbox `Message` with 'Followed commit'
   Expect: button "Commit selected files" is enabled.
3. Drop the live WebSocket and reject reconnects (see [routing recipes and per-map instructions](../references/failure-injection.md))
   Expect: the active socket closes and new live connections are rejected.
4. Click button `Commit selected files`, then after a few seconds Inspect the accessibility tree
   Expect: button "Committing…" [disabled] and an empty status, though `git -C "$REPO" log -1 --format=%s` already prints `Followed commit`.
5. Restore the live WebSocket and wait for the app to reconnect (see [routing recipes and per-map instructions](../references/failure-injection.md)), then wait for 'succeeded'
   Expect: the live connection reconnects; the dialog's status reads "succeeded". Inspect HTTP traffic lists `GET /api/worktrees/<id>/git/receipts/<requestId>` 200 after the restore; `$C server receipt <requestId>` prints `"action": "commit"` and `"state": "succeeded"`.
6. Press `Escape`
   Expect: the dialog is gone.

### 2. A stash pop Git refused while the live connection is down shows what Git said once it is back

Setup, after section 1 (or after `git -C "$REPO" commit -am "Followed commit"` on a fresh instance): `printf 'Set aside\n' > "$REPO/README.md"`, then wait for button `Mark README.md as reviewed`.

1. Click button `Git actions`, click menuitem `/^Stash changes/`, then click button `Stash changes`
   Expect: Text 'succeeded' is visible; then press `Escape`.
2. On disk: `printf 'Changed while the stash was set aside\n' > "$REPO/README.md"`, then wait for button `Mark README.md as reviewed`.
3. Click button `Git actions`, then click menuitem `/^Pop stash/`
   Expect: dialog "Pop stash" with combobox "Stash" on option "On main: Porcelain review · <id>", checkbox "Restore staged changes" and button "Pop stash".
4. Drop the live WebSocket and reject reconnects (see [routing recipes and per-map instructions](../references/failure-injection.md)), click button `Pop stash`, then after a few seconds Inspect the accessibility tree
   Expect: button "Working…" [disabled]; the outcome remains unconfirmed; `cat "$REPO/README.md"` still prints `Changed while the stash was set aside`.
5. Restore the live WebSocket and wait for the app to reconnect (see [routing recipes and per-map instructions](../references/failure-injection.md)), then wait for '/would be overwritten/'
   Expect: alert "error: Your local changes to the following files would be overwritten by merge: README.md …"; button "Pop stash" back; README.md unchanged; a receipt `GET …/git/receipts/<requestId>` 200 in network log.

### Observable proof

While live traffic is down, completed Git still shows disabled Committing…/Working…. Restore after a refused reconnect, then confirm succeeded receipt or pop refusal with README untouched.

Automated coverage: `git-actions-follow-receipt.test.tsx`.

## Gotchas

- Without the live outage the outcome arrives over the live connection at once and the receipt path is never taken.
- Section 2 leaves a stash and a modified README.md behind; `git -C "$REPO" stash drop` and `git -C "$REPO" checkout README.md` reset it, or start a fresh instance.

### Lost response and manual recovery

- If the action response is lost, open the progress box and choose Check outcome. It reads the retained request's receipt using GET; it never submits the write again. A running receipt remains followed until terminal completion and keeps another submission blocked; an unavailable receipt keeps the original operation blocked and explains terminal inspection.
- Fetch/Pull/Push interruption says outcome not confirmed; a conflicted receipt asks for conflict resolution. Only a known rejection says did not run.
- In Use groups, lose the first response while holding live traffic, independently read the first commit, then Check outcome. Commit 1 becomes committed. Restore live traffic and continue: only the remaining group submits, using the recovered HEAD. Independent log, parent and file readbacks must match the two groups exactly once.
- Automated recovery coverage also lives in `git-actions-recover-groups.test.tsx` and `git-actions-push.test.tsx`.
