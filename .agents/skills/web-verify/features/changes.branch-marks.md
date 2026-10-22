---
route: /
selectors:
  - "Review"
  - "Branch"
  - "Mark reviewed"
  - "Mark "
  - " as reviewed"
  - "Unmark "
  - " as unreviewed"
  - "Mark as reviewed"
tests:
  - apps/web/spec/integration/changes-branch-marks.test.tsx
api:
  - GET /api/worktrees/:worktreeId/branch-bases
  - GET /api/worktrees/:worktreeId/branch-changes
  - GET /api/worktrees/:worktreeId/reviewed
  - PUT /api/worktrees/:worktreeId/reviewed
  - PUT /api/worktrees/:worktreeId/reviewed-bulk
---

# changes.branch-marks

A file marked reviewed in the branch review is reviewed only for the checked-out branch: switching the worktree to another branch shows the file unreviewed there, and switching back shows the mark again, live and without a reload.

## How to get to it (user POV)

- Workspace → button "Review" → tab "Changes" → tab "Branch" → button "<file> · <status>" → in the document toolbar the button "Mark <file> as reviewed" (visible text "Mark reviewed"); the same control, icon-only, sits in the file's diff header.
- Right-click the file row in the Branch list → menuitem "Mark as reviewed" (it reads "Unmark as reviewed" once marked).
- The Branch document ("All branch changes") toolbar has a bulk "Mark all … reviewed" button.

## Driving it with browser

Preconditions: [surface baseline](README.md).

### Setup

```sh
git -C "$REPO" switch -c feature
printf 'first line\n' > "$REPO/notes.md"
git -C "$REPO" add --all && git -C "$REPO" commit -m "Add notes"
```

1. Navigate to `/`
   Expect: title "Files — repository".
2. Click button `Review`, then click tab `Changes`
   Expect: tabs "Uncommitted" and "Branch".
3. Click tab `Branch`
   Expect: text "1 commit on feature since main"; buttons "README.md · modified" and "notes.md · added".
4. Click button `notes.md · added`
   Expect: the sheet closes; title "notes.md — repository"; toolbar "notes.md" over "notes.md · on the branch"; text "first line"; button "Mark notes.md as reviewed" with text "Mark reviewed".
5. Click text 'Mark reviewed'
   Expect: the toolbar button now reads "Reviewed"; the snapshot shows `button "Unmark notes.md as unreviewed" [pressed]` (twice: toolbar and diff header) and no "Mark notes.md as reviewed". `$C server reviewed-files refs/heads/feature` lists notes.md in `marks`; `$C server reviewed-files` (the uncommitted review) lists none.
6. On disk, while the page stays open: `git -C "$REPO" switch -c copy`
   Then Wait for button named `Mark notes.md as reviewed` (match 1, in document order). Expect: the toolbar button reads "Mark reviewed" again and the snapshot shows `button "Mark notes.md as reviewed"`, no "Unmark notes.md as unreviewed"; `$C server reviewed-files refs/heads/copy` lists no mark.
7. On disk: `git -C "$REPO" switch feature`
   Then Wait for button named `Unmark notes.md as unreviewed` (match 1, in document order). Expect: the toolbar button reads "Reviewed" and the snapshot shows `button "Unmark notes.md as unreviewed" [pressed]` again.

### Observable proof

Reload the current URL: Reviewed persists. `$C server reviewed-files <branch ref>` distinguishes feature/copy; mark PUT and branch-scoped GETs answer 200.

Automated coverage: `changes-branch-marks.test.tsx`.

## Gotchas

- Toolbar and diff header share Mark notes.md as reviewed. Scope the toolbar/first match, use visible Mark reviewed, or Branch row context menu → Mark as reviewed.
- Wait for live branch selection. README’s initial change is also committed by add --all. Setup leaves feature/copy; reset before another map.
