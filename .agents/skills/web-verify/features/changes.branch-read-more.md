---
route: /
selectors:
  - "Review"
  - "Branch"
  - "All branch changes"
  - "Read "
  - " more of "
  - "Reading…"
  - "Some patches could not be read."
tests:
  - apps/web/spec/integration/changes-branch-read-more.test.tsx
api:
  - GET /api/worktrees/:worktreeId/branch-bases
  - GET /api/worktrees/:worktreeId/branch-changes
  - POST /api/worktrees/:worktreeId/branch-changes/diffs
---

# changes.branch-read-more

## What it is

The Branch document ("All branch changes") reads diffs for the first 25 files (`DIFF_WINDOW_FILES`, `apps/web/src/config/limits.ts`); "Read N more of M" reads the next window only, keeping the diffs already on screen while it loads.

## How a user reaches it

- Workspace → button "Review" → tab "Branch" → button "All branch changes" (its name ends with the file count) → at the bottom of the document, button "Read <n> more of <m>" (shows "Reading…", disabled, while a read runs).

## Driving it

`C=.agents/skills/web-verify/scripts/cli; $C start`, then `REPO=<the repository path start printed>`.

### Setup

26 new notes plus the committed README.md change make 27 branch files, two more than one window:

```sh
git -C "$REPO" switch -c feature
for i in $(seq 0 25); do printf 'note %s\n' "$i" > "$REPO/notes-$(printf %02d "$i").md"; done
git -C "$REPO" add --all && git -C "$REPO" commit -m "Add many notes"
git -C "$REPO" diff --name-only main feature | wc -l   # prints 27
```

1. `$C open /`
   Look for: Page Title "Changes — repository".
2. `$C click --role button --name "Review"`
   Look for: tabs "Uncommitted" and "Branch".
3. `$C click --role tab --name "Branch"`
   Look for: text "1 commit on feature since main"; a button whose name starts "All branch changes" and ends "27"; rows "README.md · modified", "notes-00.md · added" … "notes-25.md · added".
4. `$C click --role button --name "/^All branch changes/"`
   Look for: the sheet closes; Page Title "Branch changes — repository"; toolbar "Branch" over "27 files changed"; heading "feature since main"; text "A change to review." (README.md's diff, the first file); button "Read 2 more of 2" at the bottom; no text "Some patches could not be read.".
5. `$C click --role button --name "Read 2 more of 2"`
   Look for: button "Read 2 more of 2" is gone (it may flash "Reading…"); text "A change to review." still shows; no text "Some patches could not be read.". Then `$C network`: a second `POST /api/worktrees/<worktreeId>/branch-changes/diffs` with 200.

## What proves it works

- `$C network` after step 5 shows a second `POST /api/worktrees/<worktreeId>/branch-changes/diffs` with 200, sent at the click: the first carried the 25 files of the first window, the second only the 2 new ones (the CLI log has no bodies; the count of requests is the evidence).
- The README.md diff text stays visible through the read, so the window grew instead of replacing what was shown.
- `apps/web/spec/integration/changes-branch-read-more.test.tsx`: holds the second diffs request open and asserts "A change to review." is still visible while it is pending, then that "Read 2 more of 2" and "Some patches could not be read." are gone after release.

## Gotchas

- The in-flight moment (diffs kept while the next window loads) is a race the test reaches by holding the request; `$C network hold "POST /api/worktrees/:worktreeId/branch-changes/diffs"` before reading more and `$C network release` after a `snapshot` would show it (not yet driven with these commands; release within the web's 15-second request timeout).
- notes-24.md and notes-25.md, the two files read last, sit at the bottom of a long document, off screen at 414 by 896, and the diff viewer may not render off-screen files; the network log is the dependable check that they were read.
- `git add --all` commits README.md's start-state change too, which is why there are 27 files and README.md is first.
- The setup leaves the repository on `feature`; `$C stop` and `$C start` before driving another feature.
