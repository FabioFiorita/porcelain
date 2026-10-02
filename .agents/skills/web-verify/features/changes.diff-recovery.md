---
route: /
selectors:
  - "Review"
  - "All changes"
  - "The changes in this document could not be read."
  - "Load the changes again"
  - "Loading changes…"
tests:
  - apps/web/spec/integration/changes-diff-recovery.test.tsx
api:
  - GET /api/worktrees/:worktreeId/changes
  - POST /api/worktrees/:worktreeId/changes/diffs
---

# changes.diff-recovery

## What it is

When a file changes on disk after the page read the change list but before its diff request reaches the server, the server refuses the diff with 409 (worktree changed); the page then refreshes the change list once and shows the new diff, never leaving "Loading changes…" or "The changes in this document could not be read." behind.

## How a user reaches it

- Workspace → button "Review" → button "All changes" or a change row such as "README.md · unstaged", while another writer (an agent, an editor) rewrites the file at that moment. There is no control of its own; it is how every uncommitted diff document recovers.

## Driving it

`C=.agents/skills/web-verify/scripts/cli; $C start`, then `REPO=<the repository path start printed>`.

### Setup

A second tracked change makes the single-file README.md document a different diff request from the All changes one:

```sh
printf 'A second committed file.\n' > "$REPO/second.md"
git -C "$REPO" add --all && git -C "$REPO" commit -m "Add a second file"
printf 'A second changed file.\n' > "$REPO/second.md"
printf '# Sample repository\n\nAn earlier change to review.\n' > "$REPO/README.md"
```

CLI gap: the race needs the diff request held until the file is rewritten, which the CLI cannot do. Needed: `cli network hold "POST /api/worktrees/*/changes/diffs"` before step 5 and `cli network release` after the rewrite in step 6. Without it the CLI drives the ordinary path below, where the live update refreshes the list before the diff request and no 409 happens.

1. `$C open /`
   Look for: Page Title "Changes — repository"; text "2 files".
2. `$C click --role button --name "Review"`
   Look for: button "All changes"; rows "README.md · unstaged" and "second.md · unstaged".
3. `$C click --role button --name "All changes"`
   Look for: the sheet closes; heading "Changes" (All changes is the document titled "Changes", the one the workspace opens on); text "An earlier change to review." and "A second changed file."; no "Loading changes…".
4. `$C click --role button --name "Review"`
   Look for: rows "README.md · unstaged" and "second.md · unstaged" again.
5. `$C click --role button --name "README.md · unstaged"`
   Look for: the sheet closes; Page Title "README.md — repository"; the Page URL contains `entry=change%3AREADME.md`; text "An earlier change to review." and no "A second changed file.".
6. On disk: `printf '# Sample repository\n\nA newer change to review.\n' > "$REPO/README.md"`
7. `$C snapshot`
   Look for: text "A newer change to review."; "An earlier change to review.", "Loading changes…" and "The changes in this document could not be read." are absent.
8. `$C network`
   Look for: after the rewrite, a `GET /api/worktrees/<worktreeId>/changes` and a `POST /api/worktrees/<worktreeId>/changes/diffs`, both 200. A `POST …/changes/diffs` with 409 followed by exactly one `GET …/changes` and one 200 diff means the race itself was hit.

## What proves it works

- The new text shows with neither notice present, and the network log has no diffs request left failing.
- `apps/web/spec/integration/changes-diff-recovery.test.tsx`: holds the README.md diff request, rewrites README.md, releases it, and asserts exactly one 409 diff, exactly one 200 diff after it, exactly one extra change-list read, "A newer change to review." visible and both notices absent.

## Gotchas

- Unreachable through the CLI: the 409 recovery needs a diff request held across a disk write; needed `cli network hold "POST /api/worktrees/*/changes/diffs"` and `cli network release`. Chaining the write right before the click (`printf … > "$REPO/README.md"; $C click …`) can hit the race but is not dependable, because the watcher and live socket usually refresh the list first. A live run of files.edit hit it by chance: closing the editor tab with an unsaved draft (which saves it) while the Changes document reloaded gave `POST …/changes/diffs` 409, then a 200, with no failure notice; that is the recovery this feature promises, but it is not a dependable trigger.
- Opening a document closes the Review sheet at phone width; reopen it with "Review" before clicking a row.
- If "The changes in this document could not be read." appears, button "Load the changes again" retries; seeing it at all after the rewrite is the regression this feature guards.
- `git add --all` in the setup commits README.md's start-state change; the README.md shown afterwards is the setup's rewrite.
