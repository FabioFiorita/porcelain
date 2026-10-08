---
route: /
selectors:
  - "Review"
  - "Branch"
  - "Uncommitted"
  - " · on the branch"
  - "Mark reviewed"
  - "Unmark "
  - " as unreviewed"
  - "Comment on "
  - "Comment"
  - "Waiting for the agent"
tests:
  - apps/web/spec/e2e/changes-review-branch.e2e.ts
api:
  - DELETE /api/worktrees/:worktreeId/reviewed
  - DELETE /api/worktrees/:worktreeId/reviewed-bulk
  - GET /api/worktrees/:worktreeId/branch-bases
  - GET /api/worktrees/:worktreeId/branch-changes
  - GET /api/worktrees/:worktreeId/comments
  - GET /api/worktrees/:worktreeId/reviewed
  - POST /api/worktrees/:worktreeId/branch-changes/diffs
  - POST /api/worktrees/:worktreeId/comments
  - POST /api/worktrees/:worktreeId/comments/:threadId/replies
  - PUT /api/worktrees/:worktreeId/comments/:threadId/resolution
  - PUT /api/worktrees/:worktreeId/reviewed
  - PUT /api/worktrees/:worktreeId/reviewed-bulk
---

# changes.review-branch

## What it is

The branch review lists every file committed on the checked-out branch since it forked from the default branch, opens one file's diff, marks it reviewed for the branch without touching the uncommitted review, and saves a comment on it anchored to the branch comparison.

## How a user reaches it

- Workspace → button "Review" → tab "Branch" (next to "Uncommitted"; the address gains `scope=branch`) → button "<file> · <status>" opens that file's branch diff (`entry=branch:<path>`); button "All branch changes" opens every file.
- In the file's document: toolbar button "Mark <file> as reviewed" (text "Mark reviewed"), and button "Comment on <file> (<status>)" in the diff header.
- Right-click a file row → menu "Mark as reviewed", "Comment", "Open diff", "Open file", "Show timeline", "Copy relative path".

## Driving it

`$C start`; pair your browser using the card’s pairing-link command, then `REPO=<connection.json fixtures.repositoryPath>`.

### Setup

```sh
git -C "$REPO" switch -c feature
printf 'first line\nsecond line\n' > "$REPO/notes.md"
git -C "$REPO" add --all && git -C "$REPO" commit -m "Add notes"
git -C "$REPO" diff --name-only main feature   # prints README.md and notes.md
```

### 1. The branch lists its committed files and opens one

1. Navigate to `/` on the card’s web URL (full page load)
   Look for: Page Title "Changes — repository".
2. Click button named `Review`
   Look for: tabs "Uncommitted" [selected] and "Branch".
3. Click tab named `Branch`
   Look for: text "1 commit on feature since main"; buttons "README.md · modified" and "notes.md · added"; the Page URL contains `scope=branch`.
4. Click button named `notes.md · added`
   Look for: the sheet closes; Page Title "notes.md — repository"; toolbar "notes.md" over "notes.md · on the branch"; text "second line"; the Page URL contains `entry=branch%3Anotes.md`.

### 2. Marking it reviewed keeps the mark in the branch review

5. Click text 'Mark reviewed'
   Look for: the toolbar button reads "Reviewed"; the snapshot shows `button "Unmark notes.md as unreviewed" [pressed]`, enabled. `$C server reviewed-files refs/heads/feature` lists notes.md; `$C server reviewed-files` (the uncommitted review) lists none.

### 3. A comment on it is saved against the branch

6. Click button named `Comment on notes.md (added)`
   Look for: textbox "Comment"; button "Comment" disabled.
7. Replace the contents of textbox named `Comment` with 'Why a second line?'
   Look for: button "Comment" enabled.
8. Click button named `Comment`
   Look for: a thread with "Why a second line?" and the state "Waiting for the agent". `$C server comment-threads` shows its anchor `{ "kind": "file", "filePath": "notes.md", "comparison": { "kind": "branch", "base": "refs/heads/main" }, "revision": <branch tip>, … }` and body "Why a second line?".

## What proves it works

- Reload with Navigate to `<the` on the card’s web URL (full page load): the document is still "notes.md · on the branch", the toolbar still reads "Reviewed", and the thread "Why a second line?" with "Waiting for the agent" is still there.
- Inspect HTTP requests and responses shows `GET /api/worktrees/<worktreeId>/branch-changes` and `POST …/branch-changes/diffs` (200) for part 1, `PUT /api/worktrees/<worktreeId>/reviewed` (200) for part 2 and `GET …/reviewed?scope=branch&…` reads, and `POST /api/worktrees/<worktreeId>/comments` (200) for part 3.
- The uncommitted review stayed empty and the comment is anchored to the branch: `$C server reviewed-files` lists no mark while `$C server reviewed-files refs/heads/feature` lists notes.md, and `$C server comment-threads` shows the branch comparison against `refs/heads/main` at the branch tip. In the UI, after part 3, Review → tab "Uncommitted" shows "No changed files" and "No changes", and its readiness counts the thread ("1 comment waiting on the agent", tab "Comments 1") because the comment list is the worktree's.
- `apps/web/spec/e2e/changes-review-branch.e2e.ts`: asserts the server's branch files are README.md and notes.md, the count line, `scope=branch` and `entry=branch:notes.md`; that the branch marks hold `notes.md` while the worktree marks stay `[]`; and the saved thread's anchor and body.

## Gotchas

- The file document renders the mark control twice (toolbar and diff header) under the same name "Mark notes.md as reviewed", so the role address is ambiguous; click the toolbar's visible text text "Mark reviewed", or right-click the row in the Branch list and use menuitem "Mark as reviewed".
- Opening a file closes the Review sheet at phone width; reopen it with "Review" to see the Branch list again.
- `git add --all` commits README.md's start-state change on `feature`, which is why "README.md · modified" is listed and the working tree is clean.
- The setup leaves the repository on `feature` with a mark and a comment stored; `$C stop` and `$C start`; pair your browser using the card’s pairing-link command before driving another feature.
