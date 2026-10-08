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

- Workspace → button "Review" → tab "Changes" → tab "Branch" → button "All branch changes" (its name ends with the file count) → at the bottom of the document, button "Read <n> more of <m>" (while further files remain, shows "Reading…", disabled, during a read).

## Driving it

`$C start`; pair your browser using the card’s pairing-link command, then `REPO=<connection.json fixtures.repositoryPath>`.

### Setup

26 new notes plus the committed README.md change make 27 branch files, two more than one window:

```sh
git -C "$REPO" switch -c feature
for i in $(seq 0 25); do printf 'note %s\n' "$i" > "$REPO/notes-$(printf %02d "$i").md"; done
git -C "$REPO" add --all && git -C "$REPO" commit -m "Add many notes"
git -C "$REPO" diff --name-only main feature | wc -l   # prints 27
```

1. Navigate to `/` on the card’s web URL (full page load)
   Look for: Page Title "Files — repository".
2. Click button named `Review`, then click tab named `Changes`
   Look for: tabs "Uncommitted" and "Branch".
3. Click tab named `Branch`
   Look for: text "1 commit on feature since main"; a button whose name starts "All branch changes" and ends "27"; rows "README.md · modified", "notes-00.md · added" … "notes-25.md · added".
4. Click button named `/^All branch changes/`
   Look for: the sheet closes; Page Title "Branch changes — repository"; toolbar "Branch" over "27 files changed"; heading "feature since main"; text "A change to review." (README.md's diff, the first file); button "Read 2 more of 2" at the bottom; no text "Some patches could not be read.".
5. Arm the HTTP hold for `POST /api/worktrees/:worktreeId/branch-changes/diffs` (see [routing recipes and per-map instructions](../references/failure-injection.md)), then click button named `Read 2 more of 2`. Await the held request.
   Look for while held: text "A change to review." still visible. The read-more button disappears when this final window is selected; its absence alone does not prove the held request completed. Release within 15 seconds.
   Look for after release: button "Read 2 more of 2" is gone; text "A change to review." still shows; no text "Some patches could not be read.". Then inspect HTTP requests and responses: a second `POST /api/worktrees/<worktreeId>/branch-changes/diffs` with 200.

## What proves it works

- Inspect HTTP requests and responses after step 5 shows a second `POST /api/worktrees/<worktreeId>/branch-changes/diffs` with 200, sent at the click: the first carried the 25 files of the first window, the second only the 2 new ones (inspect the two request bodies to confirm the 25-file and 2-file windows).
- The README.md diff text stays visible through the read, so the window grew instead of replacing what was shown.
- `apps/web/spec/integration/changes-branch-read-more.test.tsx`: holds the second diffs request open and asserts "A change to review." is still visible while it is pending, then that "Read 2 more of 2" and "Some patches could not be read." are gone after release.

## Gotchas

- Hold the next diff window before clicking "Read more"; inspect the preserved first window while the request is held, then release within the 15-second request timeout.
- notes-24.md and notes-25.md, the two files read last, sit at the bottom of a long document, off screen at 414 by 896, and the diff viewer may not render off-screen files; the network log is the dependable check that they were read.
- `git add --all` commits README.md's start-state change too, which is why there are 27 files and README.md is first.
- The setup leaves the repository on `feature`; `$C stop` and `$C start`; pair your browser using the card’s pairing-link command before driving another feature.
