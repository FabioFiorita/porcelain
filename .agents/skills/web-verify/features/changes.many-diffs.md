---
route: /
selectors:
  - 'Review'
  - 'All changes'
  - 'The changes in this document could not be read.'
  - 'changes shown'
tests:
  - apps/web/spec/integration/changes-many-diffs.test.tsx
  - apps/web/spec/integration/changes-presentation.test.tsx
  - apps/web/spec/integration/workspace-read-failure.test.tsx
api:
  - GET /api/worktrees/:worktreeId/changes
  - POST /api/worktrees/:worktreeId/changes/diffs
---

# changes.many-diffs

All changes lists and reads diffs for its first 25 files; a worktree with more than 2,000 changed files lists the first 2,000 and its heading reads "2,000 of M changes shown", while Stash, Pop stash and a merge commit say to use a terminal and the commit form notes that unlisted changes stay out of the commit. If the change list cannot be read at all, the tabs, toolbar and side panel stay and the Review tab shows the failure with Try again; "Read 25 more…" at the bottom adds the next 25 rows and diffs. Its heading, reviewed count and Mark all still cover every file, and the window survives switching tabs. Read to the end, more files than one diff request may carry (200) are split over several requests, with no failure notice. While the initial diff is pending, the document shows nothing in its place (no skeleton or loading words); already loaded diffs stay readable during later reads.

## How to get to it (user POV)

- Workspace → button "Review" → button "All changes" in a worktree with more than 200 tracked, modified files.

## Driving it with browser

Preconditions: [surface baseline](README.md).

### Setup

205 committed notes, each then modified, give 205 tracked changes (two diff requests: 200 and 5):

```sh
for i in $(seq -w 0 204); do printf 'note-%s.md before\n' "$i" > "$REPO/note-$i.md"; done
git -C "$REPO" add --all && git -C "$REPO" commit -m "Add many notes"
for i in $(seq -w 0 204); do printf 'note-%s.md changed\n' "$i" > "$REPO/note-$i.md"; done
git -C "$REPO" status --porcelain | wc -l   # prints 205
```

1. Navigate to `/`
   Expect: title "Review — repository"; text "205 files" (on an instance where an earlier feature left another tab selected, a full reload of `/` reopens that tab; click tab "Review" first).
2. Click button `Review`
   Expect: button "All changes"; rows from "note-000.md · unstaged" to "note-204.md · unstaged".
3. Click button `All changes`
   Expect: the sheet closes; heading "205 uncommitted changes" in document "All changes"; the URL contains `entry=all-changes`; the file table's first 25 rows and a button "Read 25 more…" at the bottom. Click its "note-000.md +1 −1" row to scroll to that diff and read "note-000.md changed" (the first file's new line). Click "Read 25 more…" until it is gone: the table ends with note-204.md; no text "The changes in this document could not be read.".
4. Inspect HTTP traffic
   Expect: at least two `POST /api/worktrees/<worktreeId>/changes/diffs` with status 200 after the last Read more click and none with an error status (`[FAILED] net::ERR_ABORTED` lines are requests the page cancelled and sent again, not failures).

### Loading presentation

Hold the initial change-diff request through the browser harness. No skeleton, placeholder or loading words appear for the pending diff. Release the request: the real diff becomes readable. Repeat after an already loaded file is selected to confirm later reads do not hide its content. Errors show one line with Try again.

### Observable proof

Visible first diff, the last row, and at least two 200 diff requests after the last Read more account for all 205 files; no failure notice.

Automated coverage: `changes-many-diffs.test.tsx`.

## Gotchas

- Initial document may already show note-000.md; still drive the explicit entry. Only early diffs may render onscreen, so use request bodies for complete coverage.
- add --all commits README before the 205 changes. Wait for the large watcher batch instead of repeatedly reloading; reset before another map.
