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

A commit's full id or its whole message (subject plus body) is copied from its History row's context menu and from its commit document's toolbar, and a toast confirms what was copied.

## How to get to it (user POV)

- Review → History → right-click (long-press on touch) a commit row → menuitem "Copy commit id" or "Copy message".
- The commit document (click the row) → toolbar buttons "Copy id" and "Copy message".
- The same row context menu exists on rows of the Commit graph document.

## Driving it with browser

Preconditions: [surface baseline](README.md).

### Setup

```sh
git -C "$REPO" commit -am "Explain the change to review"
git -C "$REPO" rev-parse HEAD
```

Keep the 40-character id the second line prints; it is what the toasts must show.

1. Click button `Review`
   Expect: dialog "Worktree review".
2. Click tab `History`
   Expect: a row, button starting "Explain the change to review", above the "Initial commit" row.
3. Right-click button `/^Explain the change to review/`
   Expect: a menu with menuitems "Copy commit id" and "Copy message".
4. Click menuitem `Copy commit id`
   Expect: in region "Notifications", a toast titled "Copied commit id" whose description is the full id from the setup.
5. Right-click button `/^Explain the change to review/`
   Expect: the menu again.
6. Click menuitem `Copy message`
   Expect: a toast titled "Copied commit message" with the description "Explain the change to review".
7. Click button `/^Explain the change to review/`
   Expect: the sheet closes; heading "Explain the change to review"; title "<7-character id> — repository"; toolbar buttons "Copy id" and "Copy message".
8. Click button `Copy message`
   Expect: a new toast "Copied commit message" with "Explain the change to review".
9. Click button `Copy id`
   Expect: a new toast "Copied commit id" with the full id.

### Observable proof

Compare clipboard text with Git, alongside Copied… toast. Failure shows Could not copy commit id/message; a toast alone does not establish exact contents.

Automated coverage: `history-copy-commit.test.tsx`.

## Gotchas

- Read clipboard and compare with Git; toast alone does not prove its contents. Inspect Notifications immediately: toasts expire after five seconds and repeated titles may coexist.
- Full OID also appears in commit detail; scope its copy control rather than matching OID text alone.
