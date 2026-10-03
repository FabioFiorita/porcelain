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

Start with `.agents/skills/web-verify/scripts/cli start`; `REPO` is the repository path it printed. `live drop` cuts the page's live connection and keeps new ones closed until `live restore`, which waits until the page has reconnected (up to 15 s; the web backs off up to 10 s between attempts).

### 1. A commit settled while the live connection is down shows its outcome once it is back

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Commit"`
   Look for: dialog "Commit changes" with textbox "Message".
2. `.agents/skills/web-verify/scripts/cli fill --role textbox --name "Message" "Followed commit"`
   Look for: button "Commit selected files" is enabled.
3. `.agents/skills/web-verify/scripts/cli live drop`
   Look for: "dropped the live connection; new live connections close until live restore".
4. `.agents/skills/web-verify/scripts/cli click --role button --name "Commit selected files"`, then after a few seconds `.agents/skills/web-verify/scripts/cli snapshot`
   Look for: button "Committing…" [disabled] and an empty status, though `git -C "$REPO" log -1 --format=%s` already prints `Followed commit`.
5. `.agents/skills/web-verify/scripts/cli live restore`, then `.agents/skills/web-verify/scripts/cli wait --text "succeeded"`
   Look for: "the live connection is back after <n> ms"; the dialog's status reads "succeeded". `.agents/skills/web-verify/scripts/cli network` lists `GET /api/worktrees/<id>/git/receipts/<requestId>` 200 after the restore; `.agents/skills/web-verify/scripts/cli server receipt <requestId>` prints `"action": "commit"` and `"state": "succeeded"`.
6. `.agents/skills/web-verify/scripts/cli press Escape`
   Look for: the dialog is gone.

### 2. A stash pop Git refused while the live connection is down shows what Git said once it is back

Setup, after section 1 (or after `git -C "$REPO" commit -am "Followed commit"` on a fresh instance): `printf 'Set aside\n' > "$REPO/README.md"`, then `.agents/skills/web-verify/scripts/cli wait --role button --name "Mark README.md as reviewed"`.

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Git actions"`, `.agents/skills/web-verify/scripts/cli click --role menuitem --name "/^Stash changes/"`, then `.agents/skills/web-verify/scripts/cli click --role button --name "Stash changes"`
   Look for: `.agents/skills/web-verify/scripts/cli wait --text "succeeded"` returns; then `.agents/skills/web-verify/scripts/cli press Escape`.
2. On disk: `printf 'Changed while the stash was set aside\n' > "$REPO/README.md"`, then `.agents/skills/web-verify/scripts/cli wait --role button --name "Mark README.md as reviewed"`.
3. `.agents/skills/web-verify/scripts/cli click --role button --name "Git actions"`, then `.agents/skills/web-verify/scripts/cli click --role menuitem --name "/^Pop stash/"`
   Look for: dialog "Pop stash" with combobox "Stash" on option "On main: Porcelain review · <id>", checkbox "Restore staged changes" and button "Pop stash".
4. `.agents/skills/web-verify/scripts/cli live drop`, `.agents/skills/web-verify/scripts/cli click --role button --name "Pop stash"`, then after a few seconds `.agents/skills/web-verify/scripts/cli snapshot`
   Look for: status "running" and button "Working…" [disabled]; `cat "$REPO/README.md"` still prints `Changed while the stash was set aside`.
5. `.agents/skills/web-verify/scripts/cli live restore`, then `.agents/skills/web-verify/scripts/cli wait --text "/would be overwritten/"`
   Look for: alert "error: Your local changes to the following files would be overwritten by merge: README.md …"; button "Pop stash" back; README.md unchanged; a receipt `GET …/git/receipts/<requestId>` 200 in `.agents/skills/web-verify/scripts/cli network`.

## What proves it works

- With the live connection down, "Committing…" and "Working…" stay disabled although Git already finished; after `live restore` the receipt read brings "succeeded" for the commit (and the server's receipt says so) and the alert "…would be overwritten…" for the pop, with README.md untouched.
- `apps/web/spec/integration/git-actions-follow-receipt.test.tsx`: with the live connection dropped, the commit lands on the server while the dialog keeps button "Committing…" disabled, and "succeeded" appears only after the connection is restored; the refused pop keeps button "Working…" disabled until reconnect, then shows the alert "would be overwritten" and the file keeps its local text.

## Gotchas

- Without `live drop` the outcome arrives over the live connection at once and the receipt path is never taken.
- Section 2 leaves a stash and a modified README.md behind; `git -C "$REPO" stash drop` and `git -C "$REPO" checkout README.md` reset it, or start a fresh instance.
