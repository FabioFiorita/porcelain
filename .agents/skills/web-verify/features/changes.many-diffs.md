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

## What it is

All changes shows the diffs of more tracked changes than one diff request may carry (`DIFFS_PER_REQUEST` = 200, `packages/contracts/src/shared/limits.ts`) by splitting them over several requests, with no failure notice.

## How a user reaches it

- Workspace → button "Review" → button "All changes" (the first row of the Changes list; once an agent has published a review it moves under tab "Review" → nav "Walkthrough" as "All changes · N files"), in a worktree with more than 200 tracked, modified files.

## Driving it

`$C start`; pair your browser using the card’s pairing-link command, then `REPO=<connection.json fixtures.repositoryPath>`.

### Setup

205 committed notes, each then modified, give 205 tracked changes (two diff requests: 200 and 5):

```sh
for i in $(seq -w 0 204); do printf 'note-%s.md before\n' "$i" > "$REPO/note-$i.md"; done
git -C "$REPO" add --all && git -C "$REPO" commit -m "Add many notes"
for i in $(seq -w 0 204); do printf 'note-%s.md changed\n' "$i" > "$REPO/note-$i.md"; done
git -C "$REPO" status --porcelain | wc -l   # prints 205
```

1. Navigate to `/` on the card’s web URL (full page load)
   Look for: Page Title "Changes — repository"; text "205 files" (on an instance where an earlier feature left another tab selected, a full reload of `/` reopens that tab; click tab "Changes Close Changes" first).
2. Click button named `Review`
   Look for: button "All changes"; rows from "note-000.md · unstaged" to "note-204.md · unstaged".
3. Click button named `All changes`
   Look for: the sheet closes; heading "Changes" (All changes is the document titled "Changes"); the Page URL contains `entry=handoff`; text "note-000.md changed" (the first file's new line); no text "The changes in this document could not be read."; "Loading changes…" gone once the reads finish.
4. Inspect HTTP requests and responses
   Look for: at least two `POST /api/worktrees/<worktreeId>/changes/diffs` with status 200 after the click and none with an error status (`[FAILED] net::ERR_ABORTED` lines are requests the page cancelled and sent again, not failures).

## What proves it works

- Step 3's diff text with no failure notice, and step 4's two or more 200 diff requests: one request could not have carried 205 files.
- `apps/web/spec/integration/changes-many-diffs.test.tsx`: writes the same 205 files, asserts "note-000.md changed" visible, the failure notice absent, and at least two diff hits with status 200 on the server.

## Gotchas

- The workspace opens on this same document (tab "Changes Close Changes"), so step 1 may already show "note-000.md changed"; steps 2 and 3 are the explicit route and must end in the same state.
- `git add --all` in the setup also commits README.md's start-state change, so README.md is not among the 205 changes.
- The document is long; only the first files are on screen at 414 by 896, so check the first file's text and rely on the network log for the rest.
- Writing 410 files makes the watcher report a large batch; if the Changes list or "205 files" is not there yet at step 1, inspect the accessibility tree again after a second rather than reloading repeatedly.
- The 205 notes stay in the repository; `$C stop` and `$C start`; pair your browser using the card’s pairing-link command before driving another feature.
