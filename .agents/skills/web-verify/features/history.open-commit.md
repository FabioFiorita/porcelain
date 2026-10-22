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

Opening a commit from History shows its document: the message, author, full id and parent, how many files it changed, the diff of each text file, and a binary change listed under "Changes without code preview" with the reason "Binary change" instead of a code preview.

## How to get to it (user POV)

- Review → History → click a commit row (at phone width the sheet closes and the commit opens as a document tab named by its 7-character id).
- A row of the Commit graph document (see history.graph).
- URL `entry=commit:<full id>` on the workspace route.

## Driving it with browser

Preconditions: [surface baseline](README.md).

### 1. A commit shows its message, its file and the diff of the line it added

Setup:

```sh
git -C "$REPO" commit -am "Explain the change to review"
```

1. Click button `Review`
   Expect: dialog "Worktree review".
2. Click tab `History`
   Expect: a row starting "Explain the change to review" above the "Initial commit" row.
3. Click button `/^Explain the change to review/`
   Expect: the sheet closes; heading "Explain the change to review"; text "1 file changed" in the toolbar; "Porcelain Development", the full 40-character id and "against <7-character id>" under the heading; README.md's diff with the added line "A change to review."; title "<7-character id> — repository"; buttons "Copy id" and "Copy message".

### 2. A binary file is listed without a code preview and says it is a binary change

Setup (continuing from section 1, or on a fresh instance where README.md joins the commit and the toolbar reads "2 files changed"):

```sh
printf 'PNG\000\001\002binary' > "$REPO/logo.bin"
git -C "$REPO" add --all
git -C "$REPO" commit -m "Add a binary logo"
git -C "$REPO" show --stat --format=%s HEAD
```

The last line shows `logo.bin | Bin 0 -> 12 bytes`.

1. Click button `Review`
   Expect: dialog "Worktree review"; tab "History" is still the selected surface.
2. Click tab `History`
   Expect: a row starting "Add a binary logo" at the top.
3. Click button `/^Add a binary logo/`
   Expect: heading "Add a binary logo"; list "Changes without code preview" with an item reading "logo.bin" and "added · Binary change" (it reads "added · Reading the patch" for a moment first); no code view for logo.bin.

### Observable proof

Compare subject/count/binary path with `git -C "$REPO" show --stat HEAD`; files GET/diffs POST answer 200.

Automated coverage: `history-open-commit.test.tsx`.

## Gotchas

- Row names include all metadata; use anchored regex. Reopen the phone Review sheet to select another commit.
- Both fixture commits remain; reset before maps expecting one commit/unstaged README.
