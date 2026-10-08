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

`$C start`; pair your browser using the card’s pairing-link command, then `REPO=<connection.json fixtures.repositoryPath>`.

### Setup

A second tracked change makes the single-file README.md document a different diff request from the All changes one:

```sh
printf 'A second committed file.\n' > "$REPO/second.md"
git -C "$REPO" add --all && git -C "$REPO" commit -m "Add a second file"
printf 'A second changed file.\n' > "$REPO/second.md"
printf '# Sample repository\n\nAn earlier change to review.\n' > "$REPO/README.md"
```

The race needs the README.md diff request to reach the server only after the rewrite, and the page must not hear of the rewrite first: the HTTP hold keeps the diff requests waiting and the live outage keeps the live update away, as the test holds the diff request and the live notices.

1. Navigate to `/` on the card’s web URL (full page load), then wait for text '2 files' to be visible
   Look for: text "2 files".
2. Click button named `Review`
   Look for: button "All changes"; rows "README.md · unstaged" and "second.md · unstaged".
3. Click button named `All changes`
   Look for: the sheet closes; heading "Changes" (All changes is the document titled "Changes", the one the workspace opens on); code holding "An earlier change to review." and "A second changed file."; no "Loading changes…".
4. Click button named `Review`, then hold matching `POST /api/worktrees/:worktreeId/changes/diffs` requests in the browser before they reach the server (see [routing recipes and per-map instructions](../references/failure-injection.md))
   Look for: rows "README.md · unstaged" and "second.md · unstaged" again; the browser gate is armed for the next diff POST.
5. Click button named `README.md · unstaged`, then drop the live WebSocket and reject reconnects (see [routing recipes and per-map instructions](../references/failure-injection.md))
   Look for: the sheet closes; Page Title "README.md — repository"; the Page URL contains `entry=change%3AREADME.md`; Inspect the accessibility tree shows "Loading changes…" while the diff request waits.
6. On disk: `printf '# Sample repository\n\nA newer change to review.\n' > "$REPO/README.md"`, then release the held HTTP requests
   Look for: the held diff request reaches the server after the rewrite.
7. Wait for text 'A newer change to review.' to be visible, then inspect the accessibility tree
   Look for: code holding "A newer change to review."; "An earlier change to review.", "Loading changes…" and "The changes in this document could not be read." are absent (this happens with the live connection still down).
8. Inspect HTTP requests and responses
   Look for: after the release, one `POST /api/worktrees/<worktreeId>/changes/diffs` answered 409, then exactly one `GET /api/worktrees/<worktreeId>/changes` 200 and one `POST …/changes/diffs` 200 (the recovery). `[FAILED] net::ERR_ABORTED` diff lines are requests the page cancelled itself.
9. Restore the live WebSocket and wait for the app to reconnect (see [routing recipes and per-map instructions](../references/failure-injection.md))
   Look for: the live connection reconnects; the reconnect reads the list and the diff once more, both 200.

## What proves it works

- The new text shows with neither notice present, and the network log has no diffs request left failing.
- `apps/web/spec/integration/changes-diff-recovery.test.tsx`: holds the README.md diff request, rewrites README.md, releases it, and asserts exactly one 409 diff, exactly one 200 diff after it, exactly one extra change-list read, "A newer change to review." visible and both notices absent.

## Gotchas

- Both the hold and the live outage are needed: with only the hold, the live update refreshes the list and the page cancels the held request before the release.
- Release within 15 s of step 5: a request held past the web's request timeout (`REQUEST_TIMEOUT_MS`) fails on its own, which is a different path.
- Opening a document closes the Review sheet at phone width; reopen it with "Review" before clicking a row.
- If "The changes in this document could not be read." appears, button "Load the changes again" retries; seeing it at all after the rewrite is the regression this feature guards.
- `git add --all` in the setup commits README.md's start-state change; the README.md shown afterwards is the setup's rewrite.
