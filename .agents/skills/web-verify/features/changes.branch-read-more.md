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

The Branch document ("All branch changes") reads diffs for the first 25 files ; "Read N more of M" reads the next window only, keeping the diffs already on screen while it loads.

## How to get to it (user POV)

- Workspace → button "Review" → tab "Changes" → tab "Branch" → button "All branch changes" (its name ends with the file count) → at the bottom of the document, button "Read <n> more of <m>" (while further files remain, shows "Reading…", disabled, during a read).

## Driving it with browser

Preconditions: [surface baseline](README.md).

### Setup

26 new notes plus the committed README.md change make 27 branch files, two more than one window:

```sh
git -C "$REPO" switch -c feature
for i in $(seq 0 25); do printf 'note %s\n' "$i" > "$REPO/notes-$(printf %02d "$i").md"; done
git -C "$REPO" add --all && git -C "$REPO" commit -m "Add many notes"
git -C "$REPO" diff --name-only main feature | wc -l   # prints 27
```

1. Navigate to `/`
   Expect: title "Files — repository".
2. Click button `Review`, then click tab `Changes`
   Expect: tabs "Uncommitted" and "Branch".
3. Click tab `Branch`
   Expect: text "1 commit on feature since main"; a button whose name starts "All branch changes" and ends "27"; rows "README.md · modified", "notes-00.md · added" … "notes-25.md · added".
4. Click button `/^All branch changes/`
   Expect: the sheet closes; title "Branch changes — repository"; toolbar "Branch" over "27 files changed"; heading "feature since main"; text "A change to review." (README.md's diff, the first file); button "Read 2 more of 2" at the bottom; no text "Some patches could not be read.".
5. Arm the HTTP hold for `POST /api/worktrees/:worktreeId/branch-changes/diffs` (see [routing recipes and per-map instructions](../references/failure-injection.md)), then click button `Read 2 more of 2`. Await the held request.
   Look for while held: text "A change to review." still visible. The read-more button disappears when this final window is selected; its absence alone does not prove the held request completed. Release within 15 seconds.
   Look for after release: button "Read 2 more of 2" is gone; text "A change to review." still shows; no text "Some patches could not be read.". Then inspect HTTP requests and responses: a second `POST /api/worktrees/<worktreeId>/branch-changes/diffs` with 200.

### Observable proof

Record request bodies: first diff window has 25 files, next only two, both 200. Existing README diff stays visible during the held read.

Automated coverage: `changes-branch-read-more.test.tsx`.

## Gotchas

- Hold the next window before Read more; release within the 15-second timeout. Last files notes-24.md/notes-25.md may be virtualized offscreen; request bodies prove they were read.
- add --all includes README, making 27 files with README first. Setup leaves feature; reset before another map.
