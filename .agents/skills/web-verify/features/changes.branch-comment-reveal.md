---
route: /
selectors:
  - 'Review'
  - 'Branch'
  - 'Compare against '
  - 'the default branch'
  - 'Find a base branch'
  - 'Document controls'
  - 'Comment'
  - 'Comments'
  - 'Whole file'
tests:
  - apps/web/spec/integration/changes-branch-comment-reveal.test.tsx
api:
  - GET /api/worktrees/:worktreeId/branch-bases
  - GET /api/worktrees/:worktreeId/branch-changes
  - GET /api/worktrees/:worktreeId/comments
  - POST /api/worktrees/:worktreeId/comments
  - POST /api/worktrees/:worktreeId/comments/:threadId/replies
  - PUT /api/worktrees/:worktreeId/comments/:threadId/resolution
---

# changes.branch-comment-reveal

A comment written in the branch review remembers the base it was compared against; showing it from the Comments list opens its file in the branch review against that base again (`base=` and `entry=branch:<path>` in the address), even after the reviewer switched back to the default base.

## How to get to it (user POV)

- Workspace → button "Review" → tab "Changes" → tab "Branch" → tab "Comments" (named `Comments` plus the open-comment count) → the thread's location button (file name, "Whole file" or the line label, "in <short sha>"; title "Show in the code").
- Writing the comment: open a branch file (button "<file> · <status>" in the Branch list), then the Document controls toolbar’s "Comment" button, or right-click the file row → menuitem "Comment".

## Driving it with browser

Preconditions: [surface baseline](README.md).

### Setup

```sh
git -C "$REPO" branch checkpoint
git -C "$REPO" switch -c feature
printf 'first line\n' > "$REPO/notes.md"
git -C "$REPO" add --all && git -C "$REPO" commit -m "Add notes"
```

1. Navigate to `/`
   Expect: title "Files — repository".
2. Click button `Review`, then click tab `Changes`
   Expect: tabs "Uncommitted" and "Branch".
3. Click tab `Branch`
   Expect: text "1 commit on feature since main"; button "Compare against main".
4. Click button `Compare against main`
   Expect: listbox "Suggestions" with option "checkpoint".
5. Click option named `checkpoint`
   Expect: text "1 commit on feature since checkpoint"; the URL contains `base=refs%2Fheads%2Fcheckpoint`.
6. Click button `notes.md · added`
   Expect: the sheet closes; title "notes.md — repository"; the document toolbar reads "notes.md" over "notes.md · on the branch"; text "first line"; the URL contains `entry=branch%3Anotes.md`.
7. Click `Comment` in the Document controls toolbar
   Expect: textbox "Comment" and a button "Comment" (disabled while empty).
8. Fill textbox `Comment` with 'Against the checkpoint'
   Expect: button "Comment" enabled.
9. Click button `Comment`
   Expect: a thread with "Against the checkpoint" and the state "Waiting for the agent". `$C server comment-threads` shows its anchor `{ "kind": "file", "filePath": "notes.md", "comparison": { "kind": "branch", "base": "refs/heads/checkpoint" }, "revision": <branch tip>, … }`.
10. Click button `Review`
    Expect: button "Compare against checkpoint".
11. Click button `Compare against checkpoint`
    Expect: listbox "Suggestions".
12. Click option named `/^main/`
    Expect: text "1 commit on feature since main"; the URL no longer contains `base=`.
13. Click tab `/^Comments/`
    Expect: a thread whose location button starts "notes.md Whole file" and ends "in <7-character sha>"; text "Against the checkpoint".
14. Click button `/^notes\.md Whole file/`
    Expect: the sheet closes; the toolbar reads "notes.md · on the branch"; the thread "Against the checkpoint" shows in the diff; the URL contains `base=refs%2Fheads%2Fcheckpoint` and `entry=branch%3Anotes.md` again.

### Observable proof

Reload the current URL: Against the checkpoint persists. `$C server comment-threads` contains branch comparison base `refs/heads/checkpoint`; reveal restores that base. Comment POST/GET answer 200.

Automated coverage: `changes-branch-comment-reveal.test.tsx`.

## Gotchas

- Reopening the Review sheet resets its Changed files/Comments choice.
- `git add --all` also commits README on feature. Match `/^notes\.md Whole file/`; quote the regex to preserve its backslash.
- Setup leaves feature and a comment; reset before another map.
