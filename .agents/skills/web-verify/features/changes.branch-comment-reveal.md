---
route: /
selectors:
  - "Review"
  - "Branch"
  - "Compare against "
  - "the default branch"
  - "Find a base branch"
  - "Comment on "
  - "Comment"
  - "Comments"
  - "Whole file"
tests:
  - apps/web/spec/e2e/changes-branch-comment-reveal.e2e.ts
api:
  - GET /api/worktrees/:worktreeId/branch-bases
  - GET /api/worktrees/:worktreeId/branch-changes
  - GET /api/worktrees/:worktreeId/comments
  - POST /api/worktrees/:worktreeId/comments
  - POST /api/worktrees/:worktreeId/comments/:threadId/replies
  - PUT /api/worktrees/:worktreeId/comments/:threadId/resolution
---

# changes.branch-comment-reveal

## What it is

A comment written in the branch review remembers the base it was compared against; showing it from the Comments list opens its file in the branch review against that base again (`base=` and `entry=branch:<path>` in the address), even after the reviewer switched back to the default base.

## How a user reaches it

- Workspace → button "Review" → tab "Branch" → tab "Comments" (named `Comments` plus the open-comment count) → the thread's location button (file name, "Whole file" or the line label, "in <short sha>"; title "Show in the code").
- Writing the comment: open a branch file (button "<file> · <status>" in the Branch list), then button "Comment on <file> (<status>)" in the file's diff header, or right-click the file row → menuitem "Comment".

## Driving it

`$C start`; pair your browser using the card’s pairing-link command, then `REPO=<connection.json fixtures.repositoryPath>`.

### Setup

```sh
git -C "$REPO" branch checkpoint
git -C "$REPO" switch -c feature
printf 'first line\n' > "$REPO/notes.md"
git -C "$REPO" add --all && git -C "$REPO" commit -m "Add notes"
```

1. Navigate to `/` on the card’s web URL (full page load)
   Look for: Page Title "Changes — repository".
2. Click button named `Review`
   Look for: tabs "Uncommitted" and "Branch".
3. Click tab named `Branch`
   Look for: text "1 commit on feature since main"; button "Compare against the default branch".
4. Click button named `Compare against the default branch`
   Look for: listbox "Suggestions" with option "checkpoint".
5. Click option named `checkpoint`
   Look for: text "1 commit on feature since checkpoint"; the Page URL contains `base=refs%2Fheads%2Fcheckpoint`.
6. Click button named `notes.md · added`
   Look for: the sheet closes; Page Title "notes.md — repository"; the document toolbar reads "notes.md" over "notes.md · on the branch"; text "first line"; the Page URL contains `entry=branch%3Anotes.md`.
7. Click button named `Comment on notes.md (added)`
   Look for: textbox "Comment" and a button "Comment" (disabled while empty).
8. Replace the contents of textbox named `Comment` with 'Against the checkpoint'
   Look for: button "Comment" enabled.
9. Click button named `Comment`
   Look for: a thread with "Against the checkpoint" and the state "Waiting for the agent". `$C server comment-threads` shows its anchor `{ "kind": "file", "filePath": "notes.md", "comparison": { "kind": "branch", "base": "refs/heads/checkpoint" }, "revision": <branch tip>, … }`.
10. Click button named `Review`
    Look for: button "Compare against checkpoint".
11. Click button named `Compare against checkpoint`
    Look for: listbox "Suggestions".
12. Click option named `/^main/`
    Look for: text "1 commit on feature since main"; the Page URL no longer contains `base=`.
13. Click tab named `/^Comments/`
    Look for: a thread whose location button starts "notes.md Whole file" and ends "in <7-character sha>"; text "Against the checkpoint".
14. Click button named `/^notes\.md Whole file/`
    Look for: the sheet closes; the toolbar reads "notes.md · on the branch"; the thread "Against the checkpoint" shows in the diff; the Page URL contains `base=refs%2Fheads%2Fcheckpoint` and `entry=branch%3Anotes.md` again.

## What proves it works

- Step 14's Page URL: the base comes back as `refs/heads/checkpoint` although step 12 had cleared it. Reopening Review then shows button "Compare against checkpoint".
- The comment persisted on the server: Navigate to `<the` on the card’s web URL (full page load) still shows the thread "Against the checkpoint". Inspect HTTP requests and responses shows `POST /api/worktrees/<worktreeId>/comments` with 200 and later `GET /api/worktrees/<worktreeId>/comments` with 200.
- The anchor's stored comparison: `$C server comment-threads` after step 9 shows `"comparison": { "kind": "branch", "base": "refs/heads/checkpoint" }`, which the reveal in step 14 brings back.
- `apps/web/spec/e2e/changes-branch-comment-reveal.e2e.ts`: asserts the saved thread's anchor comparison is the checkpoint base, that switching to main clears `base`, and that the reveal sets `base=refs/heads/checkpoint` and `entry=branch:notes.md`.

## Gotchas

- Opening a document (steps 6 and 14) closes the Review sheet at phone width, so step 10 reopens it. The sheet forgets its "Changed files"/"Comments" choice when it closes.
- Every commit uses `git add --all`, so the start state's README.md change is committed on `feature` too and the Branch list also shows "README.md · modified".
- The location button's name runs together file, label and sha, so address it by the pattern `/^notes\.md Whole file/` in single quotes; double quotes would need the backslash doubled.
- The setup leaves the repository on `feature` with a comment thread stored; `$C stop` and `$C start`; pair your browser using the card’s pairing-link command before driving another feature.
