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
  - apps/web/spec/integration/changes-review-branch.test.tsx
  - apps/web/spec/integration/changes-branch-marks.test.tsx
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

The branch review lists every file committed on the checked-out branch since it forked from the default branch, opens one file's diff, marks it reviewed for the branch without touching the uncommitted review, and saves a comment on it anchored to the branch comparison.

## How to get to it (user POV)

- Workspace → button "Review" → tab "Changes" → tab "Branch" (next to "Uncommitted"; the address gains `scope=branch`) → button "<file> · <status>" opens that file's branch diff (`entry=branch:<path>`); button "All branch changes" opens every file.
- In the file's document: toolbar button "Mark <file> as reviewed" (text "Mark reviewed"), and button "Comment on <file> (<status>)" in the diff header.
- Right-click a file row → menu "Mark as reviewed", "Comment", "Open diff", "Open file", "Show timeline", "Copy relative path".

## Driving it with browser

Preconditions: [surface baseline](README.md).

### Setup

```sh
git -C "$REPO" switch -c feature
printf 'first line\nsecond line\n' > "$REPO/notes.md"
git -C "$REPO" add --all && git -C "$REPO" commit -m "Add notes"
git -C "$REPO" diff --name-only main feature   # prints README.md and notes.md
```

### 1. The branch lists its committed files and opens one

1. Navigate to `/`
   Expect: title "Files — repository".
2. Click button `Review`, then click tab `Changes`
   Expect: tabs "Uncommitted" [selected] and "Branch".
3. Click tab `Branch`
   Expect: text "1 commit on feature since main"; buttons "README.md · modified" and "notes.md · added"; the URL contains `scope=branch`.
4. Click button `notes.md · added`
   Expect: the sheet closes; title "notes.md — repository"; toolbar "notes.md" over "notes.md · on the branch"; text "second line"; the URL contains `entry=branch%3Anotes.md`.

### 2. Marking it reviewed keeps the mark in the branch review

5. Click text 'Mark reviewed'
   Expect: the toolbar button reads "Reviewed"; the snapshot shows `button "Unmark notes.md as unreviewed" [pressed]`, enabled. `$C server reviewed-files refs/heads/feature` lists notes.md; `$C server reviewed-files` (the uncommitted review) lists none.

### 3. A comment on it is saved against the branch

6. Click button `Comment on notes.md (added)`
   Expect: textbox "Comment"; button "Comment" disabled.
7. Fill textbox `Comment` with 'Why a second line?'
   Expect: button "Comment" enabled.
8. Click button `Comment`
   Expect: a thread with "Why a second line?" and the state "Waiting for the agent". `$C server comment-threads` shows its anchor `{ "kind": "file", "filePath": "notes.md", "comparison": { "kind": "branch", "base": "refs/heads/main" }, "revision": <branch tip>, … }` and body "Why a second line?".

### Observable proof

Reload current URL: branch document, Reviewed and Why a second line? persist. Independently read branch marks/comments; uncommitted marks remain empty. Uncommitted has No changed files/No changes but counts the worktree comment (Comments 1).

Automated coverage: `changes-review-branch.test.tsx`, `changes-branch-marks.test.tsx`.

## Gotchas

- Scope duplicate Mark notes.md as reviewed controls to toolbar, or use Branch row menu. add --all includes initial README; clean Uncommitted is expected.
- Setup leaves feature, marks and comments; reset before another map.
