---
route: /
selectors:
  - "Review"
  - "History"
  - "Copy commit id"
  - "Copy message"
  - "Copy id"
tests:
  - apps/web/spec/integration/history-copy-commit.test.tsx
api:
  - GET /api/worktrees/:worktreeId/commits
  - GET /api/worktrees/:worktreeId/commits/:oid/files
---

# history.copy-commit

## What it is

A commit's full id or its whole message (subject plus body) is copied from its History row's context menu and from its commit document's toolbar, and a toast confirms what was copied.

## How a user reaches it

- Review → History → right-click (long-press on touch) a commit row → menuitem "Copy commit id" or "Copy message".
- The commit document (click the row) → toolbar buttons "Copy id" and "Copy message".
- The same row context menu exists on rows of the Commit graph document.

## Driving it

Start with `$C start`. `REPO` is the repository path `start` printed.

### Setup

```sh
git -C "$REPO" commit -am "Explain the change to review"
git -C "$REPO" rev-parse HEAD
```

Keep the 40-character id the second line prints; it is what the toasts must show.

1. `$C click --role button --name "Review"`
   Look for: dialog "Worktree review".
2. `$C click --role tab --name "History"`
   Look for: a row, button starting "Explain the change to review", above the "Initial commit" row.
3. `$C click --role button --name "/^Explain the change to review/" --button right`
   Look for: a menu with menuitems "Copy commit id" and "Copy message".
4. `$C click --role menuitem --name "Copy commit id"`
   Look for: in region "Notifications", a toast titled "Copied commit id" whose description is the full id from the setup.
5. `$C click --role button --name "/^Explain the change to review/" --button right`
   Look for: the menu again.
6. `$C click --role menuitem --name "Copy message"`
   Look for: a toast titled "Copied commit message" with the description "Explain the change to review".
7. `$C click --role button --name "/^Explain the change to review/"`
   Look for: the sheet closes; heading "Explain the change to review"; Page Title "<7-character id> — repository"; toolbar buttons "Copy id" and "Copy message".
8. `$C click --role button --name "Copy message"`
   Look for: a new toast "Copied commit message" with "Explain the change to review".
9. `$C click --role button --name "Copy id"`
   Look for: a new toast "Copied commit id" with the full id.

## What proves it works

- Each copy raises its "Copied …" toast with the copied text as the description; the toast is raised only after the clipboard write (or its fallback) succeeded, and a failure shows "Could not copy commit id" / "Could not copy commit message" instead.
- `apps/web/spec/integration/history-copy-commit.test.tsx`: the row's context menu copies the id ("Copied commit id" with the full id visible) and the message ("Copied commit message"); the commit document's Copy message and Copy id raise the same toasts.

## Gotchas

- The CLI cannot read the clipboard; the toast is the end state to check. The command that would be needed to check the content itself: `cli clipboard read`.
- Toasts close after Base UI's default 5 seconds and at most 3 show at once: read the toast from the click's output or run `snapshot` right after the click. Repeated toasts share a title, so check them through a snapshot of region "Notifications" rather than `--text`, which would match more than one.
- Once the commit document is open its header also shows the full id, so `--text "<id>"` is ambiguous there.
