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

## What it is

A file marked reviewed in the branch review is reviewed only for the checked-out branch: switching the worktree to another branch shows the file unreviewed there, and switching back shows the mark again, live and without a reload.

## How a user reaches it

- Workspace → button "Review" → tab "Branch" → button "<file> · <status>" → in the document toolbar the button "Mark <file> as reviewed" (visible text "Mark reviewed"); the same control, icon-only, sits in the file's diff header.
- Right-click the file row in the Branch list → menuitem "Mark as reviewed" (it reads "Unmark as reviewed" once marked).
- The Branch document ("All branch changes") toolbar has a bulk "Mark all … reviewed" button.

## Driving it

`C=.agents/skills/web-verify/scripts/cli; $C start`, then `REPO=<the repository path start printed>`.

### Setup

```sh
git -C "$REPO" switch -c feature
printf 'first line\n' > "$REPO/notes.md"
git -C "$REPO" add --all && git -C "$REPO" commit -m "Add notes"
```

1. `$C open /`
   Look for: Page Title "Changes — repository".
2. `$C click --role button --name "Review"`
   Look for: tabs "Uncommitted" and "Branch".
3. `$C click --role tab --name "Branch"`
   Look for: text "1 commit on feature since main"; buttons "README.md · modified" and "notes.md · added".
4. `$C click --role button --name "notes.md · added"`
   Look for: the sheet closes; Page Title "notes.md — repository"; toolbar "notes.md" over "notes.md · on the branch"; text "first line"; button "Mark notes.md as reviewed" with text "Mark reviewed".
5. `$C click --text "Mark reviewed"`
   Look for: the toolbar button now reads "Reviewed"; the snapshot shows `button "Unmark notes.md as unreviewed" [pressed]` (twice: toolbar and diff header) and no "Mark notes.md as reviewed".
6. On disk, while the page stays open: `git -C "$REPO" switch -c copy`
   Then `$C snapshot`. Look for: the toolbar button reads "Mark reviewed" again and the snapshot shows `button "Mark notes.md as reviewed"`, no "Unmark notes.md as unreviewed".
7. On disk: `git -C "$REPO" switch feature`
   Then `$C snapshot`. Look for: the toolbar button reads "Reviewed" and the snapshot shows `button "Unmark notes.md as unreviewed" [pressed]` again.

## What proves it works

- Steps 6 and 7: the same file flips between unreviewed on `copy` and reviewed on `feature` with no `open`, so the marks are kept per branch and pushed live.
- Persistence: after step 7, `$C open <the path and query of the printed Page URL>` still shows "Reviewed". `$C network` shows `PUT /api/worktrees/<worktreeId>/reviewed` with 200 at step 5 and `GET /api/worktrees/<worktreeId>/reviewed?scope=branch&…` reads after each switch.
- The stored marks per branch ref have no UI readout beyond this; reading them needs `cli server reviewed-files --branch refs/heads/feature` (CLI gap).
- `apps/web/spec/integration/changes-branch-marks.test.tsx`: asserts the server holds `notes.md` as reviewed for `refs/heads/feature`, that "Mark notes.md as reviewed" shows after switching to `copy`, and "Unmark notes.md as unreviewed" after switching back.

## Gotchas

- The single-file branch document renders the mark control twice (toolbar and diff header) under the same name, so `--role button --name "Mark notes.md as reviewed"` is ambiguous and fails. Click the toolbar's visible text with `--text "Mark reviewed"`, or open Review → Branch, right-click "notes.md · added" (`--button right`) and click menuitem "Mark as reviewed".
- The branch switch reaches the page through the server's file watcher and the live socket; if the snapshot still shows the old state, run `$C snapshot` again after a second.
- Every commit uses `git add --all`, so README.md's start-state change is committed on `feature` and listed as "README.md · modified".
- The setup leaves the repository on `feature` with branch `copy`; `$C stop` and `$C start` before driving another feature.
