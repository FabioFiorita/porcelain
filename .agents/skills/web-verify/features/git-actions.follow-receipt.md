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

Start with `.agents/skills/web-verify/scripts/cli start`. The CLI cannot cut the live connection, so it drives only the connected path below; the race itself is left to the test (see Gotchas).

### Setup

None for section 1. Section 2, with `REPO` the repository path `start` printed (skip the commit when section 1 already made it):

```sh
git -C "$REPO" commit -am "Followed commit"
printf 'Set aside\n' > "$REPO/README.md"
```

Look for: the review lists README.md again (button "Mark README.md as reviewed").

### 1. A commit shows its outcome

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Commit"`
   Look for: dialog "Commit changes" with textbox "Message".
2. `.agents/skills/web-verify/scripts/cli fill --role textbox --name "Message" "Followed commit"`
   Look for: button "Commit selected files" is enabled.
3. `.agents/skills/web-verify/scripts/cli click --role button --name "Commit selected files"`
   Look for: a `status` in the dialog reading "succeeded" (button "Committing…" shows only briefly).
4. `.agents/skills/web-verify/scripts/cli press Escape`
   Look for: the dialog is gone; `git -C "$REPO" log -1 --format=%s` prints `Followed commit`.

### 2. A refused stash pop shows what Git said

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Git actions"`
   Look for: menuitems starting "Stash changes" and "Pop stash".
2. `.agents/skills/web-verify/scripts/cli click --role menuitem --name "/^Stash changes/"`
   Look for: dialog "Stash changes" with button "Stash changes".
3. `.agents/skills/web-verify/scripts/cli click --role button --name "Stash changes"`
   Look for: `status` "succeeded" in the dialog.
4. `.agents/skills/web-verify/scripts/cli press Escape`
   Look for: dialog "Stash changes" is gone. Then on disk: `printf 'Changed while the stash was set aside\n' > "$REPO/README.md"`, and the review lists README.md again (button "Mark README.md as reviewed").
5. `.agents/skills/web-verify/scripts/cli click --role button --name "Git actions"`
   Look for: the menu is open.
6. `.agents/skills/web-verify/scripts/cli click --role menuitem --name "/^Pop stash/"`
   Look for: dialog "Pop stash" with combobox "Stash" and button "Pop stash".
7. `.agents/skills/web-verify/scripts/cli click --role button --name "Pop stash"`
   Look for: an `alert` in the dialog containing "would be overwritten"; `cat "$REPO/README.md"` still prints `Changed while the stash was set aside`.

## What proves it works

- Connected path: the dialog's `status` "succeeded" with the commit on disk, and the pop's `alert` "…would be overwritten…" with README.md untouched.
- `apps/web/spec/integration/git-actions-follow-receipt.test.tsx`: with the live connection dropped, the commit lands on the server while the dialog keeps button "Committing…" disabled, and "succeeded" appears only after the connection is restored; the refused pop keeps button "Working…" disabled until reconnect, then shows the alert "would be overwritten" and the file keeps its local text.

## Gotchas

- Unreachable through the CLI: the promise is about a dropped live connection. The commands that would be needed: `cli live drop` before the submit click and `cli live restore` after it, then look for "Committing…" (or "Working…") staying disabled until the restore and the outcome appearing after it.
- Section 2 leaves a stash and a modified README.md behind; `git -C "$REPO" stash drop` and `git -C "$REPO" checkout README.md` reset it, or start a fresh instance.
