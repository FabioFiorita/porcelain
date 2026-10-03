---
route: /
selectors:
  - "Review"
  - "History"
  - "Changes without code preview"
  - "Binary change"
  - "Copy id"
tests:
  - apps/web/spec/integration/history-open-commit.test.tsx
api:
  - GET /api/worktrees/:worktreeId/commits
  - GET /api/worktrees/:worktreeId/commits/:oid/files
  - POST /api/worktrees/:worktreeId/commits/:oid/diffs
---

# history.open-commit

## What it is

Opening a commit from History shows its document: the message, author, full id and parent, how many files it changed, the diff of each text file, and a binary change listed under "Changes without code preview" with the reason "Binary change" instead of a code preview.

## How a user reaches it

- Review → History → click a commit row (at phone width the sheet closes and the commit opens as a document tab named by its 7-character id).
- A row of the Commit graph document (see history.graph).
- URL `entry=commit:<full id>` on the workspace route.

## Driving it

Start with `$C start`. `REPO` is the repository path `start` printed.

### 1. A commit shows its message, its file and the diff of the line it added

Setup:

```sh
git -C "$REPO" commit -am "Explain the change to review"
```

1. `$C click --role button --name "Review"`
   Look for: dialog "Worktree review".
2. `$C click --role tab --name "History"`
   Look for: a row starting "Explain the change to review" above the "Initial commit" row.
3. `$C click --role button --name "/^Explain the change to review/"`
   Look for: the sheet closes; heading "Explain the change to review"; text "1 file changed" in the toolbar; "Porcelain Development", the full 40-character id and "against <7-character id>" under the heading; README.md's diff with the added line "A change to review."; Page Title "<7-character id> — repository"; buttons "Copy id" and "Copy message".

### 2. A binary file is listed without a code preview and says it is a binary change

Setup (continuing from section 1, or on a fresh instance where README.md joins the commit and the toolbar reads "2 files changed"):

```sh
printf 'PNG\000\001\002binary' > "$REPO/logo.bin"
git -C "$REPO" add --all
git -C "$REPO" commit -m "Add a binary logo"
git -C "$REPO" show --stat --format=%s HEAD
```

The last line shows `logo.bin | Bin 0 -> 12 bytes`.

1. `$C click --role button --name "Review"`
   Look for: dialog "Worktree review"; tab "History" is still the selected surface.
2. `$C click --role tab --name "History"`
   Look for: a row starting "Add a binary logo" at the top.
3. `$C click --role button --name "/^Add a binary logo/"`
   Look for: heading "Add a binary logo"; list "Changes without code preview" with an item reading "logo.bin" and "added · Binary change" (it reads "added · Reading the patch" for a moment first); no code view for logo.bin.

## What proves it works

- The commit document's content matches `git -C "$REPO" show --stat HEAD`: subject, file count, and the binary file named but not previewed.
- `network` shows `GET /api/worktrees/<id>/commits/<oid>/files` and `POST /api/worktrees/<id>/commits/<oid>/diffs` answered 200 for the opened commit.
- `apps/web/spec/integration/history-open-commit.test.tsx`: the opened commit shows heading "Explain the change to review", "1 file changed" and the added line "A change to review."; the binary commit shows heading "Add a binary logo" and, in list "Changes without code preview", "logo.bin" with "added · Binary change".

## Gotchas

- Opening a commit closes the sheet; to open another commit, click "Review" again (the History surface stays selected).
- Row names are the whole row text; address rows with a regex anchored at the start.
- Both commits stay in the repository for the rest of the instance; start a fresh instance for features that expect the sample's single commit and its unstaged README change.
