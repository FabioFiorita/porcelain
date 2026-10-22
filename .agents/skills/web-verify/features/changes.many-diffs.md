---
route: /
selectors:
  - "Review"
  - "All changes"
  - "The changes in this document could not be read."
  - "Loading changes…"
tests:
  - apps/web/spec/integration/changes-many-diffs.test.tsx
api:
  - GET /api/worktrees/:worktreeId/changes
  - POST /api/worktrees/:worktreeId/changes/diffs
---

# changes.many-diffs

All changes shows the diffs of more tracked changes than one diff request may carry (200 files) by splitting them over several requests, with no failure notice.

## How to get to it (user POV)

- Workspace → button "Review" → button "All changes" (the first row of the Changes list; once an agent has published a review it moves under tab "Review" → nav "Walkthrough" as "All changes · N files"), in a worktree with more than 200 tracked, modified files.

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
   Expect: title "Changes — repository"; text "205 files" (on an instance where an earlier feature left another tab selected, a full reload of `/` reopens that tab; click tab "Changes Close Changes" first).
2. Click button `Review`
   Expect: button "All changes"; rows from "note-000.md · unstaged" to "note-204.md · unstaged".
3. Click button `All changes`
   Expect: the sheet closes; heading "Changes" (All changes is the document titled "Changes"); the URL contains `entry=handoff`; text "note-000.md changed" (the first file's new line); no text "The changes in this document could not be read."; "Loading changes…" gone once the reads finish.
4. Inspect HTTP traffic
   Expect: at least two `POST /api/worktrees/<worktreeId>/changes/diffs` with status 200 after the click and none with an error status (`[FAILED] net::ERR_ABORTED` lines are requests the page cancelled and sent again, not failures).

### Observable proof

Visible first diff and at least two 200 diff requests account for all 205 files; no failure notice.

Automated coverage: `changes-many-diffs.test.tsx`.

## Gotchas

- Initial document may already show note-000.md; still drive the explicit entry. Only early diffs may render onscreen, so use request bodies for complete coverage.
- add --all commits README before the 205 changes. Wait for the large watcher batch instead of repeatedly reloading; reset before another map.
